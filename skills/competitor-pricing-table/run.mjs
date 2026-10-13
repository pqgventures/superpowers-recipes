// Superpowers recipe: competitor pricing table. A browser agent opens each competitor's pricing page, switches the
// monthly/yearly billing toggle and lists every plan with both prices and three headline features. The table is assembled
// in code from what the pages show; nothing is estimated.
export const recipe = {
  slug: "competitor-pricing-table",
  order: 26,
  name: "Competitor pricing table",
  description: "Paste up to four competitors' pricing pages. Get one table of every plan with the price billed yearly and billed monthly, how much the yearly plan saves, and three headline features, read from the live pages.",
  inputs: {
    pages: { title: "Pricing pages", description: "Up to four pricing page links, separated by commas or new lines", example: "airtable.com/pricing, clickup.com/pricing, asana.com/pricing", required: true, maxLength: 800 },
  },
  uses: { "tinyfish.web-agent": 4, "tinyfish.fetch": 1 },
  share: { review: false },
};

const AGENT = "tinyfish.web-agent";
const data = (r) => (r && r.output !== undefined ? r.output : r) ?? {};
export function pages(text) {
  const out = [];
  for (const raw of String(text || "").split(/[,\n;\s]+/)) {
    let u = raw.trim(); if (!u) continue;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { const x = new URL(u); if (/\./.test(x.hostname) && !out.includes(x.href)) out.push(x.href); } catch {}
  }
  return out.slice(0, 4);
}
export const company = (u) => { const h = new URL(u).hostname.replace(/^www\./, "").split(".")[0]; return h.charAt(0).toUpperCase() + h.slice(1); };

const SCHEMA = { type: "object", properties: { plans: { type: "array", items: { type: "object", properties: {
  name: { type: "string" }, billed_yearly_per_user_per_month: { type: "string" }, billed_monthly_per_user_per_month: { type: "string" },
  headline_features: { type: "array", items: { type: "string" } } }, required: ["name"] } } }, required: ["plans"] };
const GOAL = "List every plan on this pricing page. If there is a monthly/yearly (annual) billing toggle, read the price of every plan with yearly billing, then switch the toggle and read it with monthly billing. Give each price per user per month as the page shows it (for example $10 or $10.99), or the page's words when there is no number (Free, Custom, Contact sales). Add the plan's first three headline features. Return JSON.";

// Agents name fields their own way; find the yearly and monthly prices and the features whatever the keys are.
export function plansFrom(result) {
  const plans = (result && (result.plans ?? result.pricing_plans ?? result.tiers)) ?? [];
  const flat = (o, pre = "", acc = {}) => { for (const [k, v] of Object.entries(o ?? {})) { if (v && typeof v === "object" && !Array.isArray(v)) flat(v, pre + k + "_", acc); else acc[(pre + k).toLowerCase()] = v; } return acc; };
  return plans.map((p) => {
    const f = flat(p);
    const pick = (re, not) => { const k = Object.keys(f).find((k) => re.test(k) && !(not && not.test(k)) && !Array.isArray(f[k])); return k === undefined ? null : f[k]; };
    const yearly = pick(/year|annual/);
    const monthly = pick(/month/, /year|annual/) ?? pick(/monthly/);
    const feats = Object.entries(f).find(([k, v]) => /feature/.test(k) && Array.isArray(v))?.[1] ?? [];
    return { name: String(p.name ?? p.plan ?? p.title ?? "Plan"), yearly, monthly, features: feats.slice(0, 3).map(String) };
  });
}
const num = (v) => { if (typeof v === "number") return v; const m = String(v ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/); return m && !/contact|custom/i.test(String(v)) ? Number(m[0]) : null; };
export const money = (v) => { const n = num(v); if (n === null) return v === null || v === undefined || v === "" ? "not shown" : String(v); return n === 0 ? "$0" : "$" + (Number.isInteger(n) ? n : n.toFixed(2)); };
export function saving(y, m) { const a = num(y), b = num(m); return a !== null && b !== null && b > 0 && a < b ? Math.round((1 - a / b) * 100) + "%" : null; }

// A price counts as seen when the page's own text shows it ($20, $10.99). Prices that only appear after a billing toggle,
// or that the agent misread, are not in the text; those are flagged so the user checks them on the page.
export function seenOn(text, v, plan) {
  const n = num(v); if (n === null || n === 0 || !text || !plan) return null;
  const esc = (x) => x.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  const amounts = (s) => [...s.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)].map((x) => Number(x[1]));
  // 1. The plan name as its own line or heading: any price in its section (up to the next heading, at most 600 characters).
  const head = new RegExp("^[ \\t]*#{0,4}[ \\t]*\\**" + esc(plan) + "\\**[^\\n]{0,20}$", "gim"); let m;
  while ((m = head.exec(text))) {
    let sec = text.slice(m.index + m[0].length, m.index + m[0].length + 600);
    const next = sec.search(/^[ \t]*#{1,4} /m); if (next >= 0) sec = sec.slice(0, next);
    if (amounts(sec).includes(n)) return true;
  }
  // 2. The name inside a sentence: one of the first two prices within 150 characters after it. An add-on's
  // "$10 per 10,000 credits" further down the page does not count for a plan priced $10.
  const word = new RegExp("\\b" + esc(plan), "gi");
  while ((m = word.exec(text))) if (amounts(text.slice(m.index + m[0].length, m.index + m[0].length + 150)).slice(0, 2).includes(n)) return true;
  return false;
}

export async function run(sp, { pages: input }) {
  const list = pages(input);
  if (!list.length) throw new Error("Give at least one pricing page link, e.g. airtable.com/pricing");
  const rows = [], failed = [];
  for (const [i, u] of list.entries()) {
    try {
      const r = data(await sp.run("page-" + i, AGENT, { url: u, goal: GOAL, output_schema: SCHEMA }));
      const plans = plansFrom(r.result ?? r);
      if (!plans.length) { failed.push(u); continue; }
      rows.push({ company: company(u), url: u, plans });
    } catch { failed.push(u); }
  }
  let texts = {};
  if (rows.length) {
    try {
      const f = data(await sp.run("page-text", "tinyfish.fetch", { urls: rows.map((r) => r.url) }));
      for (const [i, pg] of (f.pages ?? []).entries()) if (pg?.text) texts[rows[i]?.url] = pg.text;
    } catch {}
  }
  let seen = 0, checked = 0;
  const mark = (c, v, plan) => { const t = texts[c.url]; const ok = seenOn(t, v, plan); if (ok === null) return money(v); checked++; if (ok) { seen++; return money(v) + " ✓"; } return money(v) + " (not in the page text)"; };
  let swapped = 0;
  for (const c of rows) for (const p of c.plans) {
    p.yearlyShown = mark(c, p.yearly, p.name); p.monthlyShown = mark(c, p.monthly, p.name);
    // Billed yearly is never dearer per month than billed monthly; when it is, the agent most likely swapped the two.
    const y = num(p.yearly), m = num(p.monthly);
    if (y !== null && m !== null && y > m) { p.swapped = true; swapped++; }
  }
  const lines = rows.flatMap((c) => c.plans.map((p) => { const s = saving(p.yearly, p.monthly); return c.company + " · " + p.name + ": " + p.yearlyShown + " billed yearly, " + p.monthlyShown + " billed monthly" + (s ? " (yearly saves " + s + ")" : "") + (p.swapped ? " (yearly is above monthly: the two look swapped; check the page)" : "") + (p.features.length ? "\n  " + p.features.join("; ") : ""); }));
  const paid = rows.flatMap((c) => c.plans.map((p) => ({ c: c.company, p: p.name, s: saving(p.yearly, p.monthly) }))).filter((x) => x.s);
  return {
    title: "Pricing: " + rows.map((r) => r.company).join(", "),
    items: [
      { label: "Summary", text: rows.reduce((n, r) => n + r.plans.length, 0) + " plans from " + rows.length + " of " + list.length + " pricing pages, read on " + new Date().toISOString().slice(0, 10) + ". Prices per user per month as the page shows them." + (paid.length ? " Yearly billing saves " + paid.map((x) => x.c + " " + x.p + " " + x.s).join(", ") + "." : "") + (failed.length ? " Could not read: " + failed.join(", ") + "." : "") + (checked ? " " + seen + " of " + checked + " paid prices also appear next to their plan's name in the page's own text (✓). Check the others on the page before you use them: they show only after the billing toggle, or were misread." : "") + (swapped ? " " + swapped + " plan" + (swapped > 1 ? "s show" : " shows") + " a yearly price above the monthly one, which usually means the two were swapped." : "") },
      { label: "Every plan", text: lines.join("\n") },
      ...rows.map((c) => ({ label: c.company + " pricing page", url: c.url })),
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
