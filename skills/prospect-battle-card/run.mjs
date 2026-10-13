// Superpowers recipe: prospect battle card. Before a sales call: what the prospect does (from its own site), what Google says
// about it, who it competes with, suggested job roles, talking points for your product and discovery questions.
export const recipe = {
  slug: "prospect-battle-card",
  order: 9,
  name: "Prospect battle card",
  description: "Give a prospect's website and what you sell: get a one-page battle card with what they do, what the news says, who they compete with, suggested job roles without personal names or contact details, five talking points for your product and three discovery questions, every claim tied to a source.",
  inputs: {
    domain: { title: "Prospect website", description: "The company's domain", example: "linear.app", required: true, maxLength: 100 },
    product: { title: "What you sell", description: "Your product, in a few words", example: "an AI QA testing tool for web apps", required: true, maxLength: 160 },
  },
  uses: { "firecrawl.scrape": 1, "jina.reader": 1, "serper.google-search": 2, "hunter.domain-search": 1, "openrouter.openai-gpt-5.4-mini": 1 },
  share: { review: false },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
export const json = (s) => JSON.parse(String(s).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
// LLM fields arrive as strings, lists or objects; flatten them to text.
const refOf = (v) => (Array.isArray(v) ? v : [v]).map((r) => String(r).replace(/^\[?(S\d+)\]?$/, "[$1]")).join(" ");
export const flat = (x) => typeof x === "string" ? x : Array.isArray(x) ? x.map(flat).join(" ") : x && typeof x === "object" ? Object.entries(x).map(([k, v]) => (/^(ref|refs|source|sources)$/.test(k) ? refOf(v) : flat(v))).filter(Boolean).join(" ") : x == null ? "" : String(x);
// The company is the title part that matches the domain ("Agentic Infrastructure - Vercel" -> Vercel), else the domain name.
export function companyName(title, host) {
  const stem = host.split(".")[0].replace(/-/g, "");
  const part = String(title).split(/\s[|–—-]\s|:\s/).map((p) => p.trim()).find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(stem));
  if (part && part.length <= 40) return part;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}
const bare = (d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

export async function run(sp, { domain, product }) {
  const host = bare(domain);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) throw new Error("Give the prospect's domain, like linear.app");
  let site;
  try { site = await sp.run("site", "firecrawl.scrape", { url: "https://" + host }); } catch { site = await sp.run("site-jina", "jina.reader", { url: "https://" + host }); }
  const title = String(site.title ?? "");
  const company = companyName(title, host);
  const sources = [{ ref: "S1", title: title || host, url: "https://" + host, text: String(site.markdown ?? "").slice(0, 6000) }];
  const add = (r) => { for (const x of (r.results ?? []).slice(0, 8)) sources.push({ ref: "S" + (sources.length + 1), title: String(x.title ?? ""), url: x.url, text: String(x.snippet ?? "") }); };
  add(await sp.run("news", "serper.google-search", { query: company + " " + host + " news" }));
  add(await sp.run("competitors", "serper.google-search", { query: company + " competitors alternatives" }));
  let people = [];
  try { people = ((await sp.run("people", "hunter.domain-search", { domain: host, limit: 10 })).emails ?? []).filter((e) => e.email); } catch {}
  const roles = [...new Set(people.map((p) => p.position).filter(Boolean))];
  const res = await sp.run("card", LLM, { max_tokens: 1800, prompt:
    "You prepare a sales rep for a first call with " + company + " (" + host + "). The rep sells " + product + ". Below are numbered sources: the company website (S1) and Google results.\n" +
    "Reply only JSON with string fields what_they_do (2-3 sentences) and who_to_ask (one sentence naming which of these roles to contact first and why: " + JSON.stringify(roles) + "), and list fields news (up to 4 strings), competitors (up to 5 strings, a name plus its ref), talking_points (5 strings connecting the rep's product to something in the sources), questions (3 strings).\n" +
    "Every sentence with a fact ends with its source refs like [S2]. Use only facts from the sources; ignore sources about a different company; never use quotation marks; never write people's names, emails, links or numbers that are not in a source. Google results carry no reliable dates, so do not call news recent.\n\nSOURCES:\n" + JSON.stringify(sources.map(({ url, ...s }) => s)) });
  let c; try { c = json(textOf(res)); } catch { c = { what_they_do: textOf(res) }; }
  const known = new Set(sources.map((s) => s.ref));
  const personal = people.flatMap((p) => [p.name, p.email]).filter(Boolean);
  const redact = (text) => personal.reduce((out, value) => out.replace(new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[personal detail omitted]"), text).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[contact omitted]");
  const R = (t) => redact(flat(t)).replace(/\[(S\d+)\]/g, (m, r) => (known.has(r) ? m : "")).replace(/\s+([.,])/g, "$1").trim();
  const list = (xs) => (Array.isArray(xs) ? xs : xs ? [xs] : []).map((x) => "- " + R(x)).join("\n");
  // Short items render huge on share pages, so competitors go in one sentence.
  const comps = (Array.isArray(c.competitors) ? c.competitors : c.competitors ? [c.competitors] : []).map(R).filter(Boolean).join(", ");
  const used = new Set((JSON.stringify(c).match(/S\d+/g) ?? []).filter((r) => known.has(r)));
  return {
    title: "Battle card: " + company + " (" + host + ")",
    items: [
      { label: "What they do", text: R(c.what_they_do) + (comps ? "\n\nCompetitors named in the sources: " + comps + "." : "") + "\n\nYou sell " + product + "." },
      { label: "In the news (from Google; check dates)", text: list(c.news) || "Nothing found." },
      { label: "Talking points", text: list(c.talking_points) },
      { label: "Discovery questions", text: list(c.questions) },
      { label: "Suggested role to ask", text: R(c.who_to_ask) || "No supported role suggestion. Ask who owns this area; no personal contacts are included." },
      { label: "Sources", text: sources.filter((s) => used.has(s.ref)).map((s) => "[" + s.ref + "] " + redact(s.title).slice(0, 90) + "\n" + s.url).join("\n\n") },
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
