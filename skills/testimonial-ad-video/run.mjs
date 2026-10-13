// Superpowers recipe: testimonial ad video from your App Store reviews.
// Pulls recent reviews, picks three 5-star quotes (verbatim), makes backgrounds and renders a narrated 9:16 video.
export const recipe = {
  slug: "testimonial-ad-video",
  order: 5,
  name: "Testimonial ad video from App Store reviews",
  description: "Turns your real 5-star App Store reviews into a 25–35 second vertical video ad: a hook, three word-for-word quotes over matching visuals, a voiceover and a closing line, with an AI disclosure on screen.",
  inputs: {
    app: { title: "App", description: "App Store name or numeric id", example: "Calm", required: true, maxLength: 80 },
    country: { title: "Store country", description: "Two-letter App Store country", default: "us" },
  },
  uses: { "appstore.reviews": 1, "openrouter.anthropic-claude-sonnet-5": 1, "openai.gpt-image-1-mini": 3, "videokit.vertical-video": 1 },
  share: { review: false },
};

const LLM = "openrouter.anthropic-claude-sonnet-5";
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
const SENSITIVE = /\b(died|death|dead|funeral|grief|cancer|suicid|chemo|hospital|diagnos|miscarr|my (son|daughter|kid|child)|abuse)\w*/i;
// Exact words from the review: the excerpt if it is verbatim, else the review's first 20 words.
export function verbatim(excerpt, review) {
  if (excerpt && norm(review).includes(norm(excerpt))) return norm(excerpt);
  const words = norm(review).split(" ");
  return words.slice(0, 20).join(" ") + (words.length > 20 ? "…" : "");
}

export async function run(sp, { app, country }) {
  const cc = String(country || "us").toLowerCase();
  const id = /^\d{5,12}$/.test(String(app).trim()) ? { app_id: String(app).trim() } : { query: String(app).trim() };
  const got = await sp.run("reviews", "appstore.reviews", { ...id, country: cc, limit: 50 });
  const name = got.app ?? String(app);
  const pool = (got.reviews ?? []).filter((r) => r.rating === 5 && norm(r.text).length >= 60 && norm(r.text).length <= 600 && !SENSITIVE.test(r.text));
  if (pool.length < 3) throw new Error("Not enough recent 5-star reviews to quote for " + name + " in the " + cc.toUpperCase() + " store");
  const prompt = "You are a performance creative director making a 25-second vertical testimonial ad for the app " + name + " from its real App Store reviews.\n" +
    "Pick the 3 strongest reviews (specific benefit, believable, nothing a reviewer would mind seeing in an ad). For each, copy a short excerpt verbatim from the review text (a contiguous substring, 8 to 22 words, same spelling and punctuation) and write a background image prompt (cinematic, vertical, no text, no logos, no faces looking at camera).\n" +
    "Also write a hook (max 9 words) and a closing line (max 7 words) that names the app and where to get it, with no offers, prices or trials.\n" +
    'Return JSON only: {"hook":"...","quotes":[{"index":0,"excerpt":"...","image_prompt":"..."}],"cta":"..."}\n\nREVIEWS:\n' +
    JSON.stringify(pool.slice(0, 40).map((r, i) => ({ index: i, title: r.title, text: r.text })));
  const plan = JSON.parse(textOf(await sp.run("plan", LLM, { prompt, max_tokens: 1500 })).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  const picks = (plan.quotes ?? []).filter((q) => pool[q.index]).slice(0, 3);
  if (picks.length < 3) throw new Error("Could not pick three quotes");
  const quotes = picks.map((q) => ({ text: verbatim(q.excerpt, pool[q.index].text), review: pool[q.index], prompt: q.image_prompt }));
  const images = await Promise.all(quotes.map((q, i) => sp.run("image-" + i, "openai.gpt-image-1-mini", { prompt: q.prompt + " Soft natural light, muted tones, empty space in the lower half for text.", size: "portrait" })));
  const urls = images.map((r) => r.images?.[0]?.url);
  if (urls.some((u) => !u)) throw new Error("An image did not come back");
  const video = await sp.run("video", "videokit.vertical-video", {
    disclosure: "Real App Store reviews · AI visuals and voice",
    scenes: [
      { image_url: urls[0], text: String(plan.hook || "What people say about " + name).slice(0, 160), caption: name.slice(0, 60) },
      ...quotes.map((q, i) => ({ image_url: urls[i], text: "“" + q.text + "”", narration: q.text, badge: "five_stars", caption: "App Store review" })),
      { image_url: urls[2], text: String(plan.cta || "Find " + name + " on the App Store").slice(0, 160), caption: "Download on the App Store" },
    ],
  });
  return {
    title: name + ": testimonial ad from App Store reviews",
    items: [
      { label: "Video", url: video.video_url },
      { label: "Quotes used (verbatim, 5 stars)", text: quotes.map((q) => "“" + q.text + "” — App Store review, " + (q.review.date ?? "") + (q.review.title ? " (\"" + q.review.title + "\")" : "")).join("\n\n") },
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
