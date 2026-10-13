// Superpowers recipe: a PitchBook-style profile of a private company from its website.
// Profile (ownership, headcount, revenue and valuation bands, leadership, business model, customers, strategic signals),
// recent news grouped by event, and funding rounds; every line keeps its source link.
export const recipe = {
  slug: "private-company-profile",
  order: 13,
  name: "Private company profile from a website",
  description: "Give a company website; get a one-page profile of a private company: what it does, who owns it, size, revenue and valuation estimates, leaders, how it makes money, its customers, recent funding and news, each with a source.",
  inputs: {
    company: { title: "Company website", description: "e.g. ramp.com", example: "ramp.com", required: true, maxLength: 120 },
  },
  uses: { "akta.company-profile": 1, "akta.company-firmographics": 1, "akta.company-news": 1, "predictleads.company-signals": 2 },
  share: { review: false },
};

export function site(v) {
  const d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(d)) throw new Error("Give the company's website, e.g. ramp.com");
  return d;
}
const src = (u) => (u ? " (" + u + ")" : "");
const money = (n) => (n == null ? "" : n >= 1e9 ? "$" + (n / 1e9).toFixed(n % 1e9 ? 2 : 0) + "B" : n >= 1e6 ? "$" + Math.round(n / 1e6) + "M" : "$" + n);

export async function run(sp, { company }) {
  const d = site(company);
  // The full profile (revenue and valuation bands, leaders, business model) when it is available; otherwise the basics.
  let prof, full = true;
  try { prof = await sp.run("profile", "akta.company-profile", { company: d }); }
  catch { full = false; prof = await sp.run("basics", "akta.company-firmographics", { company: d }); }
  const [news, funding, jobs] = await Promise.all([
    sp.run("news", "akta.company-news", { company: d, limit: 15 }).catch(() => ({ articles: [] })),
    sp.run("funding", "predictleads.company-signals", { domain: d, signal: "funding", limit: 20 }).catch(() => ({ signals: [] })),
    sp.run("jobs", "predictleads.company-signals", { domain: d, signal: "jobs", limit: 50 }).catch(() => ({ signals: [] })),
  ]);
  const p = prof.profile || {};
  const roles = jobs.signals || [];
  const byDept = {};
  for (const j of roles) { const k = String((j.categories || [])[0] || "other").replace(/_/g, " ").replace(/^software development$/, "engineering").replace(/^human resources$/, "HR"); byDept[k] = (byDept[k] || 0) + 1; }
  const hiring = roles.length ? roles.length + (roles.length === 50 ? "+" : "") + " open roles found" + (Object.keys(byDept).length > 1 ? ": " + Object.entries(byDept).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => k + " " + v).join(", ") : "") + "\n" + roles.slice(0, 5).map((j) => (j.title || "role") + (j.location ? " · " + String(j.location).split(",").slice(0, 2).join(",") : "") + src(j.url)).join("\n") : "No open roles found";
  const facts = [
    p.description,
    [p.type, p.ownership, p.status].filter(Boolean).join(" · "),
    [p.founded_year ? "Founded " + p.founded_year : "", p.hq ? "HQ " + p.hq : "", p.headcount_range ? p.headcount_range + " employees" : ""].filter(Boolean).join(" · "),
    [p.revenue_estimate ? "Revenue estimate " + p.revenue_estimate : "", p.valuation_estimate ? "valuation estimate " + p.valuation_estimate : ""].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n");
  const rounds = (funding.signals || []).filter((f) => f.type || f.amount_usd).sort((x, y) => String(y.date || "").localeCompare(String(x.date || ""))).slice(0, 10)
    .map((f) => [f.date ? String(f.date).slice(0, 10) : "date unknown", f.type || "round", money(f.amount_usd) || f.amount || ""].filter(Boolean).join(" · ") + src((f.sources || [])[0]));
  const moves = (p.signals || []).slice(0, 10).map((s) => (s.type || s.kind) + ": " + (s.value ? s.value + " — " : "") + s.description + src(s.source));
  const articles = (news.articles || []).slice(0, 10).map((a) => a.date + " · " + a.title + (a.summary ? " — " + a.summary : "") + src(a.url));
  const title = (p.name || d) + ": company profile";
  return {
    title,
    items: [
      { label: "At a glance", text: facts || "No profile data found for " + d },
      ...(full ? [
        { label: "Leadership", text: (p.leadership || []).map((l) => l.name + ", " + l.title).join("\n") || "Not listed" },
        { label: "How it makes money", text: (p.business_model || []).map((b) => (b.title || b.type) + ": " + b.description + src(b.source)).join("\n") || "Not listed" },
        { label: "Customers", text: (p.customers || []).map((c) => (c.title || c.type) + ": " + c.description).join("\n") || "Not listed" },
      ] : []),
      { label: "Hiring", text: hiring },
      { label: "Funding rounds", text: rounds.join("\n") || "No rounds found in the funding feed; see news and strategic moves." },
      ...(full ? [{ label: "Strategic moves", text: moves.join("\n") || "None listed" }] : []),
      { label: "Recent news", text: articles.join("\n") || "No news in the last 6 months" },
      { label: "About this profile", text: (full ? "Estimates (revenue, valuation, headcount) are bands from public sources, not reported figures." : "Basics only (ownership, founded, headcount band): the full profile with revenue and valuation estimates, leaders and business model was not available for this run.") + " Funding rounds come from news coverage and open roles from the company's job board; news shows the newest stories that mention the company. Each line links its source." },
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
