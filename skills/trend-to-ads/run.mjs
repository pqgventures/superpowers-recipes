// Superpowers recipe: trend to ads. Pulls the most-liked TikTok videos in a niche from the last days, keeps the on-topic ones,
// computes the numbers in code and writes what is working plus three ad concepts with one vertical image each.
export const recipe = {
  slug: "trend-to-ads",
  order: 7,
  name: "Trend to ads",
  description: "Give a niche and what you sell: get this week's most-liked TikTok videos in that niche with plays, likes, saves and links, the hooks and formats that keep repeating, and three ad concepts for your product, each with a vertical image.",
  inputs: {
    niche: { title: "Niche", description: "What people search on TikTok, like protein snacks or skincare routine", example: "protein snacks", required: true, maxLength: 80 },
    product: { title: "Your product", description: "What you sell, in a few words", example: "a high-protein chocolate bar for runners", required: true, maxLength: 160 },
    period: { title: "Window", description: "yesterday, this-week or this-month", default: "this-week" },
  },
  uses: { "scrapecreators.tiktok-search": 1, "openrouter.openai-gpt-5.4-mini": 2, "openrouter.google-gemini-2.5-flash-image.image": 3 },
  share: { review: false },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const IMAGE = "openrouter.google-gemini-2.5-flash-image.image";
export const median = (xs) => { const s = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
export const json = (s) => { const t = String(s).replace(/^[^{]*/, "").replace(/[^}]*$/, ""); return JSON.parse(t); };
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(2) : null);
const fmt = (n) => Number(n).toLocaleString("en-US");

export function stats(vids) {
  const big = vids.filter((v) => (v.plays ?? 0) >= 50000);
  const top = (k) => big.map((v) => [v.ref, v[k]]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const tags = {};
  for (const v of vids) for (const t of v.hashtags ?? []) tags[t] = (tags[t] ?? 0) + 1;
  return {
    on_topic: vids.length, median_plays: Math.round(median(vids.map((v) => v.plays)) ?? 0), median_likes: Math.round(median(vids.map((v) => v.likes)) ?? 0),
    median_length_s: Math.round(median(vids.map((v) => v.duration_s)) ?? 0), paid_or_ad: vids.filter((v) => v.is_ad).length,
    top_hashtags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8), highest_save_rate_pct: top("save_rate_pct"), highest_share_rate_pct: top("share_rate_pct"),
    length_bands: [["under 30 seconds", 0, 30], ["30 to 60 seconds", 30, 60], ["over 60 seconds", 60, Infinity]].map(([band, lo, hi]) => {
      const b = vids.filter((v) => v.duration_s >= lo && v.duration_s < hi);
      // Groups under 4 videos are labelled so the writer does not draw conclusions from them.
      return b.length < 4 ? { band, videos: b.length, note: "too few videos to compare" } : { band, videos: b.length, typical_plays: Math.round(median(b.map((v) => v.plays)) ?? 0), typical_saves_pct: median(b.map((v) => v.save_rate_pct)) };
    }),
  };
}

// What kind of video each one is. The relevance step labels every on-topic video with one of these.
export const FORMATS = {
  howto: { name: "how-to videos (something made or used step by step)", short: "how-to", ads: "each ad makes one specific, named thing with the product on camera (for a snack: a recipe that uses it as an ingredient, like cookies, ice cream or a parfait; for skincare: a routine step), the hook names that thing, and the three beats are filmable steps (what is added, what is done, the finished result), not a plain product shot or a bag being packed" },
  product: { name: "product videos (a product held, unboxed, tasted or reviewed)", short: "product", ads: "the ad shows the product up close being opened, broken or tried, with a specific reaction or detail on screen" },
  talk: { name: "talking videos (opinion, story or skit)", short: "talking", ads: "the ad is a person talking to camera with one specific opinion or story about the problem the product solves, product in hand" },
  other: { name: "other videos", short: "other", ads: "" },
};
const per100 = (g, k) => { const p = g.reduce((a, v) => a + (v.plays ?? 0), 0); return p ? +((100 * g.reduce((a, v) => a + (v[k] ?? 0), 0)) / p).toFixed(1) : null; };

// Saves per 100 plays by format, pooled and by median. A format "leads" only when it has at least 4 videos and beats
// every other format with at least 3 videos on both measures, so one viral video cannot make the finding.
export function formatFinding(vids) {
  const groups = Object.keys(FORMATS).map((f) => {
    const g = vids.filter((v) => (v.format ?? "other") === f);
    return { format: f, videos: g.length, saves_per_100_plays: per100(g, "saves"), median_saves_per_100_plays: g.length ? +(median(g.map((v) => 100 * (v.saves ?? 0) / Math.max(1, v.plays ?? 0))) ?? 0).toFixed(1) : null, share_of_plays_pct: null, refs: g.map((v) => v.ref) };
  }).filter((g) => g.videos > 0);
  const total = vids.reduce((a, v) => a + (v.plays ?? 0), 0);
  for (const g of groups) g.share_of_plays_pct = total ? Math.round((100 * vids.filter((v) => (v.format ?? "other") === g.format).reduce((a, v) => a + (v.plays ?? 0), 0)) / total) : null;
  const rivals = (g) => groups.filter((o) => o !== g && o.videos >= 3 && o.format !== "other");
  const lead = groups.find((g) => g.format !== "other" && g.videos >= 4 && rivals(g).length && rivals(g).every((o) => g.saves_per_100_plays > o.saves_per_100_plays && g.median_saves_per_100_plays > o.median_saves_per_100_plays));
  if (!lead) return { groups, lead: null, text: "No format clearly gets saved more than the others this time; the three ads try different formats." };
  const rest = vids.filter((v) => (v.format ?? "other") !== lead.format);
  return { groups, lead: lead.format, refs: lead.refs, text: "People save " + FORMATS[lead.format].name + " most: " + lead.saves_per_100_plays + " saves per 100 plays across " + lead.videos + " videos, against " + per100(rest, "saves") + " for the other " + rest.length + "." };
}

// The numbers in plain sentences (share pages are read by marketers, not developers).
export function numbersText(found, st, byRef, niche) {
  const who = (r) => (byRef[r] ? "@" + byRef[r].author : r);
  return [
    found + " videos found; " + st.on_topic + " are about " + niche + ".",
    "Typical video: " + fmt(st.median_plays) + " plays, " + fmt(st.median_likes) + " likes, " + st.median_length_s + " seconds long.",
    (st.paid_or_ad === 1 ? "1 of them is a paid ad." : st.paid_or_ad + " of them are paid ads."),
    st.formats ? "By format: " + st.formats.map((g) => g.videos + " " + FORMATS[g.format].short + (g.videos >= 3 ? ", " + g.saves_per_100_plays + " saves per 100 plays" : ", too few to compare")).join("; ") + "." : "",
    "By length: " + st.length_bands.map((b) => b.band + " " + b.videos + (b.videos === 1 ? " video" : " videos") + (b.note ? "" : ", typical " + fmt(b.typical_plays) + " plays")).join("; ") + ".",
    st.top_hashtags.length ? "Hashtags used most: " + st.top_hashtags.map(([t, n]) => t + " (" + n + ")").join(", ") + "." : "",
    st.highest_save_rate_pct.length ? "Saved most often, among videos with 50,000+ plays: " + st.highest_save_rate_pct.map(([r, v]) => who(r) + " " + v + "%").join(", ") + "." : "",
    st.highest_share_rate_pct.length ? "Shared most often: " + st.highest_share_rate_pct.map(([r, v]) => who(r) + " " + v + "%").join(", ") + "." : "",
  ].filter(Boolean).join("\n");
}

export async function run(sp, { niche, product, period }) {
  const win = ["yesterday", "this-week", "this-month"].includes(period) ? period : "this-week";
  const found = await sp.run("search", "scrapecreators.tiktok-search", { query: niche, period: win, sort: "most-liked" });
  const all = (found.videos ?? []).map((v, i) => ({ ...v, ref: "V" + (i + 1), save_rate_pct: pct(v.saves, v.plays), share_rate_pct: pct(v.shares, v.plays) }));
  if (all.length < 3) throw new Error("TikTok returned too few videos for \"" + niche + "\" in " + win + "; try a broader niche or this-month");
  // 1. Relevance first, as structured data, so the brief never praises a video it would call off-topic.
  const cls = await sp.run("relevance", LLM, { prompt: "For each TikTok video below, decide if it is about \"" + niche + "\". Grocery hauls, unrelated vlogs and videos about something else are off-topic. For each on-topic video also give its format: howto (something is made, cooked or applied step by step), product (a product held, unboxed, tasted or reviewed), talk (opinion, story or skit), other. Reply only JSON {\"on_topic\": [refs], \"off_topic\": [refs], \"format\": {ref: format}} using every ref once.\n" + JSON.stringify(all.map((v) => ({ ref: v.ref, caption: String(v.caption ?? "").slice(0, 200) }))), max_tokens: 800 });
  let on, fmts = {}; try { const j = json(textOf(cls)); on = new Set(j.on_topic ?? []); fmts = j.format ?? {}; } catch { on = new Set(all.map((v) => v.ref)); }
  const vids = all.filter((v) => on.has(v.ref)).map((v) => ({ ...v, format: FORMATS[fmts[v.ref]] ? fmts[v.ref] : "other" }));
  if (vids.length < 3) throw new Error("Fewer than 3 of the videos found are about \"" + niche + "\"; try a more specific niche");
  const st = stats(vids);
  const finding = formatFinding(vids); st.formats = finding.groups.map(({ refs, ...g }) => g);
  const byRef = Object.fromEntries(vids.map((v) => [v.ref, v]));
  // 2. Brief and concepts. The model cites refs; code inserts links and counts.
  const facts = vids.map(({ url, video_id, cover_url, ...v }) => v);
  const brief = await sp.run("brief", LLM, { max_tokens: 2500, prompt:
    "You are a performance creative strategist. FINDING (computed in code; the brief must start from it and never contradict it): " + finding.text + "\n" + (finding.lead ? "The three concepts must follow the finding: " + FORMATS[finding.lead].ads + ". inspired_by must be one of " + finding.refs.join(", ") + ". Each image_prompt shows that scene with the product.\n" : "No format leads, so the three concepts use three different formats: concept 1 " + FORMATS.howto.ads + "; concept 2 " + FORMATS.product.ads + "; concept 3 " + FORMATS.talk.ads + ". Each hook names something specific (the thing made, the moment, the opinion), and the beats are filmable shots, never generic lines like show the bar or end with a save cue.\n") + "Below are the on-topic videos among this window's most-liked TikTok videos for \"" + niche + "\" (" + win + "), with numbers computed in code. The reader sells " + product + ".\n" +
    "Reply only JSON with keys brief and concepts. brief: Markdown under 300 words for a busy marketer on what is working (formats, hooks, length, what gets saved and shared). Start with one plain sentence that states the FINDING in your own words, then short paragraphs; never list the STATS back or describe the sample (no on-topic, window, median or ref words), just use numbers where they help. Every number you write must appear in STATS or VIDEOS exactly as given (thousands separators allowed); if a number is not there, say it in words (shorter, longer) instead of inventing a range. Never call something a winner, sweet spot or trend from fewer than 4 videos, and never contradict the numbers (if a shorter group has more plays, do not say longer works better). Cite videos only as their ref in square brackets like [V3]; use the STATS numbers as given and never compute your own; never use quotation marks; never write field names; write numbers with thousands separators. concepts: exactly 3 objects with hook (max 8 words), beats (3 short lines), caption (max 20 words, at most 3 hashtags), cta (no prices, discounts or claims the reader did not state), inspired_by (a ref), image_prompt (a vertical photo scene for the product, no text, no logos, no real people). Concepts must not name creators.\n\nSTATS:\n" + JSON.stringify(st) + "\nVIDEOS:\n" + JSON.stringify(facts) });
  const out = json(textOf(brief));
  // Share pages show plain text, so cite as @handle with plays; the links live in "Top videos".
  const link = (ref) => { const v = byRef[ref]; return v ? "@" + v.author + " (" + fmt(v.plays) + " plays)" : ref; };
  const md = String(out.brief ?? "").replace(/\[(V\d+)\]/g, (_, r) => link(r)).replace(/\)\s*@/g, "), @");
  // Keep each concept tied to a video of the leading format, even if the model picked another one.
  const leadRefs = finding.lead ? [...finding.refs].sort((a, b) => (byRef[b].save_rate_pct ?? 0) - (byRef[a].save_rate_pct ?? 0)) : [];
  const concepts = (out.concepts ?? []).slice(0, 3).map((c, i) => (finding.lead && !finding.refs.includes(c.inspired_by) ? { ...c, inspired_by: leadRefs[i % leadRefs.length] } : c));
  const imgs = await Promise.all(concepts.map(async (c, i) => {
    try { const r = await sp.run("image-" + (i + 1), IMAGE, { prompt: String(c.image_prompt ?? product) + ". Vertical 9:16 photo, no text, no logos.", size: "portrait" }); return r.images?.[0]?.url ?? null; } catch { return null; }
  }));
  const top = [...vids].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 10);
  return {
    title: "Trend to ads: " + niche + " on TikTok (" + win + ")",
    items: [
      { label: "What is working", text: md },
      { label: "The finding", text: finding.text },
      ...concepts.flatMap((c, i) => [
        { label: "Concept " + (i + 1) + ": " + c.hook, text: (c.beats ?? []).map((b) => "- " + b).join("\n") + "\n\nCaption: " + c.caption + "\nCTA: " + c.cta + "\nInspired by: " + (byRef[c.inspired_by]?.url ?? "-") },
        ...(imgs[i] ? [{ label: "Concept " + (i + 1) + " visual", url: imgs[i] }] : []),
      ]),
      { label: "Top videos", text: top.map((v) => "@" + v.author + " · " + fmt(v.plays) + " plays · " + fmt(v.likes) + " likes · " + (v.save_rate_pct ?? "-") + "% saved\n" + v.url).join("\n\n") },
      { label: "The numbers", text: numbersText(all.length, st, byRef, niche) },
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
