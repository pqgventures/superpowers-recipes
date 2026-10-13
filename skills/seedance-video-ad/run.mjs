// Superpowers recipe: a short video ad from a one-line brief (Seedance by ByteDance).
// Writes one shot description, then renders a vertical clip with sound. With a product photo, the photo becomes the first frame.
export const recipe = {
  slug: "seedance-video-ad",
  order: 6,
  name: "Video ad from a one-line brief",
  description: "Describe your product (and add a photo if you have one); get a 5 to 10 second vertical video ad with sound, ready for Reels, TikTok or Shorts, plus the shot description so you can ask for another take.",
  inputs: {
    product: { title: "Product", description: "What you're advertising, in a few words", example: "cold brew coffee subscription", required: true, maxLength: 120 },
    audience: { title: "Audience", description: "Who it's for", default: "busy professionals", maxLength: 80 },
    photo_url: { title: "Product photo (optional)", description: "Public link to a JPEG, PNG or WebP of the product; it becomes the first frame" },
    seconds: { title: "Length", description: "5, 8 or 10 seconds", default: "5" },
    quality: { title: "Quality", description: "draft (480p, cheapest), standard (720p) or premium (720p, best model)", default: "draft" },
  },
  uses: { "openrouter.openai-gpt-5.4-mini": 1, "fal.bytedance-seedance-2.0-mini-text-to-video": 1 },
  share: { review: true, question: "Should we run this one, or ask for another take?" },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const MODELS = { draft: ["2.0-mini", "480p"], standard: ["2.0-mini", "720p"], premium: ["2.0", "720p"] };
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();

export function shotPrompt(raw, product) {
  const s = String(raw || "").replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ").slice(0, 900);
  return s.length > 40 ? s : "Vertical product ad for " + product + ". One continuous shot, natural light, the product in use, slow camera push-in. No text, no logos.";
}

export async function run(sp, { product, audience, photo_url, seconds, quality }) {
  const what = String(product || "").trim();
  if (!what) throw new Error("Tell me what the product is");
  const secs = String(seconds || "5");
  if (!["5", "8", "10"].includes(secs)) throw new Error("Length must be 5, 8 or 10 seconds");
  const q = MODELS[String(quality || "draft")];
  if (!q) throw new Error("Quality must be draft, standard or premium");
  const photo = photo_url ? String(photo_url).trim() : "";
  if (photo && !/^https:\/\/\S+$/.test(photo)) throw new Error("The product photo must be a public https link");
  const brief = "You are a commercial director. Write the shot description for a " + secs + "-second vertical (9:16) video ad for " + what + ", aimed at " + String(audience || "busy professionals") + ".\n" +
    "One continuous shot that shows the product being used, a clear subject, lighting, camera movement and the sound you hear. " +
    (photo ? "The first frame is the product photo provided; keep the product looking exactly like it. " : "") +
    "No on-screen text, no logos, no brand names, no celebrities or real people's likeness. 60 to 110 words, plain prose, no lists. Reply with the description only.";
  const shot = shotPrompt(textOf(await sp.run("shot", LLM, { prompt: brief, max_tokens: 300 })), what);
  const tool = "fal.bytedance-seedance-" + q[0] + "-" + (photo ? "image" : "text") + "-to-video";
  const input = { prompt: shot, duration: secs, resolution: q[1], aspect_ratio: "9:16", generate_audio: true, ...(photo ? { image_url: photo } : {}) };
  const video = await sp.run("video", tool, input);
  const raw = video.video_url ?? video.output?.video?.url;
  if (!raw) throw new Error("The video did not come back");
  // The model's link expires; keep a lasting copy when the runner can.
  const url = sp.keep ? await sp.keep(raw, "video-ad.mp4").catch(() => raw) : raw;
  const title = what + ": " + secs + "-second video ad";
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    items: [
      { label: "Video", url },
      { label: "Shot description", text: shot },
      { label: "How it was made", text: secs + " seconds, vertical, " + q[1] + ", with sound. AI-generated video" + (photo ? " starting from your product photo." : ".") },
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
