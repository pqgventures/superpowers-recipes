// Superpowers recipe: an SEO and AI-search report for a website.
// For each keyword: where the site ranks on Google and who ranks above it, whether Google's AI Overview names the brand;
// then how often AI assistants (with web search) mention the brand against competitors, monthly search volume and cost per click
// for each search, backlink profiles for the site and up to two competitors, and two page audits. Volume and backlinks are skipped,
// and the report says so, when those tools are not available.
export const recipe = {
  slug: "seo-geo-report",
  order: 9,
  name: "SEO and AI-search report for your website",
  description: "Give your website and the searches that matter; get where you rank on Google and who beats you, how many people search each term and what a click costs, your backlinks against competitors, whether Google's AI Overview and AI assistants mention you, your share of voice, and what to fix on your homepage.",
  inputs: {
    site: { title: "Website", description: "e.g. posthog.com", example: "posthog.com", required: true, maxLength: 120 },
    brand: { title: "Brand name", description: "How people write it", example: "PostHog", required: true, maxLength: 60 },
    keywords: { title: "Searches", description: "Up to 5 searches your buyers type, separated by commas", example: "product analytics tool, session replay software, feature flags tool", required: true, maxLength: 400 },
    competitors: { title: "Competitors (optional)", description: "Up to 5 competitor websites, separated by commas", example: "amplitude.com, mixpanel.com" },
    country: { title: "Country", description: "Two-letter country for Google", default: "us" },
  },
  // Volume and backlinks come from DataForSEO; Trackee is tried only when a DataForSEO call fails, so it is not listed here.
  uses: { "litescrape.google-search": 5, "litescrape.google-ai-overview": 5, "aeo.visibility": 1, "seoaudit.page": 1, "aeoaudit.page": 1, "dataforseo.keyword-volume": 1, "dataforseo.backlinks": 3 },
  share: { review: false },
};

export function host(v) {
  const d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
  return /^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(d) ? d : "";
}
const COUNTRY = { us: "United States", gb: "United Kingdom", br: "Brazil", ca: "Canada", au: "Australia", de: "Germany", fr: "France", es: "Spain", it: "Italy", mx: "Mexico", in: "India", pt: "Portugal" };
const onSite = (url, site) => { const h = host(url); return h === site || h.endsWith("." + site); };
export function mentions(text, brand, site) {
  const t = String(text || "").toLowerCase();
  return t.includes(brand.toLowerCase()) || t.includes(site);
}
function sentenceWith(text, brand) {
  const s = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+|\n|- /).find((x) => x.toLowerCase().includes(brand.toLowerCase()));
  return s ? s.trim().slice(0, 240) : "";
}

export async function run(sp, { site, brand, keywords, competitors, country }) {
  // First tool that answers wins; a failed call is not charged, so trying the fallback costs nothing extra.
  const firstOf = async (id, attempts) => { for (const [n, [tool, input]] of attempts.entries()) { try { return await sp.run(n ? id + "-alt" : id, tool, input); } catch {} } return null; };
  const d = host(site); if (!d) throw new Error("Give the website, e.g. posthog.com");
  const name = String(brand || "").trim(); if (name.length < 2) throw new Error("Give the brand name");
  const kws = [...new Set(String(keywords || "").split(",").map((k) => k.trim()).filter((k) => k.length >= 3))].slice(0, 5);
  if (!kws.length) throw new Error("Give at least one search, e.g. product analytics tool");
  const comps = String(competitors || "").split(",").map(host).filter(Boolean).filter((c) => c !== d).slice(0, 5);
  const gl = /^[a-z]{2}$/i.test(String(country || "us")) ? String(country || "us").toLowerCase() : "us";

  const rows = [];
  for (const [i, k] of kws.entries()) {
    const [serp, aio] = await Promise.all([
      sp.run("rank-" + i, "litescrape.google-search", { q: k, gl, hl: "en" }),
      sp.run("aio-" + i, "litescrape.google-ai-overview", { q: k, gl, hl: "en" }).catch(() => ({ shown: false })),
    ]);
    const organic = serp.organic || [];
    const mine = organic.findIndex((o) => onSite(o.url, d));
    const above = organic.slice(0, mine >= 0 ? mine : 3).map((o) => host(o.url)).filter(Boolean);
    const cited = (aio.sources || []).some((s) => onSite(s.url || s.link || s, d));
    rows.push({ k, position: mine >= 0 ? mine + 1 : null, of: organic.length, above, aio: !!aio.shown, named: aio.shown ? mentions(aio.text, name, d) : false, cited, quote: aio.shown ? sentenceWith(aio.text, name) : "" });
  }
  const questions = kws.slice(0, 3).map((k) => "What is the best " + k + "?");
  const vis = await sp.run("assistants", "aeo.visibility", { brand: name, domain: d, questions, ...(comps.length ? { competitors: comps.map((c) => ({ name: c.split(".")[0].replace(/^./, (x) => x.toUpperCase()), domain: c })) } : {}) });
  const [seo, aeo, vol, ...links] = await Promise.all([
    sp.run("seo-audit", "seoaudit.page", { url: "https://" + d + "/" }).catch(() => null),
    sp.run("ai-audit", "aeoaudit.page", { url: "https://" + d + "/" }).catch(() => null),
    firstOf("volume", [["dataforseo.keyword-volume", { keywords: kws, country: gl, language: "en" }], ["trackee.keyword-volume", { keywords: kws, ...(gl === "us" ? {} : { location: COUNTRY[gl] || "United States" }) }]]),
    ...[d, ...comps.slice(0, 2)].map((x, i) => firstOf("links-" + i, [["dataforseo.backlinks", { domain: x }], ["trackee.backlinks", { domain: x }]])),
  ]);
  const volBy = new Map((vol?.keywords || []).map((k) => [String(k.keyword).toLowerCase(), k]));
  const fmt = (n) => (n == null ? "?" : Number(n).toLocaleString("en-US"));
  const demand = kws.map((k) => { const v = volBy.get(k.toLowerCase()); const cpc = v?.cpc_usd ?? v?.cpc; return v ? k + ": " + fmt(v.volume) + " searches a month" + (cpc != null ? ", $" + Number(cpc).toFixed(2) + " a click" : "") + (v.competition ? ", " + String(v.competition).toLowerCase() + " competition" : "") : k + ": no volume data"; });
  const linkRows = links.map((l) => l?.profile).filter(Boolean).map((p) => p.domain + ": " + fmt(p.referring_domains) + " sites link to it (" + fmt(p.backlinks) + " links)" + (p.rank != null ? ", authority " + p.rank + "/1000" : ""));

  const ranked = rows.filter((r) => r.position);
  const named = rows.filter((r) => r.named);
  const s = vis.summary || {};
  const sov = (vis.share_of_voice || []).map((x) => x.name + ": named in " + x.answers_mentioning + " of " + (s.answers ?? "?") + " answers (" + x.share_of_voice_pct + "% share of voice)");
  const issues = (seo?.issues || []).slice(0, 5).map((x) => x.finding + " — " + x.fix);
  const aiFindings = (aeo?.findings || []).slice(0, 4).map((x) => x.finding || x.title || JSON.stringify(x).slice(0, 160));
  return {
    title: name + ": SEO and AI-search report",
    items: [
      { label: "In one line", text: name + " is on Google's first page for " + ranked.length + " of " + rows.length + " searches, and Google's AI Overview names it for " + named.length + " of " + rows.length + ". AI assistants with web search named it in " + (s.visibility_pct ?? "?") + "% of answers." },
      { label: "Google rankings", text: rows.map((r) => r.k + ": " + (r.position ? "#" + r.position : "not on the first page (" + r.of + " results checked)") + (r.above.length ? "; above you: " + r.above.join(", ") : "")).join("\n") },
      { label: "Google AI Overview", text: rows.map((r) => r.k + ": " + (!r.aio ? "no AI Overview shown" : r.named ? "names " + name + (r.cited ? " and links your site" : "") + (r.quote ? " — \"" + r.quote + "\"" : "") : "does not name " + name)).join("\n") },
      { label: "AI assistants", text: (sov.join("\n") || "No answers") + "\nAssistants asked: " + (vis.by_assistant || []).map((a) => a.label + " " + a.mentioned + "/" + a.answers).join(", ") + (vis.report_url ? "\nFull answers: " + vis.report_url : "") },
      { label: "Search demand", text: vol ? demand.join("\n") : "Not available for this run." },
      { label: "Backlinks", text: linkRows.length ? linkRows.join("\n") : "Not available for this run." },
      { label: "Homepage fixes", text: [seo ? "SEO audit " + seo.score + "/100" : "", ...issues, aeo ? "AI-search readiness " + aeo.score + "/100" : "", ...aiFindings].filter(Boolean).join("\n") || "Audit unavailable" },
      ...(!vol || !linkRows.length ? [{ label: "Not in this report yet", text: [!vol ? "Monthly search volume and cost per click" : "", !linkRows.length ? "backlinks" : ""].filter(Boolean).join(" and ") + " were not available for this run." }] : []),
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
