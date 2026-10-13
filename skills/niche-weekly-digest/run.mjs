// Superpowers recipe: the week's stories in your niche, ranked by how many outlets covered them, with real links and ledes.
// No model call: searches recent news for each topic, groups articles about the same story, ranks stories by the number of
// different outlets that covered them, then finds each story's original article (link and opening lines).
// The agent writes the newsletter from this material in the reader's voice.
export const recipe = {
  slug: "niche-weekly-digest",
  order: 16,
  name: "This week's stories in your niche, ready for your newsletter",
  description: "Name your niche and the topics your readers care about. Get the week's stories ranked by how many outlets covered them, each with the original article link, the date and its opening lines, so your newsletter writes itself.",
  inputs: {
    niche: { title: "Your niche", description: "What your newsletter is about, e.g. ecommerce, fintech, coffee shops", example: "ecommerce", required: true, maxLength: 80 },
    topics: { title: "Topics to watch (optional)", description: "Up to 5 searches, separated by commas, e.g. Shopify, TikTok Shop, Meta ads", example: "Shopify merchants, ecommerce marketing, TikTok Shop sellers", maxLength: 400 },
    days: { title: "Days back", description: "How recent a story must be, 1 to 30", default: "7" },
    stories: { title: "How many stories", description: "3 to 12", default: "10" },
  },
  uses: { "search1api.news": 5, "exa.search": 12, "firecrawl.scrape": 12 },
  share: { review: false },
};

const STOP = new Set("the a an and or of to in on for with from by at as is are was were be been its it this that these those how why what who your you our we they their his her new says said after over into about than more most will can could would should may just now amid via vs us up out not no all any has have had top best 2026 2025".split(" "));
const WIRES = /pr ?newswire|globe ?newswire|business ?wire|ein ?presswire|access ?newswire|newsfile|accesswire|openpr|prweb|newswire|presswire|prwire|pressreleases?/i;
// Pages that are not news: listicles, paid placements and price pages. They are counted and left out.
const NOT_NEWS = /^\d+ (best|top)\b|\bbest .{0,40}\b(tools?|agencies|platforms?|apps|software)\b|\bis the (top|best|leading)\b|\bnames .{0,60} the best\b|\bprice, .{0,40}charts\b|\bmarket ?cap\b|\bcoupon|promo code|\bguide\b.*\b20\d\d\b|\b20\d\d guide\b|\(20\d\d\)$/i;
const INVESTOR = /\((NYSE:|NASDAQ:|TSX:)?[A-Z]{2,5}\)|\b[Ss]tocks?\b|\b[Ss]hares (rise|fall|jump|drop|slide|climb)|\b[Pp]rice [Tt]arget\b|\b[Ii]nvestment [Ss]tory\b|\b[Bb]uy [Rr]ating\b|\b[Vv]aluation\b/;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const when = (d) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? MON[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10)) : "date unknown");
export function splitTitle(t) {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  const i = s.lastIndexOf(" - ");
  if (i <= 15) return { headline: s, outlet: "" };
  // Some feeds add the publication twice ("Headline - Puget Sound Business Journal - The Business Journals").
  const head = s.slice(0, i).trim().replace(/\s+-\s+[^-]{3,60}\b(Journal|News|Times|Post|Daily|Magazine|Herald|Tribune|Report|Review|Today|Wire)$/, "");
  return { headline: head, outlet: s.slice(i + 3).trim() };
}
export function words(s, skip = new Set()) {
  return new Set(String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']s\b/g, "").split(/[^a-z0-9$%]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !skip.has(w)));
}
// Same story: three shared words (at least one outside the niche and topics) covering half the shorter headline,
// or two shared words when one of them is a name the week's news keeps repeating (Chipotle in "Starbucks eyes Chipotle").
export function same(a, b, skip = new Set(), hot = new Set()) {
  let n = 0, rare = 0, named = 0; for (const w of a) if (b.has(w)) { n++; if (!skip.has(w)) rare++; if (hot.has(w)) named++; }
  return (n >= 3 && rare >= 1 && n / Math.min(a.size, b.size) >= 0.5) || (n >= 2 && named >= 1);
}
export function topicsOf(niche, topics) {
  const list = String(topics || "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const out = list.length ? list : [String(niche).trim() + " news", String(niche).trim() + " industry"];
  if (out.length > 5) throw new Error("Up to 5 topics per run");
  return out;
}
export function cluster(articles, skip, hot = new Set()) {
  const groups = [];
  for (const a of articles) {
    const w = words(a.headline);
    if (w.size < 2) continue;
    const g = groups.find((g) => g.articles.some((x) => same(x.words, w, skip, hot)));
    a.words = w;
    if (g) g.articles.push(a); else groups.push({ articles: [a] });
  }
  for (const g of groups) {
    const outlets = [...new Set(g.articles.map((a) => a.outlet).filter(Boolean))];
    g.outlets = outlets;
    g.wire = g.articles.every((a) => WIRES.test(a.outlet));
    g.investor = g.articles.every((a) => INVESTOR.test(a.headline));
    g.first = g.articles.map((a) => a.published).filter(Boolean).sort()[0] || "";
    g.lead = g.articles.find((a) => !WIRES.test(a.outlet)) || g.articles[0];
  }
  return groups.sort((a, b) => (a.wire - b.wire) || (a.investor - b.investor) || (b.outlets.length - a.outlets.length) || String(b.first).localeCompare(String(a.first)));
}
export const clip = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "").replace(/[,;:]$/, "") + "…" : s);
// The article's opening lines: the first prose paragraphs after its headline, without links, images or menus.
export function opening(markdown, headline) {
  const lines = String(markdown || "").split(/\n+/).map((l) => l.trim());
  const key = String(headline || "").toLowerCase().slice(0, 30);
  let start = lines.findIndex((l) => /^#/.test(l) && l.toLowerCase().includes(key));
  if (start < 0) start = lines.findIndex((l) => l.toLowerCase().includes(key));
  const out = [];
  for (const raw of lines.slice(Math.max(0, start + 1))) {
    if (/^[!\[#\-*|>]/.test(raw) || /^\d+\.\s/.test(raw)) continue;
    const l = raw.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_]{1,2}/g, "").replace(/\s+/g, " ").trim();
    if (l.length < 80 || !/[.!?”"]$/.test(l) || /(\.\.\.|…)$/.test(l) || /cookie|subscribe|sign up|newsletter|advertis|all rights reserved/i.test(l) || /^(in this (photo )?illustration|photo:|image:|credit:|getty)/i.test(l) || /^(get|sign up|join|subscribe|download|follow us|read more|click)\b|without having to browse/i.test(l)) continue;
    out.push(l);
    if (out.join(" ").length > 150) break;
  }
  return clip(out.join(" "), 320);
}

export async function run(sp, { niche, topics, days, stories }) {
  if (!niche || !String(niche).trim()) throw new Error("Name your niche, e.g. ecommerce");
  const list = topicsOf(niche, topics);
  const nd = Math.min(30, Math.max(1, Math.round(Number(days) || 7)));
  const want = Math.min(12, Math.max(3, Math.round(Number(stories) || 10)));
  const since = new Date(Date.now() - nd * 864e5).toISOString().slice(0, 10);
  const range = nd <= 1 ? "day" : nd <= 7 ? "week" : "month";
  const seen = new Set(), articles = [];
  let fetched = 0, dropped = 0;
  for (const [i, q] of list.entries()) {
    const r = await sp.run("news-" + (i + 1), "search1api.news", { query: q, time_range: range, max_results: 20 }).catch(() => null);
    for (const x of r?.results || []) {
      fetched++;
      const { headline, outlet } = splitTitle(x.title);
      const key = headline.toLowerCase() + "|" + outlet.toLowerCase();
      if (!headline || seen.has(key)) continue;
      seen.add(key);
      if (x.published && x.published.slice(0, 10) < since) continue;
      if (NOT_NEWS.test(headline) || WIRES.test(outlet)) { dropped++; continue; }
      articles.push({ headline, outlet, published: x.published || "", url: x.url, topic: q });
    }
  }
  const df = new Map(); for (const a of articles) for (const w of words(a.headline)) df.set(w, (df.get(w) || 0) + 1);
  const skip = new Set([...words(niche), ...list.flatMap((t) => [...words(t)])]);
  // Names repeated across the week's headlines (capitalized, in 3+ articles, not a niche or topic word).
  const caps = new Set(articles.flatMap((a) => (a.headline.match(/\b[A-Z][A-Za-z]{2,}/g) || []).map((x) => x.toLowerCase())));
  const hot = new Set([...df].filter(([w, n]) => n >= 3 && caps.has(w) && !skip.has(w) && !STOP.has(w)).map(([w]) => w));
  if (!articles.length) throw new Error("No news found for these topics in the last " + nd + " days. Try broader topics.");
  const groups = cluster(articles, skip, hot).slice(0, want);
  const items = [];
  for (const [i, g] of groups.entries()) {
    const r = await sp.run("find-" + (i + 1), "exa.search", { query: g.lead.headline, num: 3 }).catch(() => null);
    const hw = words(g.lead.headline);
    const hit = (r?.results || []).find((x) => x.url && !/news\.google\./.test(x.url) && same(words(x.title), hw));
    if (hit && WIRES.test(hit.url)) g.wire = true;
    g.url = hit?.url || g.lead.url;
    g.lede = "";
    if (hit) {
      const page = await sp.run("read-" + (i + 1), "firecrawl.scrape", { url: hit.url }).catch(() => null);
      g.lede = opening(page?.markdown, hit.title.replace(/\s+[|–-]\s+[^|–-]+$/, "")) || opening(page?.markdown, g.lead.headline);
    }
  }
  const multi = groups.filter((g) => g.outlets.length > 1).length;
  const lo = articles.map((a) => a.published).filter(Boolean).sort()[0];
  const range2 = lo ? when(lo) + " to " + when(new Date().toISOString()) : "the last " + nd + " days";
  items.push({ label: "In short", text: groups.length + " stories from " + articles.length + " articles published " + range2 + ". " + (multi ? multi + " were covered by more than one outlet, the top one by " + groups[0].outlets.length + "." : "Each was covered by one outlet.") + (dropped ? " Left out " + dropped + " " + (dropped === 1 ? "listicle, press release or price page" : "listicles, press releases and price pages") + "." : "") });
  for (const g of groups) {
    const o = g.outlets;
    const cover = o.length > 2 ? o.length + " outlets: " + o.slice(0, 3).join(", ") + (o.length > 3 ? " +" + (o.length - 3) : "") : o.join(" and ") || "One outlet";
    const tag = g.wire ? "Press release" : g.investor ? "Investor news" : "";
    // A link item: the share page shows the headline as a link, the opening lines under it, then outlets and date.
    items.push({ label: g.lead.headline, url: g.url, ...(g.lede ? { text: g.lede } : {}), caption: [tag, cover, when(g.first)].filter(Boolean).join(" · ") });
  }
  items.push({ label: "How to use it", text: "Pick the 5 to 8 stories your readers would forward. Open each link before you write, say in one line why it matters to them, and keep the outlet name next to the link. Outlet counts come from one news search, so they show which stories spread, not exact totals." });
  return { title: "This week in " + niche + ": " + groups.length + " stories", items };
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
