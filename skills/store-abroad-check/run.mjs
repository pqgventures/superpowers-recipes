// Superpowers recipe: how your store looks to shoppers abroad. One real browser visit per country through a home
// connection there, a screenshot of what loads, and the status the site answered. No AI step: the agent compares the
// screenshots itself (popups, currency, shipping banners, store pickers, cookie notices, blank or blocked pages).
export const recipe = {
  slug: "store-abroad-check",
  order: 27,
  name: "How your store looks abroad",
  description: "Paste a product or home page and pick up to five countries. See the page the way a shopper in each country sees it, one screenshot per country from a home connection there, side by side, with the status the site answered.",
  inputs: {
    url: { title: "Page", description: "A product, collection or home page", example: "https://www.allbirds.com/products/mens-tree-runners", required: true, maxLength: 2000 },
    countries: { title: "Countries", description: "Up to five two-letter codes, separated by commas (us, gb, de, fr, br, jp...)", default: "us, gb, de, jp" },
    full_page: { title: "Whole page", description: "yes to capture the whole scroll height, no for the first screen", default: "no" },
  },
  uses: { "mrscraper.geo-screenshot": 5 },
  share: { review: false },
};

const SHOT = "mrscraper.geo-screenshot";
const data = (r) => (r && r.output !== undefined ? r.output : r) ?? {};
const NAMES = { us: "United States", gb: "United Kingdom", uk: "United Kingdom", de: "Germany", fr: "France", es: "Spain", it: "Italy", nl: "Netherlands", br: "Brazil", mx: "Mexico", ca: "Canada", au: "Australia", jp: "Japan", in: "India", sg: "Singapore", ae: "United Arab Emirates" };
export function countries(text) {
  const out = [];
  for (const raw of String(text || "us").toLowerCase().split(/[,;\s]+/)) {
    const c = raw === "uk" ? "gb" : raw.trim();
    if (/^[a-z]{2}$/.test(c) && !out.includes(c)) out.push(c);
  }
  return out.slice(0, 5);
}
export function page(u) {
  let s = String(u || "").trim(); if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const x = new URL(s); if (!/\./.test(x.hostname)) throw new Error("Give a public page, e.g. https://www.allbirds.com/products/mens-tree-runners");
  return x.href;
}

export async function run(sp, { url, countries: list, full_page }) {
  const target = page(url);
  const cs = countries(list); if (!cs.length) throw new Error("Pick at least one country, e.g. us, gb, de");
  const full = /^(y|yes|true|1)$/i.test(String(full_page || ""));
  const shots = [], failed = [];
  for (const [i, c] of cs.entries()) {
    try {
      const r = data(await sp.run("shot-" + c, SHOT, { url: target, country: c, full_page: full }));
      shots.push({ c, status: r.status_code ?? null, image: r.image_url, w: r.width, h: r.height });
    } catch (e) { failed.push(c); }
  }
  const name = (c) => NAMES[c] ?? c.toUpperCase();
  const odd = shots.filter((s) => s.status && s.status !== 200);
  return {
    title: "How " + new URL(target).hostname.replace(/^www\./, "") + " looks from " + shots.map((s) => name(s.c)).join(", "),
    items: [
      { label: "Summary", text: shots.length + " of " + cs.length + " countries loaded on " + new Date().toISOString().slice(0, 10) + ", each from a home connection in that country: " + shots.map((s) => name(s.c) + " " + (s.status ?? "?")).join(", ") + "." + (odd.length ? " Not a normal page (status other than 200): " + odd.map((s) => name(s.c)).join(", ") + "." : "") + (failed.length ? " Could not load from: " + failed.map(name).join(", ") + " (not charged)." : "") + " Compare the screenshots for popups, currency, shipping and store-picker banners, cookie notices and blank or blocked pages." },
      ...shots.map((s) => ({ label: name(s.c) + " · status " + (s.status ?? "?"), url: s.image })),
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
