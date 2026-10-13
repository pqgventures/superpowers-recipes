// Superpowers recipe: competitor ad teardown. Finds each competitor's Meta Ad Library page, pulls their live ads,
// and writes a brief with cited ads, white space and three ad concepts. Same file runs on the server ("Try it") and locally.
export const recipe = {
  slug: "competitor-ad-teardown",
  order: 4,
  name: "Competitor ad teardown",
  description: "Pulls the live Facebook and Instagram ads of up to four competitors from the Meta Ad Library and writes a brief: what they run, the hooks that repeat, the longest-running ads, offers, white space and three ad concepts for you.",
  inputs: {
    competitors: { title: "Competitors", description: "Up to four brand names, separated by commas", example: "Liquid Death, Poppi", required: true, maxLength: 200 },
    product: { title: "Your product", description: "What you sell, in a few words", example: "a new prebiotic sparkling soda", required: true, maxLength: 200 },
    country: { title: "Country", description: "Two-letter country code where the ads run, or ALL", default: "US" },
  },
  uses: { "scrapecreators.meta-ad-advertisers": 2, "scrapecreators.meta-company-ads": 3, "openrouter.anthropic-claude-sonnet-5": 1 },
  share: { review: false },
};

const LLM = "openrouter.anthropic-claude-sonnet-5";
const PERSONAL = /personal blog|public figure|artist|musician|band|pet|fan page|community|blogger|digital creator|video creator|gamer/i;
// Exact name matches first, personal pages last, then most liked.
export function candidates(name, list) {
  const n = name.toLowerCase();
  const score = (a) => ((a.name ?? "").toLowerCase() === n ? 2 : 0) + (PERSONAL.test(a.category ?? "") ? 0 : 1);
  return [...list].sort((a, b) => score(b) - score(a) || (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 2);
}
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
export function adStats(ads) {
  const text = (a) => ((a.title ?? "") + " " + (a.body ?? "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const counts = (field) => Object.fromEntries([...new Set(ads.map((a) => a[field] || "unknown"))].map((v) => [v, ads.filter((a) => (a[field] || "unknown") === v).length]));
  return { sampled_ads: ads.length, prebiotic_mentions: ads.filter((a) => /prebiotic/.test(text(a))).length, destinations: counts("landing_domain"), formats: counts("format") };
}
const FIELDS = ["page_name", "library_url", "start_date", "days_running", "platforms", "format", "variants", "title", "body", "cta", "landing_domain"];

export async function run(sp, { competitors, product, country }) {
  const names = String(competitors).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (!names.length) throw new Error("Name at least one competitor");
  const cc = String(country || "US").toUpperCase();
  const brands = await Promise.all(names.map(async (name, i) => {
    const found = await sp.run("advertisers-" + i, "scrapecreators.meta-ad-advertisers", { query: name });
    // Only pages whose name starts with the requested brand; a typo should not turn into someone else's ads.
    const tries = candidates(name, (found.advertisers ?? []).filter((a) => norm(a.name).startsWith(norm(name))));
    if (!tries.length) return { name, page: null, total: 0, ads: [], note: "No Ad Library page matches \"" + name + "\". Check the spelling (for example Rothy's, not Roths)." };
    let best = null;
    for (const [k, page] of tries.entries()) {
      const ads = await sp.run("ads-" + i + "-" + k, "scrapecreators.meta-company-ads", { page_id: page.page_id, country: cc });
      // Runners pass normalized output ({ads}); the full output also has total. A full first page means there are more.
      const list = ads.ads ?? [];
      const found = { name, page: page.name + " (" + (page.category ?? "page") + ", id " + page.page_id + ")", total: ads.total ?? (list.length >= 30 ? "30+" : list.length), ads: list };
      // Keep the best-ranked page when no page has ads, so a brand is not reported under a regional page.
      if (!best || list.length) best = found;
      if (list.length) break;
    }
    return best;
  }));
  const data = Object.fromEntries(brands.map((b) => [b.name, { ad_library_page: b.page, note: b.note ?? null, active_ads_total: b.total, computed_counts: adStats(b.ads), ads: b.ads.map((a) => Object.fromEntries(FIELDS.map((f) => [f, a[f]]))) }]));
  const prompt = "You are a senior performance-marketing strategist. The reader is launching " + product + " (country: " + cc + "). Below is real data pulled today from the Meta Ad Library: each competitor's active ads (up to the 30 ads Meta shows first) and total active count.\n\n" +
    "Write a competitor ad teardown in Markdown. Rules: use only the data; cite every ad you mention as a markdown link to its library_url with its start date and days running; copy ad ids exactly; never invent spend, performance, counts or numbers; a long run only measures duration, never performance; use computed_counts unchanged; theme counts include translations and accented terms; scope every absence to the sampled ads; report competitors with no ads plainly; plain English.\n" +
    "Sections: 1. One-paragraph summary. 2. Table: brand | active ads | main formats | main CTA | where the clicks go | what that tells us. 3. Hooks and angles that repeat, 2-3 cited ads each. 4. Longest-running ads, five by duration, what they say. 5. Offers and retail strategy. 6. White space: 3 angles missing from this sample. 7. Three ad concepts for the reader: headline (max 7 words), primary text (max 2 sentences), format, CTA, which competitor ad it answers Concepts must not name competitors and must not promise prices, discounts, free shipping or other offers the reader has not stated.\nUnder 900 words.\n\nDATA:\n" + JSON.stringify(data);
  const brief = await sp.run("brief", LLM, { prompt, max_tokens: 3000 });
  const longest = brands.flatMap((b) => b.ads.map((a) => ({ ...a, brand: b.name }))).sort((a, b) => (b.days_running ?? 0) - (a.days_running ?? 0)).slice(0, 10);
  return {
    title: "Competitor ad teardown: " + names.join(", "),
    items: [
      { label: "Brief", text: textOf(brief) },
      { label: "Longest-running ads", text: longest.map((a) => a.brand + " · " + a.days_running + " days · " + (a.format ?? "") + " · " + (a.title || a.body || "").slice(0, 90) + "\n" + a.library_url).join("\n\n") || "No active ads found." },
      { label: "Ad counts", text: brands.map((b) => b.name + ": " + (b.note ?? b.total + " active ads in " + cc + " (page " + b.page + ")" + (b.ads.length ? "" : "; try country ALL"))).join("\n") },
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
