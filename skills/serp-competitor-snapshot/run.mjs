// Superpowers recipe: who ranks for a keyword on Google, and what each top page leads with.
// Searches Google in the country and language asked for, reads the top pages and returns each one's title and opening
// text with its link. Under 1¢ a run. Was the "serp-competitor-snapshot" job; POST /v1/jobs/serp-competitor-snapshot
// still runs this recipe (src/jobs.ts) and returns result.data as the job's output.
export const recipe = {
  slug: "serp-competitor-snapshot",
  order: 17,
  name: "Who ranks for your keyword",
  description: "Searches Google for a keyword in your country and language, opens the top 3 to 5 pages and returns each one's headline and the text it leads with, linked, so you see how every competitor pitches itself.",
  inputs: {
    keyword: { title: "Keyword", description: "What your customers type into Google", example: "marketing agency", required: true, maxLength: 120 },
    country: { title: "Country", description: "Two-letter code, like us, br or gb", default: "us", maxLength: 2 },
    language: { title: "Language", description: "Two-letter code, like en or pt", default: "en", maxLength: 5 },
    top: { title: "Pages to read", description: "How many top results to open, 1 to 5", default: "3", maxLength: 1, hidden: true },
  },
  uses: { "serper.google-search": 1, "jina.reader": 3 },
  share: { review: false },
};

// Page titles sometimes arrive HTML-escaped (Ag&ecirc;ncia): decode numeric and the common named entities.
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", ordm: "º", ordf: "ª", ccedil: "ç", Ccedil: "Ç" };
const ACCENT = { acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", uml: "\u0308" };
export const decode = (s) => String(s ?? "").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : +n))
  .replace(/&([A-Za-z])(acute|grave|circ|tilde|uml);/g, (_, l, a) => (l + ACCENT[a]).normalize("NFC")).replace(/&([a-zA-Z]+);/g, (m, n) => NAMED[n] ?? m);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
// Bot checks and error pages say nothing about the competitor: keep the search snippet instead (as local-competitor-map).
export const BLOCKED = /robot challenge|just a moment|attention required|access denied|verify you are (a )?human|captcha|are you a robot|403 forbidden|404 not found|page not found/i;
// The opening of a page as plain text: images and link targets dropped, markdown marks and skip links removed, whitespace collapsed.
export const opening = (md, n = 420) => {
  const t = decode(md).replace(/\[?(skip to (main )?content|pular para o conte[uú]do|ir para o conte[uú]do|saltar al contenido)\]?(\([^)]*\))?/gi, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_\x60|]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
};

export async function run(sp, { keyword, country, language, top }) {
  const k = Math.min(Math.max(parseInt(top, 10) || 3, 1), 5);
  const s = await sp.run("search", "serper.google-search", { query: keyword, country: country || "us", language: language || "en", num: 10 });
  const hits = (s.results ?? []).slice(0, k);
  if (!hits.length) throw new Error("Google returned no results for " + JSON.stringify(keyword));
  const ranking = await Promise.all(hits.map(async (r, i) => {
    try { const p = await sp.run("page-" + (i + 1), "jina.reader", { url: r.url });
      if (BLOCKED.test(String(p.title ?? "") + " " + String(p.markdown ?? "").slice(0, 400))) return { ...r, domain: host(r.url), error: "the page showed a bot check" };
      return { ...r, domain: host(r.url), title: decode(p.title || r.title), excerpt: String(p.markdown ?? "").slice(0, 1500) }; }
    catch (e) { return { ...r, domain: host(r.url), error: e.message }; }
  }));
  return {
    title: "Who ranks for “" + keyword + "” (" + String(country || "us").toUpperCase() + ")",
    items: ranking.map((p) => ({ kind: "link", url: p.url, label: "#" + p.position + " " + p.domain,
      text: (p.title ? p.title + "\n\n" : "") + (p.error ? "Could not read this page; the search snippet: " + (p.snippet ?? "") : opening(p.excerpt) || p.snippet || "") })),
    data: { keyword, ranking },
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
