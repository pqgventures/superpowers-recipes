// Superpowers recipe: a 25-35 second vertical video ad from a product page, with the page's own photos and facts.
// No model call: run 1 reads the page and returns its text and photos; the user's AI assistant writes the scenes from
// them; run 2 checks every number in the scenes against the page, then renders the video (real photos shown whole,
// natural AI voice) and shares it.
export const recipe = {
  slug: "product-video-ad",
  order: 12,
  name: "Video ad from your product page",
  description: "Paste your product page. Get its facts and photos, have your AI assistant write a few scenes from them, and get a 25-35 second vertical video ad with your real photos, a natural AI voice and captions, ready for Reels, TikTok and Shorts.",
  inputs: {
    url: { title: "Product page", description: "The link to the product page", example: "https://drinkolipop.com/products/vintage-cola-6g-fiber", required: true, maxLength: 300 },
    scenes: { title: "Scenes (second run)", description: "Leave empty the first time. Then one scene per line: photo number | on-screen text | what the voice says | optional small caption", maxLength: 2400 },
    voice: { title: "Voice", description: "jessica (bright), sarah (reassuring), laura (enthusiastic), george (British), brian (deep), liam (energetic)", default: "jessica" },
  },
  uses: { "firecrawl.scrape": 1, "videokit.vertical-video": 1 },
  share: { review: false },
};

// Product pages end with cards for other products ("You may also like"); their offers and figures are not this product's.
const OTHERS = /you may also like|you.re going to love|related products|recommended|customers also|frequently bought|complete the (set|look)|more from|shop similar|best ?sellers|pairs well/i;
export function mainPart(md) {
  const lines = String(md || "").split("\n");
  const cut = lines.findIndex((l) => /^\s*#{1,6}\s/.test(l) && OTHERS.test(l));
  return cut > 0 ? lines.slice(0, cut).join("\n") : String(md || "");
}
const NOISE = /discount code|liquid error|add to cart|notify me|close search|^submit$|cookie|sign in|log in|skip to content|newsletter/i;
export function pageText(md) {
  const lines = [];
  for (let l of String(md || "").split("\n")) {
    l = l.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<br\s*\/?>/gi, " ").replace(/[*_#>|\\]+/g, " ").replace(/\s+/g, " ").trim();
    if (l.length < 3 || NOISE.test(l) || lines.includes(l)) continue;
    lines.push(l);
  }
  return lines.join("\n").slice(0, 6000);
}
export function photos(md) {
  const seen = new Set(), out = [];
  for (const m of String(md || "").matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    const u = m[1].replace(/^http:/, "https:").replace(/([?&])width=\d+/, "$1width=1200"), path = u.split("?")[0].toLowerCase();
    if (!/\.(jpe?g|png|webp)$/.test(path) || /icon|logo|sprite|badge|payment|flag|avatar|star/.test(path) || seen.has(path)) continue;
    seen.add(path); out.push(u);
    if (out.length >= 12) break;
  }
  return out;
}
export function parseScenes(text, n) {
  const rows = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (rows.length < 3 || rows.length > 6) throw new Error("Write 3 to 6 scenes, one per line: photo number | on-screen text | what the voice says");
  return rows.map((r, i) => {
    const [p, t, v, c] = r.split("|").map((x) => (x ?? "").trim());
    const k = Number(p);
    if (!Number.isInteger(k) || k < 1 || k > n) throw new Error("Scene " + (i + 1) + ": photo number must be between 1 and " + n);
    if (!t || t.length > 120) throw new Error("Scene " + (i + 1) + ": on-screen text is required (up to 120 characters)");
    if (!v || v.length > 200) throw new Error("Scene " + (i + 1) + ": what the voice says is required (up to 200 characters)");
    if (c && c.length > 60) throw new Error("Scene " + (i + 1) + ": caption up to 60 characters");
    return { photo: k, text: t, narration: v, caption: c || undefined };
  });
}
// Every number in the scenes (on screen, in the voice, in captions) must appear on the page; numbers with a unit
// (6g, 50mg, 15%, $35.99, 40 calories, 355ml) must appear with that unit. A product page can list other products,
// so this catches invented figures, not every mix-up; the agent still writes from the page.
const UNIT = { g: "g", gram: "g", grams: "g", mg: "mg", milligram: "mg", milligrams: "mg", "%": "%", percent: "%", ml: "ml", oz: "oz", ounce: "oz", ounces: "oz", cal: "cal", calorie: "cal", calories: "cal", kcal: "cal" };
function facts(text) {
  const out = [];
  const t = String(text).toLowerCase().replace(/,(\d{3})/g, "$1");
  for (const m of t.matchAll(/(\$)?\s?(\d+(?:\.\d+)?)\s?(%|[a-z]+)?/g)) {
    const unit = m[1] ? "$" : UNIT[m[3] ?? ""] ?? "";
    out.push({ n: m[2], unit, raw: m[1] ? "$" + m[2] : UNIT[m[3] ?? ""] ? m[2] + (m[3] === "%" ? "%" : " " + m[3]) : m[2] });
  }
  // "Calories 40" (nutrition tables put the word first)
  for (const m of t.matchAll(/calories\s*(\d+)/g)) out.push({ n: m[1], unit: "cal", raw: m[0] });
  return out;
}
export function unsupported(scenes, page) {
  const have = facts(page), any = new Set(have.map((f) => f.n)), withUnit = new Set(have.map((f) => f.n + f.unit));
  const bad = [], seen = new Set();
  for (const s of scenes) for (const f of facts(s.text + " " + s.narration + " " + (s.caption || ""))) {
    const ok = f.unit ? withUnit.has(f.n + f.unit) : any.has(f.n);
    if (!ok && !seen.has(f.n + f.unit)) { seen.add(f.n + f.unit); bad.push(f.raw); }
  }
  return bad;
}

export async function run(sp, { url, scenes, voice }) {
  const link = String(url || "").trim();
  if (!/^https?:\/\/\S+\.\S+/.test(link)) throw new Error("Give the full link to the product page, starting with https://");
  const page = await sp.run("page", "firecrawl.scrape", { url: link });
  const main = mainPart(page.markdown), text = pageText(main), pics = photos(main);
  const name = String(page.title || "Product").trim().slice(0, 80);
  if (!scenes || !String(scenes).trim()) {
    if (!pics.length) throw new Error("No product photos found on that page; try the product's own page rather than a collection or home page");
    return {
      title: name + ": facts and photos for a video ad",
      items: [
        { label: "Next step", text: "Write 4 to 6 scenes from the facts below (hook, two or three proof points, offer, call to action), one per line: photo number | on-screen text | what the voice says | optional small caption. Write numbers as digits. Then run again with the same link and your scenes." },
        { label: "Photos on the page", text: pics.map((u, i) => (i + 1) + ". " + u).join("\n") },
        { label: "What the page says", text },
      ],
    };
  }
  const list = parseScenes(scenes, pics.length);
  const bad = unsupported(list, text);
  if (bad.length) throw new Error("These numbers are not on the product page: " + bad.join(", ") + ". Use only facts from the page.");
  const chars = list.reduce((a, s) => a + s.narration.length, 0);
  if (chars > 700) throw new Error("The voice part is " + chars + " characters; keep it under 700 (about 45 seconds)");
  let host = ""; try { host = new URL(link).hostname.replace(/^www\./, ""); } catch {}
  const video = await sp.run("video", "videokit.vertical-video", {
    disclosure: ("Facts and photos from " + host + " · AI voice").slice(0, 120),
    voice: voice || "jessica",
    scenes: list.map((s) => ({ image_url: pics[s.photo - 1], text: s.text, narration: s.narration, caption: s.caption, fit: "contain" })),
  });
  return {
    title: name + ": video ad from the product page",
    items: [
      { label: "Video", url: video.video_url },
      { label: "Scenes", text: list.map((s, i) => (i + 1) + ". " + s.text + " (voice: " + s.narration + ")").join("\n") },
      { label: "Checked", text: "Every number in the video appears on " + host + ". Length " + video.duration_s + " seconds. Photos are the page's own; voice is AI." },
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
