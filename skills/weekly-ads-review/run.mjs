// Superpowers recipe: a weekly review of your ads from the platform's export.
// The numbers, flags and charts come from the export (computed, not written by AI); one model call turns the flags into
// what to scale, fix and test next week, citing only the computed figures it was given.
export const recipe = {
  slug: "weekly-ads-review",
  order: 12,
  name: "Weekly review of your ads from the export",
  description: "Paste or link last week's export from Meta, Google, TikTok or LinkedIn ads; get spend, results and cost per result per campaign, what is wasting money, and three things to scale, fix or test next week.",
  inputs: {
    csv: { title: "Ads export (CSV)", description: "Paste the CSV, or leave empty and give a link", maxLength: 60000 },
    csv_url: { title: "Or a link to the CSV", description: "A public link to the export file" },
    target_cpa: { title: "Target cost per result (optional)", description: "In your currency, e.g. 40" },
  },
  uses: { "adsreport.analyze": 1, "openrouter.openai-gpt-5.4-mini": 1 },
  share: { review: false },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
const n = (x, d = 2) => (x == null || !Number.isFinite(Number(x)) ? "–" : Number(x).toLocaleString("en-US", { maximumFractionDigits: d }));

export async function run(sp, { csv, csv_url, target_cpa }) {
  if (!csv && !csv_url) throw new Error("Paste the ads export or give a link to it");
  const cpa = target_cpa ? Number(String(target_cpa).replace(",", ".")) : undefined;
  const rep = await sp.run("report", "adsreport.analyze", { ...(csv ? { csv } : { csv_url }), group_by: "campaign", ...(cpa > 0 ? { target_cpa: cpa } : {}), charts: false });
  const t = rep.totals || rep.summary || {};
  const rows = (rep.groups || []).slice(0, 12);
  const flags = rows.flatMap((g) => (g.flags || []).map((f) => ({ text: g.name + ": " + f }))).slice(0, 12);
  const facts = { totals: t, rows: rows.map((r, i) => ({ ref: "R" + (i + 1), ...r })), flags: flags.map((f, i) => ({ ref: "F" + (i + 1), ...(typeof f === "string" ? { text: f } : f) })) };
  const prompt = "You review an ad account for a busy owner. Using only the numbers below (do not compute new ones), write three actions for next week: one to scale, one to fix or pause, one to test. Each action is one sentence and names the campaign; end it with the refs it rests on in brackets, like [R2, F1].\n" +
    'Return JSON only: {"actions":[{"kind":"scale|fix|test","text":"...","refs":["R2"]}]}\n\n' + JSON.stringify(facts).slice(0, 12000);
  const plan = JSON.parse(textOf(await sp.run("actions", LLM, { prompt, max_tokens: 700 })).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  const known = new Set([...facts.rows.map((r) => r.ref), ...facts.flags.map((f) => f.ref)]);
  const actions = (plan.actions || []).filter((a) => a.text && (a.refs || []).length && a.refs.every((r) => known.has(r))).slice(0, 3);
  const name = (r) => r.name ?? "campaign";
  return {
    title: "Weekly ads review",
    items: [
      { label: "Totals", text: "Spend " + n(t.spend) + " · results " + n(t.conversions, 0) + " · cost per result " + n(t.cpa) + " · return on spend " + n(t.roas) + " · click rate " + n(t.ctr_pct) + "%" },
      { label: "By campaign", text: facts.rows.map((r) => r.ref + " " + name(r) + ": spend " + n(r.spend) + ", results " + n(r.conversions, 0) + ", cost per result " + n(r.cpa) + ", return " + n(r.roas)).join("\n") || "No campaigns found" },
      { label: "Warnings", text: facts.flags.map((f) => f.ref + " " + f.text).join("\n") || "No warnings" },
      { label: "Next week", text: actions.map((a) => a.kind.toUpperCase() + ": " + a.text).join("\n") || "No actions: the numbers did not support a clear change." },
      { label: "About this", text: "Totals, per-campaign numbers and warnings are computed from your export. The three actions are written by AI from those numbers only; each cites the rows it rests on." },
    ],
  };
}

// ---- Superpowers runner (appended to the recipe above) --------------------------------------
// node run.mjs --input value [--no-share]   Key: SUPERPOWERS_API_KEY or ~/.config/superpowers/key
const SP_BASE = (process.env.SUPERPOWERS_URL || "https://superpowers.tools").replace(/\/$/, "");
async function spReadKey() {
  if (process.env.SUPERPOWERS_API_KEY) return process.env.SUPERPOWERS_API_KEY.trim();
  try { const fs = await import("node:fs"); const os = await import("node:os"); return fs.readFileSync(os.homedir() + "/.config/superpowers/key", "utf8").trim(); } catch { return ""; }
}
const SP_KEY = await spReadKey();
if (!SP_KEY) { console.error("No Superpowers API key. Set SUPERPOWERS_API_KEY or save it to ~/.config/superpowers/key. Setup: " + SP_BASE + "/skill.md"); process.exit(1); }
async function spApi(path, body) {
  const r = await fetch(SP_BASE + path, { method: "POST", headers: { authorization: "Bearer " + SP_KEY, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !j.status) throw new Error(path + " returned " + r.status + ": " + (j.error || "no details"));
  return j;
}
const spSteps = {}; let spCharge = 0;
// One key per run, plus the step id: a retried step replays its result instead of paying twice.
const spRunKey = "recipe-" + recipe.slug + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
const sp = { run: async (id, tool, input) => {
  const r = await spApi("/v1/run", { tool, input, idempotency_key: spRunKey + ":" + id });
  spCharge += r.charge_usd || 0;
  spSteps[id] = { tool, status: r.status, charge_usd: r.charge_usd ?? 0, normalized: r.normalized ?? null, error: r.error };
  if (r.status !== "completed") throw new Error("step " + id + " (" + tool + ") failed: " + (r.error || r.status));
  // The full tool output rides along as a hidden .output, for tools whose normalized summary is only counts.
  if (r.normalized && typeof r.normalized === "object" && r.output !== undefined && !("output" in r.normalized)) Object.defineProperty(r.normalized, "output", { value: r.output, enumerable: false });
  return r.normalized ?? r.output;
},
  // Copies a file a tool returned (often a short-lived link) into the user's Superpowers storage and returns a lasting URL.
  keep: async (url, filename) => (await spApi("/v1/files/from-url", { url, filename })).url };
const spArgv = process.argv.slice(2); const spGiven = {}; let spShare = true;
for (let i = 0; i < spArgv.length; i++) {
  const a = spArgv[i];
  if (a === "--no-share") spShare = false;
  else if (a.startsWith("--")) { const eq = a.indexOf("="); if (eq > 0) spGiven[a.slice(2, eq)] = a.slice(eq + 1); else spGiven[a.slice(2)] = spArgv[++i]; }
}
const spInputs = {};
for (const [k, p] of Object.entries(recipe.inputs || {})) {
  spInputs[k] = spGiven[k] ?? p.default;
  if (p.required && !spInputs[k]) { console.error("Missing --" + k + " (" + (p.description || k) + ")"); process.exit(2); }
}
try {
  const out = await run(sp, spInputs);
  let share = null;
  if (spShare && out && out.items && out.items.length) share = await spApi("/v1/shares", { title: out.title || recipe.name, items: out.items, review: !!(recipe.share && recipe.share.review), question: recipe.share && recipe.share.question, recipe: recipe.slug });
  console.log(JSON.stringify({ status: "completed", recipe: recipe.slug, charge_usd: +spCharge.toFixed(6), share_url: share ? share.url : null, share_id: share ? share.share_id : null, result: out, steps: spSteps }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ status: "failed", recipe: recipe.slug, error: e.message, charge_usd: +spCharge.toFixed(6), steps: spSteps }, null, 2));
  process.exit(1);
}
