// Superpowers recipe: founders of startups that just raised, with verified work emails.
// Startups whose latest round was announced in the last N days (Fundable), the founder's name read from news and
// profiles in code (no AI step: named "founder"/"CEO" patterns, scored by how often and how close to the company name),
// then that person's verified work email at the company's website (Findymail).
export const recipe = {
  slug: "just-raised-founders",
  order: 25,
  name: "Founders of startups that just raised",
  description: "Pick a place, an industry and a round. Get the startups that announced that round in the last days, with the amount, date and news link, the founder's name with the sentence it came from, and the founder's verified work email.",
  inputs: {
    location: { title: "Where", description: "City, state or country in plain words", example: "United States", default: "United States", maxLength: 80 },
    industry: { title: "Industry", description: "In plain words: software, fintech, healthcare, artificial intelligence...", default: "software", maxLength: 80 },
    stages: { title: "Rounds", description: "pre-seed, seed, series-a, series-b, series-c, separated by commas", default: "seed, series-a" },
    days: { title: "Days back", description: "Round announced in the last N days, 1 to 60", default: "7" },
    companies: { title: "How many startups", description: "3, 6 or 9", default: "6" },
  },
  uses: { "fundable.funded-companies": 3, "linkup.search": 9, "findymail.find-email": 9 },
  share: { review: false },
};

const STAGES = ["pre-seed", "seed", "series-a", "series-b", "series-c", "series-d", "series-e"];
const data = (r) => (r && r.output !== undefined ? r.output : r) ?? {};
const NAME = "([A-Z][a-zà-ÿ'’-]+(?: [A-Z]\\.)?(?: [A-Z][a-zà-ÿ'’-]+){1,2})";
const CF = "[Cc]o-?[Ff]ounder", F = "[Ff]ounder", CE = "(?:CEO|[Cc]hief [Ee]xecutive [Oo]fficer)";
const ROLE = "(?:" + CF + "(?: and| &)? " + CE + "|" + F + "(?: and| &)? " + CE + "|" + CE + " and (?:" + CF + "|" + F + ")|" + CF + "|" + F + "|" + CE + ")";
const STOP = new Set(["The", "This", "Our", "Its", "His", "Her", "Series", "Seed", "Founded", "Founder", "Founders", "Chief", "CEO", "Inc", "Earlier", "Read", "Meet"]);
const LEAD = /^(?:Chart|Org|Meet|Read|By|From|With|Photo|Image|Credit|Source|Interview|Team|Profile|About|Today|Yesterday)$/;
const ORGWORDS = /^(?:Inc|Labs?|AI|Technologies|Technology|Tech|Imaging|Capital|Ventures|Partners|Management|Group|Systems|Health|Robotics|Software|Solutions|Studios?|Media|Audio|Machines|Bio|Therapeutics|Energy|Analytics|Network|Networks|Holdings|Company|Team|Board|Directors)$/;
// A "name" that shares a word (or a near spelling of one) with the company, or carries a company word, is not a person.
// Edit distance (insert, delete, replace), for misspelled company names ("Lumus" for "Lumius").
function edits(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function looksLikeCompany(n, company) {
  // Only when every word is company-like: a founder whose surname is in the company name (Smith Labs, John Smith) stays.
  const cw = String(company).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const near = (c, x) => c === x || (c.length > 4 && x.length > 4 && edits(c, x) <= 1);
  return n.split(" ").every((w) => ORGWORDS.test(w) || cw.some((c) => near(c, w.toLowerCase())));
}
export function founderCandidates(results, company) {
  const score = new Map();
  const add = (n, w, why) => { n = n.trim(); while (LEAD.test(n.split(" ")[0]) && n.split(" ").length > 2) n = n.split(" ").slice(1).join(" "); const first = n.split(" ")[0]; if (STOP.has(first) || looksLikeCompany(n, company)) return; const s = score.get(n) ?? { name: n, score: 0, evidence: [] }; s.score += w; if (s.evidence.length < 2) s.evidence.push(why); score.set(n, s); };
  const pats = [
    [new RegExp(NAME + ",? (?:the |its |a )?" + "(?:" + ROLE + ")\\b", "g"), 3],
    [new RegExp("\\b" + ROLE + ",? " + NAME, "g"), 3],
    [new RegExp("\\b[Ff]ounders?: " + NAME, "g"), 3],
    [new RegExp(NAME + " \\((?:" + ROLE + ")", "g"), 3],
  ];
  for (const r of results ?? []) {
    const text = (r.title ?? "") + "\n" + (r.content ?? "");
    for (const [re, w] of pats) {
      for (const m of text.matchAll(re)) {
        const n = m[1];
        if (!n || !/^[A-Z]/.test(n)) continue;
        const i = Math.max(0, m.index - 60); const quote = text.slice(i, m.index + m[0].length + 40).replace(/\s+/g, " "); add(n, w + (quote.toLowerCase().includes(String(company).toLowerCase()) ? 2 : 0), { url: r.url, quote });
      }
    }
  }
  return [...score.values()].sort((a, b) => b.score - a.score);
}

// The founder pick for one company: names in the round summary count too (Fundable often names the CEO there).
export function pickFounder(company, results) {
  const own = { title: company.name, url: company.source, content: [company.round_summary, company.description].filter(Boolean).join("\n") };
  const c = founderCandidates([own, ...(results ?? [])], company.name);
  return c[0] && c[0].score >= 5 ? c[0] : null;
}
const money = (n) => (n ? "$" + (n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : Math.round(n / 1e3) + "K") : "amount not disclosed");
const round = (s) => { const t = String(s ?? "").toLowerCase().replace(/_/g, " "); return t === "pre seed" ? "pre-seed" : t.replace(/^series ([a-e])$/, (_, x) => "Series " + x.toUpperCase()); };

export async function run(sp, { location, industry, stages, days, companies }) {
  const want = Math.min(9, Math.max(3, Math.round((Number(companies) || 6) / 3) * 3));
  const st = String(stages || "seed, series-a").toLowerCase().split(/[,;\n]+/).map((s) => s.trim().replace(/\s+/g, "-").replace(/^series(?=[a-e]$)/, "series-")).filter((s) => STAGES.includes(s));
  const d = Math.min(60, Math.max(1, Math.round(Number(days) || 7)));
  const filters = { days: d, limit: 3 };
  if (location) filters.location = String(location).trim();
  if (industry) filters.industry = String(industry).trim();
  if (st.length) filters.stages = st;
  const list = []; let total = 0;
  for (let p = 0; p < want / 3; p++) {
    const r = data(await sp.run("startups-" + p, "fundable.funded-companies", { ...filters, page: p }));
    total = r.total ?? total;
    list.push(...(r.companies ?? []));
    if ((r.companies ?? []).length < 3) break;
  }
  if (!list.length) throw new Error("No startup matched: try a wider place, another industry, more rounds or more days.");
  const rows = [];
  for (const [i, c] of list.entries()) {
    const s = data(await sp.run("founder-search-" + i, "linkup.search", { query: c.name + " " + c.domain + " founder CEO", max_results: 8 }));
    const f = pickFounder(c, s.results);
    let e = null;
    if (f && c.domain) e = data(await sp.run("email-" + i, "findymail.find-email", { name: f.name, domain: c.domain }));
    rows.push({ c, f, e });
  }
  const found = rows.filter((r) => r.e?.found);
  const line = (r) => [r.c.name + " (" + r.c.domain + ") · " + round(r.c.round) + " " + money(r.c.amount_usd) + " · announced " + r.c.announced + (r.c.city ? " · " + r.c.city : ""),
    r.f ? "Founder: " + r.f.name + (r.e?.found ? " · " + r.e.email + " (verified)" : r.e ? " · no verified email found" : "") : "Founder: not named in the sources read; look it up before you write",
    r.f ? "Name from: \"" + r.f.evidence[0].quote + "\" " + (r.f.evidence[0].url ?? "") : null,
    "News: " + (r.c.source ?? "")].filter(Boolean).join("\n");
  return {
    title: "Founders of " + (filters.industry ?? "") + " startups that raised in the last " + d + " days" + (filters.location ? " · " + filters.location : ""),
    items: [
      { label: "Summary", text: "Fundable lists " + total + " startups matching; these are the first " + list.length + ". Founder named for " + rows.filter((r) => r.f).length + ", verified work email for " + found.length + ". Job titles in email data can be old; use the title from the news. Check each name before you write: it is read from public pages, not confirmed by the company." },
      ...rows.map((r) => ({ label: r.c.name, text: line(r) })),
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
