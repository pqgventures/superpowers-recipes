// Superpowers recipe: local competitor map. Finds the nearest competitors of a local business on Google Maps,
// reads each homepage, computes the numbers in code and writes a positioning brief. Same file runs on the server ("Try it") and locally.
export const recipe = {
  slug: "local-competitor-map",
  order: 6,
  name: "Local competitor map",
  description: "Give your business name, what it is and the city: get the 15 nearest competitors on Google Maps with distance, rating and reviews, what each homepage leads with and whether it takes online bookings, then a brief with where you stand, three positioning angles and three quick wins.",
  inputs: {
    business: { title: "Your business", description: "Its name as it appears on Google Maps", example: "Smile Haus Austin", required: true, maxLength: 120 },
    kind: { title: "What it is", description: "The Google Maps search a customer would type, like dentist, med spa or gym", example: "dentist", required: true, maxLength: 60 },
    city: { title: "City", description: "City and state or country", example: "Austin, TX", required: true, maxLength: 80 },
  },
  uses: { "serper.google-places": 5, "photon.geocode": 17, "jina.reader": 16, "firecrawl.scrape": 4, "openrouter.anthropic-claude-sonnet-5": 1 },
  share: { review: false },
};

const LLM = "openrouter.anthropic-claude-sonnet-5";
const MAX = 15;
// Homepage signals, matched on the page text. Each one is reported only when the words are on the page.
export const SIGNALS = [
  ["free consultation", /free (consult|estimate|assessment|trial|class)/i],
  ["new customer offer", /new (patient|client|customer|member)s? (special|offer|deal)/i],
  ["insurance", /insurance/i],
  ["financing", /financing|payment plan|carecredit|affirm|klarna/i],
  ["membership plan", /membership|in-house plan|savings plan/i],
  ["Spanish spoken", /se habla espa|hablamos espa|spanish/i],
  ["awards or 'best of'", /award|best of|voted|top[- ]rated/i],
  ["guarantee", /guarantee/i],
];
export const BOOKING = /\b(?:book (?:now|online|(?:(?:an?|your) )?(?:appointment|visit|consultation))|schedule (?:with us|(?:(?:an?|your) )?(?:appointment|visit|consultation|online))|reserve (?:(?:an?|your) )?(?:appointment|visit|consultation)|request (?:(?:an?|your) )?appointment)\b/i;
const key = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
// Plain words from a markdown heading: links become their text, emphasis marks go.
export const plain = (s) => String(s ?? "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
// Geocoded points farther than this from the city are wrong matches (the free geocoder can land in another state).
const RADIUS_KM = 50;
// Bot checks and error pages say nothing about the business; treat them as unread.
export const BLOCKED = /robot challenge|just a moment|attention required|access denied|verify you are (a )?human|captcha|are you a robot|403 forbidden|404 not found|page not found|site not found|domain (is )?for sale/i;
export function km(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2); };
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? r?.output_text ?? "").trim();
// Run fn over items with at most n in flight (the free geocoder asks for light traffic).
export async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

export async function run(sp, { business, kind, city }) {
  const searches = [kind, "best " + kind, "top rated " + kind, kind + " near " + business];
  const found = [];
  for (const [i, q] of searches.entries()) {
    const r = await sp.run("places-" + i, "serper.google-places", { query: q, location: city });
    found.push(...(r.places ?? []));
  }
  const seen = new Set(); let places = [];
  for (const p of found) { const k = p.cid ?? key(p.name) + key(p.address); if (!seen.has(k)) { seen.add(k); places.push(p); } }
  let me = places.find((p) => key(p.name) && (key(p.name).includes(key(business)) || key(business).includes(key(p.name))));
  if (!me) {
    const r = await sp.run("places-you", "serper.google-places", { query: business, location: city });
    // Only a place that shares a word with the name asked for; never someone else's business.
    const words = String(business).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    me = (r.places ?? []).find((p) => words.some((w) => String(p.name ?? "").toLowerCase().includes(w)));
    if (!me) throw new Error("Could not find \"" + business + "\" on Google Maps in " + city + ". Use the name exactly as on Maps.");
    places.push(me);
  }
  // Other locations of the same business (same website) are not competitors.
  const myHost = host(me.website);
  places = places.filter((p) => p === me || !myHost || host(p.website) !== myHost).slice(0, 40);
  // Coordinates: from the places result when present, otherwise geocoded from the address (OpenStreetMap, free),
  // keeping only a match within RADIUS_KM of the city so a same-named street elsewhere is not used.
  let center = null;
  try { const c = (await sp.run("geo-city", "photon.geocode", { query: city, limit: 1 })).results?.[0]; if (c) center = { lat: c.lat, lng: c.lon }; } catch {}
  // Without a city point, measure from the business itself when the places result gave its coordinates.
  if (!center && me.latitude != null && me.longitude != null) center = { lat: +me.latitude, lng: +me.longitude };
  const near = (pt) => !center || km(center, pt) <= RADIUS_KM;
  const geo = async (p, i) => {
    const la = p.latitude ?? p.lat, lo = p.longitude ?? p.lng ?? p.lon;
    if (la != null && lo != null) { const pt = { lat: +la, lng: +lo }; return near(pt) ? pt : null; }
    if (!p.address) return null;
    const street = String(p.address).replace(/\s*(#|(ste|suite|unit|bldg|building)\.?\s*)[\w-]+,?/i, ",").replace(/,\s*,/g, ",");
    try {
      const r = await sp.run("geo-" + i, "photon.geocode", { query: street + (street.includes(",") ? "" : ", " + city), limit: 3 });
      const g = (r.results ?? []).map((x) => ({ lat: x.lat, lng: x.lon })).find(near);
      return g ?? null;
    } catch { return null; }
  };
  const coords = await pool(places, 2, geo);
  places.forEach((p, i) => { p.at = coords[i]; });
  if (!me.at) throw new Error("Could not place \"" + me.name + "\" on the map from its address (" + me.address + ").");
  const comps = places.filter((p) => p !== me && p.at).map((p) => ({ ...p, km: +km(me.at, p.at).toFixed(2) })).sort((a, b) => a.km - b.km).slice(0, MAX);
  me.km = 0;
  // Jina first (cheap); Firecrawl renders the page and often gets past bot checks, so it is the fallback.
  const page = async (tool, sid, url) => {
    try {
      const r = await sp.run(sid, tool, { url });
      const md = String(r.markdown ?? r.content ?? r.text ?? "");
      const h1 = plain((md.match(/^#\s+(.+)$/m) ?? [])[1]);
      if (BLOCKED.test(plain(r.title) + " " + h1) || md.length < 200) return null;
      return { title: plain(r.title).slice(0, 160) || null, h1: h1 ? h1.slice(0, 160) : null, online_booking: BOOKING.test(md), mentions: SIGNALS.filter(([, re]) => re.test(plain(md))).map(([n]) => n) };
    } catch { return null; }
  };
  const read = async (p, i) => {
    if (!p.website) return { site: "no website listed" };
    return (await page("jina.reader", "site-" + i, p.website)) ?? (await page("firecrawl.scrape", "site2-" + i, p.website)) ?? { site: "homepage could not be read" };
  };
  const all = [me, ...comps];
  const sites = await pool(all, 6, read);
  const rows = all.map((p, i) => ({ n: i, name: p.name, you: i === 0, km: p.km, rating: p.rating ?? null, reviews: p.reviews ?? 0, address: p.address ?? null, website: p.website ?? null, lat: +p.at.lat.toFixed(5), lng: +p.at.lng.toFixed(5), ...sites[i] }));
  const c = rows.slice(1), you = rows[0];
  const rated = c.filter((r) => r.rating != null);
  const signals = Object.fromEntries(SIGNALS.map(([n]) => [n, c.filter((r) => (r.mentions ?? []).includes(n)).length]).filter(([, v]) => v));
  const stats = {
    competitors: c.length, median_reviews: median(c.map((r) => r.reviews)), median_rating: median(rated.map((r) => r.rating)),
    more_reviews_than_you: c.filter((r) => r.reviews > you.reviews).length, higher_rating_than_you: rated.filter((r) => r.rating > (you.rating ?? 0)).length,
    homepages_read: c.filter((r) => r.mentions).length, take_online_booking: c.filter((r) => r.online_booking).length,
    farthest_km: c.length ? c[c.length - 1].km : null, homepage_mentions_out_of_read: signals,
  };
  const data = rows.map(({ lat, lng, n, ...r }) => r);
  const prompt = "You are a local marketing strategist. \"" + you.name + "\" (" + kind + ", " + city + ") wants to know how it stands against the " + c.length + " nearest competitors among the Google Maps results found in this run and how to position itself.\n" +
    "Write a Markdown brief using only the data below. Rules: use the numbers in STATS exactly as given and never compute your own medians, counts or percentages; every other number must appear in DATA; name businesses exactly as given; do not invent prices, services, reviews or numeric targets; say a homepage mentions something only when it is in that business's mentions list; quote homepage headlines only from title or h1; mentions are wording signals, not proof that a service is available; never infer opening hours from day names or the word weekend; do not infer emergency services from same-day wording or patient testimonials; a business whose homepage could not be read is 'unknown', not 'no'.\n" +
    "Sections: 1. Where you stand (one paragraph: median rating and reviews, how many have more reviews, how many rate higher, the nearest three). 2. What the neighborhood competes on (homepage mentions with counts out of the homepages read). 3. Three positioning angles you could own, each tied to a gap in the data. 4. Three quick wins for the next 30 days (Google profile, reviews, homepage), without numeric targets.\n" +
    "Write for a business owner and never mention field names. Under 550 words. Do not add a table; one is attached separately.\n\nSTATS:\n" + JSON.stringify(stats) + "\nDATA:\n" + JSON.stringify(data);
  const brief = await sp.run("brief", LLM, { prompt, max_tokens: 2500 });
  const yn = (r) => (r.mentions ? (r.online_booking ? "detected" : "not detected") : "unknown");
  const cell = (s) => String(s ?? "-").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const lead = (r) => cell(r.h1 || r.title || r.site || "").slice(0, 70);
  return {
    title: "Local competitor map: " + you.name + ", " + city,
    items: [
      { label: "Brief", text: textOf(brief) },
      { label: "Competitors by distance", text: "| # | Business | km | Rating | Reviews | Homepage leads with | Booking wording |\n|---|---|---|---|---|---|---|\n" + rows.map((r) => "| " + [r.you ? "You" : r.n, cell(r.name), r.km, r.rating ?? "-", r.reviews, lead(r), yn(r)].join(" | ") + " |").join("\n") },
      { label: "Numbers (computed from the data)", text: JSON.stringify(stats, null, 2) },
      { label: "Map data (JSON: number, name, lat, lng, reviews, rating)", text: JSON.stringify(rows.map((r) => ({ n: r.you ? "you" : r.n, name: r.name, lat: r.lat, lng: r.lng, reviews: r.reviews, rating: r.rating }))) },
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
