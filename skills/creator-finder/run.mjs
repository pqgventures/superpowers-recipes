// Superpowers recipe: TikTok creators in your niche who post about it every week, with their usual reach.
// No model call: searches TikTok for your words, keeps videos from your country, reads each candidate's latest videos,
// keeps creators who post mostly about your niche and ranks them by the plays their videos usually get
// (what a paid post most likely gets), with their best recent video as a bonus.
export const recipe = {
  slug: "creator-finder",
  order: 14,
  name: "Find creators in your niche, ranked by their usual reach",
  description: "Name your niche in your customers' language and a country. Get the TikTok creators there who post about it regularly, with followers, how many of their latest videos are about your niche, how many plays a video of theirs usually gets, and their best recent video. Pick who to pitch by what a post of theirs usually reaches, not by followers.",
  inputs: {
    phrases: { title: "What to search", description: "One to three search phrases in your customers' language, separated by commas, e.g. maquiagem, resenha maquiagem", example: "maquiagem, resenha maquiagem", required: true, maxLength: 120 },
    niche_words: { title: "Niche words (optional)", description: "Words that show a video is about your niche, separated by commas, e.g. batom, base, corretivo. Empty uses the words of your phrases", example: "maquiagem, make, batom, base, blush, rimel, corretivo, delineador, sombra, iluminador, gloss, pele, skincare", maxLength: 300 },
    country: { title: "Country", description: "Two-letter country of the creators, e.g. BR", default: "BR" },
    period: { title: "Videos from", description: "this-week, this-month or last-3-months", default: "this-month" },
    followers: { title: "Follower range", description: "Smallest and largest follower count, e.g. 2000-1500000", default: "2000-1500000" },
    creators: { title: "Creators to check", description: "How many creators to read in depth, 3 to 15 (one call each)", default: "12" },
  },
  uses: { "scrapecreators.tiktok-search": 6, "scrapecreators.tiktok-profile-videos": 15 },
  share: { review: false },
};

const PERIODS = ["this-week", "this-month", "last-3-months"];
export const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function words(text) {
  return [...new Set(String(text || "").split(/[,;\n]+/).map((w) => fold(w).trim()).filter((w) => w.length >= 3))].slice(0, 40);
}
export function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}
export const onNiche = (caption, ws) => { const c = fold(caption); return ws.some((w) => c.includes(w)); };
export function short(n) {
  if (!Number.isFinite(n)) return "?";
  if (n >= 1e6) return (Math.round(n / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}
export function range(text) {
  const m = String(text || "").replace(/[ ._]/g, "").match(/^(\d+)k?-(\d+)k?$/i);
  if (!m) throw new Error("Follower range looks like 2000-1500000");
  const k = (s, i) => Number(s) * (/k/i.test(String(text).split("-")[i] || "") ? 1000 : 1);
  const lo = k(m[1], 0), hi = k(m[2], 1);
  if (!(lo >= 0 && hi > lo)) throw new Error("Follower range: the first number must be smaller");
  return [lo, hi];
}
// Groups the found videos by author, keeping each author's most played video in the country and size band.
export function candidates(videos, country, lo, hi) {
  const by = new Map();
  for (const v of videos) {
    if (!v.author || v.region !== country) continue;
    const f = v.author_followers;
    if (!Number.isFinite(f) || f < lo || f > hi) continue;
    const cur = by.get(v.author);
    if (!cur || (v.plays || 0) > (cur.plays || 0)) by.set(v.author, v);
  }
  return [...by.values()].sort((a, b) => (b.plays || 0) - (a.plays || 0));
}

export async function run(sp, { phrases, niche_words, country, period, followers, creators }) {
  const qs = String(phrases || "").split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length >= 2).slice(0, 3);
  if (!qs.length) throw new Error("Give one to three search phrases, e.g. maquiagem");
  const cc = String(country || "BR").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error("Country is a two-letter code, e.g. BR");
  const per = String(period || "this-month").trim();
  if (!PERIODS.includes(per)) throw new Error("Videos from: this-week, this-month or last-3-months");
  const [lo, hi] = range(followers || "2000-1500000");
  const n = Math.min(15, Math.max(3, Math.round(Number(creators) || 12)));
  const ws = words(niche_words || qs.join(","));
  if (!ws.length) throw new Error("Give niche words of at least 3 letters");
  const seen = new Map();
  for (const [i, q] of qs.entries()) {
    let cursor;
    for (const page of [1, 2]) {
      const r = await sp.run("search-" + (i + 1) + "-" + page, "scrapecreators.tiktok-search", { query: q, period: per, sort: "most-liked", ...(cursor ? { cursor } : {}) });
      for (const v of r.videos || []) if (!seen.has(v.video_id)) seen.set(v.video_id, v);
      cursor = r.next_cursor;
      if (!cursor) break;
    }
  }
  const found = [...seen.values()];
  // Search results carry the video's country in the raw data only through the author; the tool normalizes it as region when present.
  const inCountry = found.filter((v) => v.region === cc);
  const pool = candidates(found, cc, lo, hi).slice(0, n);
  const checked = []; let failed = 0;
  for (const [i, v] of pool.entries()) {
    const p = await sp.run("creator-" + (i + 1), "scrapecreators.tiktok-profile-videos", { handle: v.author, region: cc, sort: "latest" }).catch((e) => { if (/balance|402|funds/i.test(String(e && e.message))) throw e; failed++; return null; });
    if (!p || !(p.videos || []).length) continue;
    const latest = p.videos.slice(0, 12);
    const about = latest.filter((x) => onNiche(x.caption, ws)).length;
    const usual = median(latest.filter((x) => x.video_id !== v.video_id).map((x) => x.plays));
    const best = [v, ...latest].reduce((a, b) => ((b.plays || 0) > (a.plays || 0) ? b : a));
    const paid = latest.filter((x) => x.is_ad).length;
    checked.push({ handle: v.author, followers: p.author?.followers ?? v.author_followers, about, of: latest.length, usual, best, paid, url: "https://www.tiktok.com/@" + v.author });
  }
  const keep = checked.filter((c) => c.of >= 3 && c.about / c.of >= 0.5 && Number.isFinite(c.usual)).sort((a, b) => b.usual - a.usual);
  const items = [{ label: "In short", text: found.length + " TikTok videos matched " + qs.map((q) => "\"" + q + "\"").join(" and ") + " (" + per + "); " + inCountry.length + " came from " + cc + ". We read the latest videos of " + checked.length + " creators there with " + short(lo) + " to " + short(hi) + " followers: " + keep.length + " post mostly about your niche (at least half of their latest videos), " + (checked.length - keep.length) + " had one video that matched and post about other things." + (failed ? " " + failed + " profile" + (failed > 1 ? "s" : "") + " could not be read." : "") + " Usual reach is the median plays of a creator's latest videos, not counting the one we found." }];
  for (const c of keep) {
    const x = c.usual ? Math.round((c.best.plays || 0) / c.usual) : null;
    items.push({ label: "@" + c.handle, url: c.url, caption: "@" + c.handle + " · " + short(c.followers) + " followers · " + c.about + " of " + c.of + " latest videos about your niche · usual reach " + short(c.usual) + " plays · best recent video " + short(c.best.plays) + " plays" + (x && x >= 2 ? " (" + x + "x usual)" : "") + (c.paid ? " · " + c.paid + " recent paid partnership" + (c.paid > 1 ? "s" : "") : "") });
  }
  if (keep.length) {
    items.push({ label: "Their best recent videos", text: "Open these to see what worked for each creator." });
    for (const c of keep) items.push({ label: "@" + c.handle + ": " + short(c.best.plays) + " plays", url: c.best.url, caption: "@" + c.handle + " · " + short(c.best.plays) + " plays · " + String(c.best.caption || "").slice(0, 120) });
  }
  items.push({ label: "How to use it", text: keep.length ? "Pitch by usual reach: that is what a paid post most likely gets, while a breakout video is luck. Check each profile for how they mention brands before you write; contact details are on the profile, not here." : "No creator here posts mostly about your niche. Try phrases only your customers' language uses, a longer period, or a wider follower range." });
  return { title: "TikTok creators in " + cc + " who post about " + qs[0], items };
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
