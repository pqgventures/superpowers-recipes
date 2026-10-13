// Superpowers recipe: three ad concepts to choose from.
// The same file runs on the server ("Try it" on the website) and on the user's computer
// (downloaded from /recipes/ad-concepts/run.mjs, which appends a small API runner).
export const recipe = {
  slug: "ad-concepts",
  order: 1,
  name: "Three ad concepts to choose from",
  description: "Writes a headline and makes three different ad visuals for your product, then opens a page where your team picks the winner.",
  inputs: {
    product: { title: "Product", description: "What you're advertising, in a few words", example: "cold brew coffee subscription", required: true },
    audience: { title: "Audience", description: "Who it's for", default: "small business owners" },
  },
  uses: { "openai.gpt-5.4-mini": 1, "openai.gpt-image-2.5-sunburst": 3 },
  share: { review: true, question: "Which ad should we run?" },
};

const IMAGE = "openai.gpt-image-2.5-sunburst";
const LOOKS = [
  ["bold", "Bold & minimal", (p, a) => "Premium minimalist product advertisement for " + p + ", aimed at " + a + ". A single hero subject photographed in a studio, bold saturated solid-color backdrop, crisp hard light with a long graphic shadow, generous negative space for a headline, art-directed like a global brand campaign. No text, no logos."],
  ["lifestyle", "Lifestyle photo", (p, a) => "Candid lifestyle advertising photograph: " + a + " enjoying " + p + " in a real, lived-in setting. Soft natural window light, shallow depth of field, authentic expressions, warm editorial color grade, shot on a 35mm lens. No text, no logos."],
  ["illustrated", "Illustrated", (p, a) => "Contemporary editorial illustration advertising " + p + " for " + a + ". Confident graphic shapes, subtle paper grain texture, limited palette of three or four harmonious colors, clear focal point, the polish of a premium magazine cover. No text, no logos."],
];

export async function run(sp, { product, audience }) {
  const [headline, ...images] = await Promise.all([
    sp.run("headline", "openai.gpt-5.4-mini", { prompt: "You are a senior copywriter. Write one ad headline (max 7 words) for " + product + ", aimed at " + audience + ". Concrete benefit, no clichés, no exclamation marks. Reply with the headline only, no quotes.", max_tokens: 40 }),
    ...LOOKS.map(([id, , prompt]) => sp.run(id, IMAGE, { prompt: prompt(product, audience) })),
  ]);
  const title = product + ": three ad concepts";
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    items: [
      { label: "Headline", text: String(headline.text ?? "").trim() },
      ...images.map((r, i) => ({ label: LOOKS[i][1], url: r.images[0].url })),
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
