// Superpowers recipe: people on one team at your target companies, with work emails checked twice.
// For each company: the team's people with roles and the finder's last verification; then an independent deliverability check per email.
export const recipe = {
  slug: "verified-lead-list",
  order: 7,
  name: "Verified emails for a team at your target companies",
  description: "Give a list of companies and a team (marketing, sales, engineering...). Get the people on that team with their roles and work emails, each email checked twice, and what each good email cost.",
  inputs: {
    companies: { title: "Companies", description: "Company websites, separated by commas (up to 15)", example: "linear.app, ramp.com, vanta.com", required: true, maxLength: 600 },
    team: { title: "Team", description: "marketing, sales, executive, it, finance, operations, design, support, hr, legal, management, communication, education or health", default: "marketing" },
    seniority: { title: "Level (optional)", description: "junior, senior or executive" },
    double_check: { title: "Second check", description: "yes (check every email again, about 1 cent each) or no", default: "yes" },
  },
  uses: { "hunter.domain-search": 8, "millionverifier.verify-email": 50, "abstract.email-check": 50 },
  share: { review: false },
};

const TEAMS = ["executive", "it", "finance", "management", "sales", "legal", "support", "hr", "marketing", "communication", "education", "design", "health", "operations"];
export function domains(text) {
  const out = [];
  for (const raw of String(text || "").split(/[,\n;\s]+/)) {
    const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
    if (/^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(d) && !out.includes(d)) out.push(d);
  }
  return out;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MV = { ok: "deliverable", invalid: "undeliverable", disposable: "undeliverable", catch_all: "catch-all", unknown: "unknown" };
// Second check: MillionVerifier first; if it fails (out of credits, down), the slower Abstract checker (one request per second).
async function secondCheck(sp, i, email) {
  try { const v = await sp.run("check-" + i, "millionverifier.verify-email", { email }); if (v && MV[v.result]) return MV[v.result]; } catch {}
  try { const v = await sp.run("check2-" + i, "abstract.email-check", { email }); await sleep(1100); return v.status || (v.deliverable ? "deliverable" : "unknown"); }
  catch { return "not checked"; }
}

export async function run(sp, { companies, team, seniority, double_check }) {
  const list = domains(companies);
  if (!list.length) throw new Error("Give at least one company website, e.g. linear.app");
  if (list.length > 15) throw new Error("At most 15 companies per run");
  const dept = String(team || "marketing").toLowerCase();
  if (!TEAMS.includes(dept)) throw new Error("Team must be one of " + TEAMS.join(", "));
  const level = seniority ? String(seniority).toLowerCase() : "";
  if (level && !["junior", "senior", "executive"].includes(level)) throw new Error("Level must be junior, senior or executive");
  const check = String(double_check ?? "yes").toLowerCase() !== "no";

  const people = [];
  for (const [i, d] of list.entries()) {
    const r = await sp.run("find-" + i, "hunter.domain-search", { domain: d, department: dept, limit: 10, ...(level ? { seniority: level } : {}) });
    for (const e of r.emails ?? []) people.push({ company: r.organization || d, domain: d, name: e.name, role: e.position || "", email: e.email, confidence: e.confidence, finder: e.verification || "unknown" });
  }
  if (check) {
    for (const [i, p] of people.entries()) p.deliverable = await secondCheck(sp, i, p.email);
  }
  const good = people.filter((p) => p.finder === "valid" && (!check || p.deliverable === "deliverable"));
  const unchecked = check ? people.filter((p) => p.deliverable === "not checked").length : 0;
  // Many company mail servers accept any address (catch-all): the second check cannot confirm those, so they are a separate tier.
  const acceptAll = check ? people.filter((p) => p.finder === "valid" && p.deliverable === "catch-all").length : 0;
  const failed = check ? people.filter((p) => p.deliverable === "undeliverable").length : 0;
  const byCompany = list.map((d) => ({ d, rows: people.filter((p) => p.domain === d) }));
  const line = (p) => p.name + " · " + (p.role || "role not listed") + " · " + p.email + " · finder: " + p.finder + (check ? " · second check: " + p.deliverable : "");
  return {
    title: "Verified " + dept + " emails at " + list.length + " compan" + (list.length === 1 ? "y" : "ies"),
    items: [
      { label: "Result", text: people.length + " people found on the " + dept + " team at " + byCompany.filter((c) => c.rows.length).length + " of " + list.length + " companies. " + good.length + " emails passed " + (check ? "both checks (marked valid by the finder and deliverable on a second check)." : "the finder's verification.") +
        (acceptAll ? " " + acceptAll + " more are marked valid by the finder at companies whose mail server accepts any address, so the second check cannot confirm them: send to those with care." : "") +
        (failed ? " " + failed + " failed the second check: do not send to them." : "") +
        (unchecked ? " The second check could not run for " + unchecked + " emails (the checker was unavailable); they are marked not checked." : "") },
      ...byCompany.map((c) => ({ label: c.d, text: c.rows.length ? c.rows.map(line).join("\n") : "No one found on this team." })),
      { label: "Good to know", text: "Some companies accept mail for any address (catch-all), so a deliverable result there means the server accepts it, not that the person reads it. Contact details come from public sources; follow anti-spam rules when you write to them." },
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
