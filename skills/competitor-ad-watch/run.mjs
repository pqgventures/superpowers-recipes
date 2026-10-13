// Superpowers recipe: competitor ad watch. For each competitor, which Facebook/Instagram ads started and stopped in the last
// days, which ads Meta shows most, and a short note on what changed. Run it weekly. Same file runs on the server and locally.
export const recipe = {
  slug: "competitor-ad-watch",
  order: 8,
  name: "Competitor ad watch",
  description: "Name up to four competitors: see which Facebook and Instagram ads each one started and stopped in the last 7, 14 or 30 days, the ads Meta shows most, and a short note on what changed in their messaging. Run it every week.",
  inputs: {
    competitors: { title: "Competitors", description: "Up to four brand names, separated by commas", example: "Liquid Death, Poppi", required: true, maxLength: 200 },
    days: { title: "Window", description: "7, 14 or 30 days", default: "14" },
    country: { title: "Country", description: "Two-letter country code where the ads run, or ALL", default: "US" },
  },
  uses: { "scrapecreators.meta-ad-advertisers": 2, "scrapecreators.meta-company-ads": 12, "openrouter.openai-gpt-5.4-mini": 1 },
  share: { review: false },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const ADS = "scrapecreators.meta-company-ads";
// Page choice, same rule as competitor-ad-teardown: exact name first, personal pages last, then most liked.
const PERSONAL = /personal blog|public figure|artist|musician|band|pet|fan page|community|blogger|digital creator|video creator|gamer/i;
const key = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function candidates(name, list) {
  const n = key(name);
  const score = (a) => (key(a.name) === n ? 2 : 0) + (PERSONAL.test(a.category ?? "") ? 0 : 1);
  return list.filter((a) => key(a.name).startsWith(n)).sort((a, b) => score(b) - score(a) || (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 2);
}
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
export const json = (s) => JSON.parse(String(s).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
const slim = (a) => ({ start: a.start_date, end: a.is_active ? null : a.end_date, days: a.days_running, format: a.format, title: String(a.title ?? "").slice(0, 100), body: String(a.body ?? "").slice(0, 180), cta: a.cta });

// New ads grouped by headline: many versions of one line means the brand is testing it hard.
export function headlines(ads) {
  const g = new Map();
  for (const a of ads) {
    const t = String(a.title || a.body || "").replace(/\s+/g, " ").trim().slice(0, 90); if (!t) continue;
    const k = t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const e = g.get(k) ?? { headline: t, versions: 0, newest: "" }; e.versions++; if ((a.start_date ?? "") > e.newest) e.newest = a.start_date; g.set(k, e);
  }
  return [...g.values()].filter((e) => e.versions > 1).sort((a, b) => b.versions - a.versions).slice(0, 5);
}
export async function watch(sp, name, i, cc, since) {
  const found = await sp.run("pages-" + i, "scrapecreators.meta-ad-advertisers", { query: name });
  const tries = candidates(name, found.advertisers ?? []);
  if (!tries.length) return { name, note: "No Ad Library page matches \"" + name + "\"; check the spelling." };
  let page = null, top = null;
  for (const [k, p] of tries.entries()) {
    const r = await sp.run("top-" + i + "-" + k, ADS, { page_id: p.page_id, country: cc, sort: "impressions" });
    if (!page || (r.ads ?? []).length) { page = p; top = r; }
    if ((r.ads ?? []).length) break;
  }
  // Newest first, page until the ads start before the window (at most 4 pages).
  const recent = []; let cursor; let complete = true;
  for (let pg = 0; pg < 4; pg++) {
    const r = await sp.run("recent-" + i + "-" + pg, ADS, { page_id: page.page_id, country: cc, sort: "recent", ...(cursor ? { cursor } : {}) });
    const ads = r.ads ?? []; recent.push(...ads); cursor = r.next_cursor;
    if (!cursor || !ads.length || ads.some((a) => a.start_date && a.start_date < since)) break;
    if (pg === 3) complete = false;
  }
  const ended = await sp.run("ended-" + i, ADS, { page_id: page.page_id, country: cc, status: "INACTIVE", sort: "recent" });
  const seen = new Set();
  const started = recent.filter((a) => a.start_date && a.start_date >= since && !seen.has(a.ad_archive_id) && seen.add(a.ad_archive_id));
  const stopped = (ended.ads ?? []).filter((a) => a.end_date && a.end_date >= since);
  return { name, page: page.name + " (" + (page.category ?? "page") + ")", active: top.total ?? (top.ads ?? []).length, started, startedComplete: complete, stopped, top: (top.ads ?? []).slice(0, 3), tested: headlines(started) };
}

export async function run(sp, { competitors, days, country }) {
  const names = String(competitors).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (!names.length) throw new Error("Name at least one competitor");
  const win = [7, 14, 30].includes(Number(days)) ? Number(days) : 14;
  const cc = String(country || "US").toUpperCase();
  const today = new Date(); const since = new Date(today.getTime() - win * 864e5).toISOString().slice(0, 10);
  const brands = [];
  for (const [i, n] of names.entries()) brands.push(await watch(sp, n, i, cc, since));
  // The model cites refs; code turns them into Ad Library links. Counts come from code.
  const refs = {}; let k = 0;
  const tag = (a) => { const r = "A" + ++k; refs[r] = a; return { ref: r, ...slim(a) }; };
  const facts = Object.fromEntries(brands.map((b) => [b.name, b.note ? { note: b.note } : { started: b.started.slice(0, 25).map(tag), stopped: b.stopped.slice(0, 10).map(tag), shown_most: b.top.map(tag), most_tested_headlines: b.tested }]));
  const counts = Object.fromEntries(brands.map((b) => [b.name, b.note ? { found: false } : { active_now: b.active, started: b.started.length + (b.startedComplete ? "" : "+"), stopped: b.stopped.length }]));
  const res = await sp.run("note", LLM, { max_tokens: 1800, prompt:
    "You write a weekly competitor ad watch for a marketer. Window: the last " + win + " days (since " + since + "), country " + cc + ". COUNTS are computed in code; use them as given and never compute your own.\n" +
    "Reply only JSON {\"summary\": one paragraph, \"brands\": {brand: Markdown under 120 words: what they launched (themes, formats, offers), which headlines they repeat most (by number of versions, as given), what stopped, what the most-shown ads push}}. Cite ads only as their ref in square brackets like [A3]; never write ids, links or field names; never use quotation marks; say plainly when a brand launched or stopped nothing; never guess spend or results.\n\nCOUNTS:\n" + JSON.stringify(counts) + "\nADS:\n" + JSON.stringify(facts) });
  let o; try { o = json(textOf(res)); } catch { o = { summary: textOf(res), brands: {} }; }
  // Share pages show plain text, so cite ads by format and date here; their links are in the lists below.
  const cite = (_, r) => (refs[r] ? "(" + String(refs[r].format ?? "ad").toLowerCase() + " ad, " + refs[r].start_date + ")" : "");
  const L = (t) => String(t ?? "").replace(/\]\s*\[A/g, "], [A").replace(/\[(A\d+)\](,\s*)?/g, cite).replace(/\)\(/g, ", ").replace(/\s+([.,])/g, "$1");
  const table = brands.map((b) => b.note ? b.name + ": no Ad Library page found" : b.name + ": " + b.active + " ads running, " + counts[b.name].started + " started and " + b.stopped.length + " stopped in the last " + win + " days").join("\n");
  const list = (ads) => ads.map((a) => a.start_date + (a.end_date && !a.is_active ? " to " + a.end_date : "") + " · " + (a.format ?? "") + " · " + String(a.title || a.body || "").replace(/\s+/g, " ").slice(0, 90) + "\n" + a.library_url).join("\n\n");
  return {
    title: "Competitor ad watch: " + names.join(", ") + " (last " + win + " days, " + cc + ")",
    items: [
      { label: "Summary", text: L(o.summary) + "\n\n" + table },
      ...brands.map((b) => ({ label: b.name, text: b.note ?? (L(o.brands?.[b.name]) + "\n\nPage: " + b.page) })),
      ...brands.filter((b) => !b.note && b.tested.length).map((b) => ({ label: b.name + ": headlines they repeat most", text: b.tested.map((h) => h.versions + " versions: " + h.headline + " (newest " + h.newest + ")").join("\n") })),
      ...brands.filter((b) => !b.note && b.started.length).map((b) => ({ label: b.name + ": started in the window", text: list(b.started.slice(0, 15)) })),
      ...brands.filter((b) => !b.note && b.stopped.length).map((b) => ({ label: b.name + ": stopped in the window", text: list(b.stopped) })),
      ...brands.filter((b) => !b.note && b.top.length).map((b) => ({ label: b.name + ": ads Meta shows most", text: list(b.top) })),
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
