// Superpowers recipe: which of your target accounts just raised money, and who else in your segment did.
// No model call: looks up each website's latest funding round, keeps those announced inside your window,
// lists the rest with their last round date, and adds other companies in your segment that raised in the window.
export const recipe = {
  slug: "funding-signals-watch",
  order: 15,
  name: "Which of your target accounts just raised money",
  description: "Paste the websites of the companies you sell to. See which ones announced a funding round in the last days (round, amount, date and the news link), when the others last raised, and which other companies in your industry raised in the same days. Reach out while they have fresh budget.",
  inputs: {
    accounts: { title: "Your target accounts", description: "Company websites, separated by commas or new lines, up to 25", example: "ramp.com, dailypay.com, usevesta.com, stripe.com, brex.com, mercury.com", required: true, maxLength: 2000 },
    days: { title: "Days back", description: "How recent a round counts, 1 to 90", default: "30" },
    industry: { title: "Your segment: industry (optional)", description: "Also list other companies in this industry that raised, e.g. fintech, healthcare, artificial intelligence", example: "fintech", maxLength: 80 },
    location: { title: "Your segment: place (optional)", description: "City, state or country, e.g. United States, Germany, San Francisco", example: "United States", maxLength: 80 },
    segment_size: { title: "How many segment companies", description: "0 to 15 (3 per call). 0 skips the segment", default: "9" },
  },
  uses: { "fundable.company-funding": 25, "fundable.funded-companies": 5 },
  share: { review: false },
};

const ROUNDS = { SEED: "seed round", PRE_SEED: "pre-seed round", EQUITY: "equity round", DEBT_FINANCING: "debt financing", GRANT: "grant", SECONDARY_MARKET: "secondary share sale", CONVERTIBLE_NOTE: "convertible note", CORPORATE_ROUND: "corporate round", PRIVATE_EQUITY: "private equity round", IPO: "IPO", POST_IPO_EQUITY: "post-IPO equity", POST_IPO_DEBT: "post-IPO debt" };
export function roundName(r) {
  if (!r) return "funding round";
  const ext = /_EXTENSION$/.test(r); const base = r.replace(/_EXTENSION$/, "");
  const m = base.match(/^(PRE_)?SERIES_([A-Z])$/);
  const name = m ? (m[1] ? "pre-" : "") + "Series " + m[2] : ROUNDS[base] || base.toLowerCase().replace(/_/g, " ");
  return name + (ext ? " extension" : "");
}
export function money(n) {
  if (!Number.isFinite(n) || n <= 0) return "amount not disclosed";
  if (n >= 1e9) return "US$" + String(Math.round(n / 1e7) / 100) + "B";
  if (n >= 1e6) return "US$" + (Math.round(n / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
  return "US$" + Math.round(n / 1e3) + "K";
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const when = (d) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? MON[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10)) + ", " + d.slice(0, 4) : "date unknown");
export function domains(text) {
  const out = [];
  for (const raw of String(text || "").split(/[\s,;]+/)) {
    const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    if (!d) continue;
    if (!/^([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(d)) throw new Error("Not a website: " + raw + ". Use forms like ramp.com");
    if (!out.includes(d)) out.push(d);
  }
  return out;
}
export const inWindow = (d, since) => !!d && d.slice(0, 10) >= since;
const clip = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "").replace(/[,;:]$/, "") + "…" : s);
function line(c) {
  const parts = [c.name + " · " + (c.domain || ""), roundName(c.round) + ", " + money(c.amount_usd) + ", announced " + when(c.announced)];
  if (c.employees) parts.push(c.employees + " employees");
  if (Number.isFinite(c.total_raised_usd) && c.total_raised_usd > 0) parts.push("total raised " + money(c.total_raised_usd));
  if (c.round_summary) parts.push(clip(String(c.round_summary), 220));
  return parts.join(" · ");
}

export async function run(sp, { accounts, days, industry, location, segment_size }) {
  const list = domains(accounts);
  if (!list.length) throw new Error("Give at least one website, e.g. ramp.com");
  if (list.length > 25) throw new Error("Up to 25 websites per run");
  const nd = Math.min(90, Math.max(1, Math.round(Number(days) || 30)));
  const since = new Date(Date.now() - nd * 864e5).toISOString().slice(0, 10);
  const seg = Math.min(15, Math.max(0, Math.round(Number(segment_size ?? 9))));
  const raised = [], older = [], missing = [];
  for (const [i, d] of list.entries()) {
    const r = await sp.run("account-" + (i + 1), "fundable.company-funding", { domain: d });
    if (!r || !r.found) { missing.push(d); continue; }
    const c = { ...r, domain: r.domain || d };
    (inWindow(c.announced, since) ? raised : older).push(c);
  }
  raised.sort((a, b) => String(b.announced).localeCompare(String(a.announced)));
  older.sort((a, b) => String(b.announced || "").localeCompare(String(a.announced || "")));
  const others = [];
  let segTotal = null;
  if (seg && (industry || location)) {
    const segDays = Math.min(nd, 365);
    for (let page = 0; others.length < seg && page < 5; page++) {
      const r = await sp.run("segment-" + (page + 1), "fundable.funded-companies", { days: segDays, limit: 3, page, ...(industry ? { industry: String(industry).trim() } : {}), ...(location ? { location: String(location).trim() } : {}) });
      segTotal = r.total ?? segTotal;
      for (const c of r.companies || []) if (others.length < seg && c.domain && !list.includes(String(c.domain).toLowerCase()) && !others.some((o) => o.domain === c.domain)) others.push(c);
      if (r.next_page == null) break;
    }
  }
  const segName = [industry, location].filter(Boolean).join(", ");
  const items = [{ label: "In short", text: raised.length + " of your " + list.length + " accounts announced a funding round since " + when(since) + (raised.length ? ": " + raised.map((c) => c.name + " (" + roundName(c.round) + ", " + money(c.amount_usd) + ")").join(", ") : "") + "." + (missing.length ? " " + missing.length + " website" + (missing.length > 1 ? "s were" : " was") + " not in the funding database." : "") + (segName && segTotal != null ? " In " + segName + ", " + segTotal + " companies raised in the same days; " + others.length + " of them are listed below." : "") }];
  for (const c of raised) items.push({ label: c.name, url: c.source || ("https://" + c.domain), caption: line(c) });
  if (older.length) items.push({ label: "Your other accounts, by last round", text: older.map((c) => c.name + ": " + roundName(c.round) + ", " + when(c.announced)).join("; ") + "." });
  if (missing.length) items.push({ label: "Not found", text: "No funding record for " + missing.join(", ") + ". They may be bootstrapped, public or listed under another website." });
  if (others.length) {
    items.push({ label: "Also raised in " + segName, text: "Companies not on your list that announced a round since " + when(since) + ", newest first." });
    for (const c of others) items.push({ label: c.name, url: c.source || ("https://" + c.domain), caption: line(c) });
  }
  items.push({ label: "How to use it", text: "A fresh round usually means new hiring and new budget. Open the news link before you write, mention the round in one line, and offer what helps them spend it well. Amounts and dates are what the announcement said; rounds announced late can be missing." });
  return { title: raised.length + " of your accounts just raised money", items };
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
