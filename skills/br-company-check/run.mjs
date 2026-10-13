// Superpowers recipe: check a Brazilian supplier or client before you sign.
// One CNPJ in; out comes a verdict an approver can act on: Receita record and partners, public-company status,
// federal debarment registers (CEIS, CNEP), OFAC/UN/UK/EU sanctions for the company and its partners, and the
// official labor-debt certificate (CNDT, TST) as a PDF. All public data; about $0.02 a run.
export const recipe = {
  slug: "br-company-check",
  order: 0,
  name: "Check a supplier or client before you sign",
  description: "From a CNPJ: the company's official record and partners, federal debarment registers, international sanctions for the company and its partners, and the official labor-debt certificate as a PDF. One link with a clear verdict for whoever approves the deal.",
  inputs: {
    cnpj: { title: "CNPJ", description: "The company's CNPJ, with or without punctuation", example: "33.000.167/0001-01", required: true, maxLength: 20 },
    lang: { title: "Language", description: "Language of the result: en (default) or pt", default: "en", maxLength: 5, hidden: true },
  },
  uses: { "dossier.br-company": 1, "operator.cndt": 1 },
  i18n: { "pt-BR": {
    name: "Verifique um fornecedor ou cliente antes de fechar",
    description: "A partir do CNPJ: cadastro oficial e sócios, cadastros federais de empresas punidas (CEIS e CNEP), sanções internacionais da empresa e dos sócios e a certidão trabalhista oficial em PDF. Um link com um veredito claro para quem aprova o negócio.",
    inputs: { cnpj: { title: "CNPJ", description: "O CNPJ da empresa, com ou sem pontuação" } } } },
  share: { review: false },
};

const T = {
  en: {
    title: "Company check: ", go: "OK to proceed", warn: "Proceed with care", stop: "Stop and review",
    verdict: "Verdict", why: "Why", record: "Official record", opened: "opened", activity: "Activity", capital: "Share capital", partners: "Partners and directors",
    andMore: (n) => "and " + n + " more", listed: (c) => "Public company registered with CVM (code " + c + ")", notListed: "Not a public company",
    debarOk: "Not on the federal debarment registers (CEIS, CNEP)", debarHit: (n) => n + " active entr" + (n === 1 ? "y" : "ies") + " on the federal debarment registers (CEIS/CNEP)", debarOld: (n) => n + " past entr" + (n === 1 ? "y" : "ies") + " on CEIS/CNEP, none in force",
    sancOk: (n, l) => "No sanctions match for the company or " + n + " partners (" + l + ")", sancHit: (n) => n + " possible sanctions match" + (n === 1 ? "" : "es") + ": similar names are common, review before deciding", sancWeak: (n) => n + " loose name match" + (n === 1 ? "" : "es") + " on sanctions lists, most likely a different entity; glance at it before signing", sancPartial: "Sanctions screening was incomplete; run it again before relying on it",
    cndt: { negativa: "Labor-debt certificate: clear (negative)", positiva_com_efeitos_de_negativa: "Labor-debt certificate: positive with effect of negative (debts under discussion or guaranteed)", positiva: "Labor-debt certificate: positive (unpaid labor-court debts)" },
    cndtValid: (d) => "valid until " + d, cndtCases: (n) => n + " case" + (n === 1 ? "" : "s") + " listed", cndtNone: "Labor-debt certificate could not be issued right now; run again to attach it",
    inactive: (s) => "Registration status is " + s, summaryLabel: "Summary", pdfLabel: "Labor-debt certificate (CNDT, TST)", sources: "Sources: Receita Federal, CVM, CGU (CEIS/CNEP), OFAC, UN, UK and EU lists, TST. A quick screen from public data, not legal due diligence.",
  },
  pt: {
    title: "Verificação de empresa: ", go: "Pode seguir", warn: "Siga com atenção", stop: "Pare e revise",
    verdict: "Veredito", why: "Por quê", record: "Cadastro oficial", opened: "aberta em", activity: "Atividade", capital: "Capital social", partners: "Sócios e administradores",
    andMore: (n) => "e mais " + n, listed: (c) => "Companhia aberta registrada na CVM (código " + c + ")", notListed: "Não é companhia aberta",
    debarOk: "Fora dos cadastros federais de empresas punidas (CEIS e CNEP)", debarHit: (n) => n + (n === 1 ? " registro vigente" : " registros vigentes") + " no CEIS/CNEP (empresa punida ou impedida de contratar)", debarOld: (n) => n + (n === 1 ? " registro antigo" : " registros antigos") + " no CEIS/CNEP, nenhum vigente",
    sancOk: (n, l) => "Nenhuma ocorrência de sanção para a empresa e " + n + " sócios (" + l + ")", sancHit: (n) => n + (n === 1 ? " possível ocorrência" : " possíveis ocorrências") + " em listas de sanções: nomes parecidos são comuns, revise antes de decidir", sancWeak: (n) => n + (n === 1 ? " semelhança fraca de nome" : " semelhanças fracas de nome") + " em listas de sanções, provavelmente outra entidade; confira antes de assinar", sancPartial: "A triagem de sanções ficou incompleta; rode de novo antes de confiar",
    cndt: { negativa: "Certidão trabalhista: negativa (nada consta)", positiva_com_efeitos_de_negativa: "Certidão trabalhista: positiva com efeitos de negativa (débitos em discussão ou garantidos)", positiva: "Certidão trabalhista: positiva (débitos trabalhistas em aberto)" },
    cndtValid: (d) => "válida até " + d, cndtCases: (n) => n + (n === 1 ? " processo listado" : " processos listados"), cndtNone: "Não foi possível emitir a certidão trabalhista agora; rode de novo para anexá-la",
    inactive: (s) => "Situação cadastral: " + s, summaryLabel: "Resumo", pdfLabel: "Certidão Negativa de Débitos Trabalhistas (CNDT, TST)", sources: "Fontes: Receita Federal, CVM, CGU (CEIS/CNEP), listas OFAC, ONU, Reino Unido e União Europeia, TST. Uma triagem rápida com dados públicos, não uma due diligence jurídica.",
  },
};
const money = (v, pt) => v == null ? null : (pt ? "R$ " : "BRL ") + Math.round(v).toLocaleString(pt ? "pt-BR" : "en-US");
const day = (s, pt) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T12:00:00Z"); return isNaN(d) ? String(s) : d.toLocaleDateString(pt ? "pt-BR" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }); };

export async function run(sp, { cnpj, lang }) {
  const pt = /^pt/i.test(lang || ""); const L = pt ? T.pt : T.en;
  const d = await sp.run("dossier", "dossier.br-company", { cnpj });
  let c = null; try { c = await sp.run("cndt", "operator.cndt", { cnpj }); } catch {}
  const co = d.company || {}; const partners = d.partners || []; const deb = d.debarment || {}; const san = d.sanctions || {};

  const stop = [], warn = [], ok = [];
  if (co.status && !/^ATIVA$/i.test(co.status)) stop.push(L.inactive(co.status));
  if ((deb.active || 0) > 0) stop.push(L.debarHit(deb.active)); else if ((deb.total || 0) > 0) warn.push(L.debarOld(deb.total)); else if (deb.checked) ok.push(L.debarOk);
  const lists = (san.lists || []).map((x) => x.list.replace(" consolidated list", "").replace(" Security Council", "")).join(", ");
  // Fuzzy matches on short aliases ("NATURA" ~ "NATA") are common: only a close match on a long name stops the deal;
  // the rest are listed for a human to glance at.
  const hits = san.hits || []; const strong = hits.filter((h) => (h.score ?? 0) >= 0.97 && String(h.matched_name || "").length >= 8);
  const hitLine = (h) => h.screened_name + " ≈ " + (h.matched_name || h.name) + " (" + h.list + (h.country ? ", " + h.country : "") + ")";
  if (strong.length) stop.push(L.sancHit(strong.length) + ": " + strong.slice(0, 3).map(hitLine).join("; "));
  else if (hits.length) warn.push(L.sancWeak(hits.length) + ": " + hits.slice(0, 3).map(hitLine).join("; "));
  else if (san.complete === false) warn.push(L.sancPartial); else ok.push(L.sancOk((san.screened_names || []).length - 1 > 0 ? (san.screened_names.length - (co.trade_name ? 2 : 1)) : 0, lists));
  if (c) { const line = (L.cndt[c.status] || c.status) + (c.valida_ate ? ", " + L.cndtValid(day(c.valida_ate, pt)) : "") + (c.processos && c.processos.length ? " · " + L.cndtCases(c.processos.length) : "");
    if (c.status === "positiva") stop.push(line); else if (c.status === "positiva_com_efeitos_de_negativa") warn.push(line); else ok.push(line);
  } else warn.push(L.cndtNone);
  for (const f of d.flags || []) if (!/first \d+ of \d+ partners|sanctions match/i.test(f)) warn.push(f);
  const verdict = stop.length ? "⛔ " + L.stop : warn.length ? "⚠️ " + L.warn : "✅ " + L.go;

  const names = partners.slice(0, 6).map((p) => p.name + (p.role ? " (" + p.role + ")" : ""));
  const summary = [
    L.verdict + ": " + verdict, "",
    ...stop.map((x) => "⛔ " + x), ...warn.map((x) => "⚠️ " + x), ...ok.map((x) => "✅ " + x), "",
    L.record + ":",
    co.name + (co.trade_name ? " (" + co.trade_name + ")" : ""),
    "CNPJ " + co.cnpj + " · " + (co.status || "?") + (co.opened_on ? " · " + L.opened + " " + day(co.opened_on, pt) : ""),
    co.main_activity ? L.activity + ": " + co.main_activity.description : "",
    [co.city, co.uf].filter(Boolean).join("/"),
    co.share_capital_brl ? L.capital + ": " + money(co.share_capital_brl, pt) : "",
    d.public_company && d.public_company.listed ? L.listed(d.public_company.cvm_code) : L.notListed, "",
    L.partners + ": " + (names.length ? names.join("; ") + (partners.length > 6 ? "; " + L.andMore(partners.length - 6) : "") : "—"), "",
    L.sources,
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");

  const items = [{ label: L.summaryLabel, text: summary }];
  if (c && c.pdf && c.pdf.url) { try { items.push({ url: await sp.keep(c.pdf.url, "cndt-" + String(co.cnpj || cnpj).replace(/\D/g, "") + ".pdf"), caption: L.pdfLabel }); } catch {} }
  return { title: L.title + (co.trade_name || co.name), items };
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
