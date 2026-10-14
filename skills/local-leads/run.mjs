// Superpowers recipe: local business leads from Google Maps, with phones and websites, and public emails on request.
// Was the "local-leads" job; POST /v1/jobs/local-leads still runs this recipe (src/jobs.ts) and returns result.data.
export const recipe = {
  slug: "local-leads",
  order: 18,
  name: "Find local leads with phone numbers",
  description: "Businesses of any type in a city from Google Maps, up to 20, each with phone, address, website, rating and number of reviews, in one list ready to call. Add emails=yes and it also looks up public emails on each website (about 5¢ more per business).",
  inputs: {
    query: { title: "Kind of business", description: "What you would search on Google Maps", example: "dentist", required: true, maxLength: 80 },
    location: { title: "City", description: "City and state or country", example: "Campinas, SP", required: true, maxLength: 80 },
    max: { title: "How many", description: "Up to 20 businesses", default: "10", maxLength: 2, hidden: true },
    emails: { title: "Find emails", description: "yes to look up public emails on each business's website (about 5¢ per business)", default: "no", maxLength: 5, hidden: true },
    country: { title: "Country", description: "Two-letter code for the Maps search, like us or br", maxLength: 2, hidden: true },
    language: { title: "Language", description: "Two-letter code, like en or pt", maxLength: 5, hidden: true },
  },
  uses: { "serper.google-places": 1 },
  share: { review: false },
};

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const yes = (v) => v === true || /^(1|y|yes|true|sim|s)$/i.test(String(v ?? "").trim());

export async function run(sp, { query, location, max, emails, country, language }) {
  const n = Math.min(Math.max(parseInt(max, 10) || 10, 1), 20);
  const m = await sp.run("places", "serper.google-places", { query, location, ...(country ? { country } : {}), ...(language ? { language } : {}) });
  const leads = (m.places ?? []).slice(0, n);
  if (!leads.length) throw new Error("Google Maps returned no " + query + " in " + location);
  if (yes(emails)) for (const [i, p] of leads.entries()) {
    const d = host(p.website ?? ""); if (!d) continue;
    try { const c = await sp.run("emails-" + (i + 1), "hunter.domain-search", { domain: d, limit: 3 }); p.emails = (c.emails ?? []).map((e) => e.email).filter(Boolean); }
    catch (e) { p.emails_error = e.message; }
  }
  const line = (p) => [p.phone, p.address, p.rating != null ? "★ " + p.rating + (p.reviews != null ? " (" + p.reviews + " reviews)" : "") : null, p.emails?.length ? p.emails.join(", ") : null].filter(Boolean).join("\n");
  return {
    title: leads.length + " " + query + " in " + location,
    items: leads.map((p) => (p.website ? { kind: "link", url: p.website, label: p.name, text: line(p) } : { label: p.name, text: line(p) || "No phone or website listed" })),
    data: { query, location, leads },
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
