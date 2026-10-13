// Superpowers recipe: a first line for each target company that mentions something real it did lately.
// Reads each company's recent news (grouped by event), then one model call picks a story per company by ref and writes an
// opener; code inserts the headline, date and link, and drops any opener whose ref is not in that company's news.
export const recipe = {
  slug: "lead-openers",
  order: 11,
  name: "Opening lines from each company's latest news",
  description: "Give your target companies and what you sell; get one opening line per company that mentions a real recent event (a launch, a hire, a funding round), with the story and link it is based on.",
  inputs: {
    companies: { title: "Companies", description: "Company websites, separated by commas (up to 8)", example: "ramp.com, linear.app, vanta.com", required: true, maxLength: 400 },
    offer: { title: "What you sell", description: "In a few words", example: "a tool that cuts month-end close to two days", required: true, maxLength: 160 },
  },
  uses: { "akta.company-news": 8, "openrouter.openai-gpt-5.4-mini": 1 },
  share: { review: false },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
export function domains(text) {
  const out = [];
  for (const raw of String(text || "").split(/[,\n;\s]+/)) {
    const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
    if (/^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(d) && !out.includes(d)) out.push(d);
  }
  return out;
}

export async function run(sp, { companies, offer }) {
  const list = domains(companies);
  if (!list.length) throw new Error("Give at least one company website, e.g. ramp.com");
  if (list.length > 8) throw new Error("At most 8 companies per run");
  const what = String(offer || "").trim(); if (what.length < 3) throw new Error("Say what you sell");
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const news = {};
  for (const [i, d] of list.entries()) {
    const r = await sp.run("news-" + i, "akta.company-news", { company: d, limit: 6, since }).catch(() => ({ articles: [] }));
    news[d] = (r.articles || []).filter((a) => a.title && a.url).map((a, k) => ({ ref: "N" + (i + 1) + "." + (k + 1), ...a }));
  }
  const withNews = list.filter((d) => news[d].length);
  let picks = {};
  if (withNews.length) {
    const prompt = "You write the first line of a cold email for someone who sells: " + what + ".\n" +
      "For each company below, pick the one recent story about the company itself (its own launch, hire, funding, partnership or results; skip comparison pages, rivals' posts and general industry news) that gives the most natural opener. Write one sentence (max 30 words) that mentions that story plainly and links it to why the offer could matter now. Never write that the company said something unless the story quotes it. No flattery, no exclamation marks, no facts or numbers that are not in the story. If no story is about the company itself, return {\"ref\": null}.\n" +
      'Return JSON only: {"<company>": {"ref": "N1.2", "opener": "..."}}\n\n' +
      withNews.map((d) => d + ":\n" + news[d].map((a) => a.ref + " (" + a.date + ") " + a.title + " — " + String(a.summary || "").slice(0, 300)).join("\n")).join("\n\n");
    picks = JSON.parse(textOf(await sp.run("openers", LLM, { prompt, max_tokens: 1200 })).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  }
  // Every number in an opener must appear in the story it cites, or the opener is dropped.
  const numbersOk = (opener, a) => (String(opener).match(/\d[\d.,%]*/g) || []).every((n) => (a.title + " " + (a.summary || "")).includes(n.replace(/[.,]$/, "")));
  const rows = list.map((d) => {
    const p = picks[d] || {}; const a = news[d].find((x) => x.ref === String(p.ref || "").trim());
    if (!news[d].length) return { d, text: "No news in the last 90 days, so no opener: start from their website or a mutual contact instead." };
    if (!a || !p.opener) return { d, text: "None of their recent stories is about the company itself, so no opener; latest story: " + news[d][0].title + " (" + news[d][0].date + ")" };
    const story = { title: a.title, meta: d + " · " + a.date + (a.publisher ? " · " + a.publisher : "") };
    if (!numbersOk(p.opener, a)) return { d, text: "Opener dropped: it used a number the story does not contain. Story: " + a.title + " (" + a.date + ")", url: a.url, dropped: true, ...story, line: "Opener dropped: it used a number the story does not contain." };
    return { d, text: "“" + String(p.opener).trim() + "”\nBased on: " + a.title + " (" + a.date + (a.publisher ? ", " + a.publisher : "") + ")", url: a.url, ...story, line: "“" + String(p.opener).trim() + "”" };
  });
  const written = rows.filter((r) => r.url && !r.dropped).length;
  return {
    title: "Opening lines for " + list.length + " compan" + (list.length === 1 ? "y" : "ies"),
    items: [
      { label: "Result", text: written + " opening line" + (written === 1 ? "" : "s") + " for " + list.length + " compan" + (list.length === 1 ? "y" : "ies") + "; " + withNews.length + " had news in the last 90 days. Each line names the story it is based on; check it before you send." },
      // One card per company: the story is the linked headline, the opener sits under it, the company and date below.
      ...rows.map((r) => (r.url ? { label: r.title, url: r.url, text: r.line, caption: r.meta } : { label: r.d, text: r.text })),
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
