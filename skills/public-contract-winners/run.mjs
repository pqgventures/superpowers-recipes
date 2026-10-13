// Superpowers recipe: the Brazilian companies that won a public contract in your field this week.
// No model call: reads the newest contracts on PNCP (the national public-procurement portal) for the words you give,
// keeps those published in the window, drops individuals and MEIs, groups by company and looks up each company's
// public registry record. They just got work and money, so they need suppliers now. Public data; under a cent a run.
export const recipe = {
  slug: "public-contract-winners",
  order: 13,
  name: "Companies that just won a public contract in your field",
  description: "Name the kind of work (for example paving, school meals, IT support). Get the Brazilian companies that won a government contract for it in the last days: who won, how much, which agency and where, with each company's city and main activity. They just got work to deliver, so they need suppliers, equipment, staff and insurance now.",
  inputs: {
    work: { title: "Kind of work", description: "What the winners were hired to do, in Portuguese, e.g. pavimentação, merenda escolar, suporte de TI", example: "pavimentação", required: true, maxLength: 80 },
    states: { title: "States (optional)", description: "Two-letter states separated by commas, e.g. PR, SC, RS. Empty means all of Brazil", maxLength: 90 },
    days: { title: "Days back", description: "How many days of contracts, 1 to 30", default: "7" },
    companies: { title: "How many companies", description: "Companies to list, 1 to 15, largest contracts first", default: "10" },
  },
  uses: { "pncp.search": 2, "brasilapi.cnpj": 15 },
  share: { review: false },
};

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
export function states(text) {
  const out = [];
  for (const s of String(text || "").toUpperCase().split(/[^A-Z]+/).filter(Boolean)) {
    if (!UFS.includes(s)) throw new Error("Unknown state: " + s + ". Use two-letter codes like SP, PR, RS");
    if (!out.includes(s)) out.push(s);
  }
  return out;
}
const MEI = /^\d{2}\.?\d{3}\.?\d{3}\s/;
export function isCompany(s) {
  if (!s) return false;
  const id = String(s.id || "").replace(/\D/g, ""), name = String(s.name || "").trim();
  return id.length === 14 && !MEI.test(name) && !/\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(name);
}
export function winners(results, since) {
  const g = new Map();
  for (const r of results) {
    if (r.cancelled || !r.published_at || r.published_at.slice(0, 10) < since || !isCompany(r.supplier)) continue;
    const id = String(r.supplier.id).replace(/\D/g, "");
    const w = g.get(id) || { cnpj: id, name: r.supplier.name.trim(), total: 0, contracts: [] };
    if (w.contracts.some((c) => c.url === r.url)) continue;
    w.total += Number(r.contract_value) || 0;
    w.contracts.push({ agency: r.agency?.name || "", city: r.city || "", uf: r.uf || "", value: Number(r.contract_value) || 0, date: r.published_at.slice(0, 10), object: String(r.object || "").replace(/\s+/g, " ").trim(), url: r.url });
    g.set(id, w);
  }
  return [...g.values()].sort((a, b) => b.total - a.total);
}
export const brl = (v) => "R$ " + Math.round(v).toLocaleString("pt-BR");
const activity = (a) => String(a || "").replace(/^[\d.\-/]+\s*/, "").trim();
const title = (s) => String(s || "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
// Some agencies send text double-encoded (Ã§ for ç); undo it when it decodes cleanly.
export function fixText(s) { s = String(s || ""); if (!/Ã./.test(s)) return s; try { return decodeURIComponent(escape(s)); } catch { return s; } }
// A registry name that is a person's (empresario individual, no partners and no company word) stays out of the list.
const FIRM = /\b(LTDA|LTD|S\.?\/?A|EIRELI|EPP|ME|CONS[OÓ]RCIO|COOPERATIVA|ASSOCIA\w*|CONSTRU\w*|ENGENHARIA|PAVIMENT\w*|INFRA\w*|SERVI\w*|COM[EÉ]RCIO|IND[UÚ]STRIA|TRANSPORT\w*|OBRAS|EMPREEND\w*|TERRAPLAN\w*|SOLU\w*|TECNOLOGIA|SISTEMAS|ALIMENT\w*|GRUPO|HOLDING|USINA|CONCRET\w*|ARTEFATOS|LOCA\w*|MINERA\w*|AMBIENTAL|PROJETOS|SANEAMENTO|EL[EÉ]TRIC\w*|EDIFICA\w*)\b/i;
export function looksLikePerson(name, partners) { return !FIRM.test(String(name || "")) && !(partners || []).length; }
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

export async function run(sp, { work, states: st, days, companies }) {
  const q = String(work || "").trim();
  if (q.length < 3) throw new Error("Say what kind of work, e.g. pavimentação");
  const ufs = states(st);
  const nd = Math.min(30, Math.max(1, Math.round(Number(days) || 7)));
  const nc = Math.min(15, Math.max(1, Math.round(Number(companies) || 10)));
  const since = new Date(Date.now() - nd * 864e5).toISOString().slice(0, 10);
  let results = [];
  for (const page of [1, 2]) {
    const r = await sp.run("contracts-" + page, "pncp.search", { query: q, type: "contract", sort: "newest", limit: 50, page, ...(ufs.length ? { states: ufs } : {}) });
    const got = r.results || [];
    results = results.concat(got);
    // PNCP's newest-first order is loose, so read both pages unless the first came back short or entirely before the window.
    if (got.length < 50 || got.every((x) => (x.published_at || "").slice(0, 10) < since)) break;
  }
  const inWindow = results.filter((r) => !r.cancelled && (r.published_at || "").slice(0, 10) >= since);
  const all = winners(results, since);
  if (!all.length) return { title: "No company won a public contract for \"" + q + "\" since " + since, items: [{ label: "Nothing in the window", text: "PNCP has no contracts for these words published since " + since + (ufs.length ? " in " + ufs.join(", ") : "") + ". Try the words agencies use in the contract (for example \"pavimentação asfáltica\" or \"merenda escolar\"), more days, or no state filter." }] };
  const top = []; let skipped = 0;
  for (const [i, w] of all.entries()) {
    if (top.length >= nc || i >= nc + 5) break;
    const c = await sp.run("company-" + i, "brasilapi.cnpj", { cnpj: w.cnpj }).catch(() => null);
    if (c && looksLikePerson(c.legal_name || w.name, c.partners)) { skipped++; continue; }
    w.company = c ? { status: c.status || "", activity: activity(c.main_activity), city: title(c.city), uf: c.uf || "", opened: c.opened || "" } : null;
    top.push(w);
  }
  const total = inWindow.reduce((s, r) => s + (Number(r.contract_value) || 0), 0);
  const items = [{ label: "This week in short", text: inWindow.length + " contracts for \"" + q + "\" published on PNCP since " + since + (ufs.length ? " in " + ufs.join(", ") : "") + ", worth " + brl(total) + " in all, won by " + all.length + " suppliers. The " + top.length + " largest companies are below" + (skipped ? " (" + skipped + " registered to a person were left out)" : "") + "; individuals and MEIs are never listed. PNCP matches words loosely, so read each contract's subject." }];
  for (const w of top) {
    const c = w.contracts[0], co = w.company;
    const where = co && co.city ? co.city + "/" + co.uf : title(c.city) + "/" + c.uf;
    const more = w.contracts.length > 1 ? " (+" + (w.contracts.length - 1) + " more contract" + (w.contracts.length > 2 ? "s" : "") + ")" : "";
    items.push({ label: clip(title(w.name), 80), url: c.url, caption: clip(title(w.name) + " won " + brl(w.total) + more + " · " + title(c.agency) + " (" + c.uf + "), " + c.date + " · company in " + where + (co && co.activity ? ", " + co.activity : "") + " · " + fixText(c.object), 300) });
  }
  items.push({ label: "How to use it", text: "These companies just signed public contracts, so they need equipment, materials, staff, insurance and credit to deliver. Open each contract for the scope and dates, check the company's CNPJ " + top.map((w) => w.cnpj).join(", ") + " before you call, and run this again next week." });
  return { title: "Won a public contract for \"" + q + "\" since " + since, items };
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
