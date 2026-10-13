// Superpowers recipe: competitor Google ads. For each competitor website, the ads it ran on Google (Search, YouTube,
// Shopping, Maps, Play) in the last 7 or 30 days: how many Google reports, the formats, which started in the window, and the
// ones that have run longest. Every number is computed in code from Google's Ads Transparency Center data; no AI writing step.
export const recipe = {
  slug: "competitor-google-ads",
  order: 24,
  name: "Competitor Google ads",
  description: "Name up to four competitor websites: see the Google ads each one is running, which started recently, the formats they use and the ones they have kept running longest, each linked to Google's public Ads Transparency Center.",
  inputs: {
    competitors: { title: "Competitor websites", description: "Up to four websites, separated by commas", example: "allbirds.com, glossier.com", required: true, maxLength: 200 },
    days: { title: "Window", description: "7 or 30 days", default: "30" },
    country: { title: "Country", description: "Two-letter country code where the ads ran", default: "US" },
  },
  uses: { "searchapi.google-ads": 4 },
  share: { review: false },
};

const ADS = "searchapi.google-ads";
export const site = (s) => String(s ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
const day = (s) => String(s ?? "").slice(0, 10);

// Pure summary of one brand's sample, so the test can check it without calling anything.
export function summarize(ads, since) {
  const formats = {};
  for (const a of ads) formats[a.format ?? "unknown"] = (formats[a.format ?? "unknown"] ?? 0) + 1;
  const started = ads.filter((a) => day(a.first_shown) >= since).sort((a, b) => day(b.first_shown).localeCompare(day(a.first_shown)));
  const longest = [...ads].sort((a, b) => (b.days_shown ?? 0) - (a.days_shown ?? 0)).slice(0, 5);
  return { sampled: ads.length, formats, started, longest };
}

export async function run(sp, { competitors, days, country }) {
  const sites = String(competitors).split(",").map(site).filter((s) => /\./.test(s)).slice(0, 4);
  if (!sites.length) throw new Error("Give at least one competitor website, e.g. allbirds.com");
  const win = Number(days) === 7 ? 7 : 30;
  const cc = String(country || "US").toUpperCase().slice(0, 2);
  const since = new Date(Date.now() - win * 864e5).toISOString().slice(0, 10);
  const brands = [];
  for (const [i, s] of sites.entries()) {
    const r = await sp.run("ads-" + i, ADS, { domain: s, region: cc, time_period: win === 7 ? "last_7_days" : "last_30_days", num: 24 });
    const ads = r.ads ?? [];
    // Ads pointing to the site but paid for by an account whose name does not carry the brand (resellers, look-alikes).
    const brand = s.split(".")[0].replace(/[^a-z0-9]/g, "");
    const own = ads.filter((a) => String(a.advertiser ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(brand));
    const others = ads.filter((a) => !own.includes(a));
    brands.push({ site: s, advertiser: own[0]?.advertiser ?? ads[0]?.advertiser ?? s, reported: r.total_results ?? ads.length, others, ...summarize(ads, since) });
  }
  const fmt = (f) => Object.entries(f).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + " " + k).join(", ");
  const line = (a) => day(a.first_shown) + " to " + day(a.last_shown) + " · " + (a.days_shown ?? "?") + " days · " + (a.format ?? "ad") + "\n" + a.details_link;
  const summary = brands.map((b) => b.advertiser + " (" + b.site + "): Google reports about " + b.reported + " ads shown in " + cc + " in the last " + win + " days. Of the " + b.sampled + " it lists first: " + (fmt(b.formats) || "none") + "; " + b.started.length + " started in the window; longest running " + (b.longest[0]?.days_shown ?? 0) + " days." + (b.others.length ? " " + b.others.length + " of them paid for by an advertiser that does not carry the brand name: " + [...new Set(b.others.map((a) => a.advertiser))].join(", ") + "." : "")).join("\n");
  return {
    title: "Competitor Google ads: " + sites.join(", ") + " (last " + win + " days, " + cc + ")",
    items: [
      { label: "Summary", text: summary + "\n\nSource: Google Ads Transparency Center. Counts are Google's estimate at the moment you run this; the lists come from the first 24 ads Google shows per brand." },
      ...brands.filter((b) => b.others.length).map((b) => ({ label: b.site + ": ads paid for by other advertisers", text: b.others.map((a) => (a.advertiser ?? "unknown advertiser") + " · " + line(a)).join("\n\n") })),
      ...brands.filter((b) => b.longest.length).map((b) => ({ label: b.advertiser + ": kept live longest", text: b.longest.map(line).join("\n\n") })),
      ...brands.filter((b) => b.started.length).map((b) => ({ label: b.advertiser + ": started in the last " + win + " days", text: b.started.slice(0, 10).map(line).join("\n\n") })),
      ...brands.flatMap((b) => b.longest.filter((a) => a.image_url).slice(0, 3).map((a) => ({ label: b.advertiser + " · " + (a.format ?? "ad") + " · " + (a.days_shown ?? "?") + " days", url: a.image_url }))),
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
