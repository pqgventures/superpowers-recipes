// Superpowers recipe: what buyers in your category complain about, ask and want, in their own words, from Reddit.
// Searches Reddit with buyer phrases, reads the busiest threads, groups comments into themes. The model only picks
// comment ids per theme; quotes are copied by code from the comments and every count is computed here.
export const recipe = {
  slug: "buyer-voice-research",
  order: 10,
  name: "What buyers complain about, from Reddit",
  description: "Name your category (and competitors if you like); get the problems, questions and wishes buyers post on Reddit, grouped into themes with word-for-word quotes and links, to write ads, pages and sales scripts in their words.",
  inputs: {
    category: { title: "Category", description: "What you sell, as buyers say it", example: "product analytics", required: true, maxLength: 80 },
    competitors: { title: "Competitors (optional)", description: "Up to 3 competitor names, separated by commas", example: "Mixpanel, Amplitude" },
    timeframe: { title: "Period", description: "month or year", default: "year" },
  },
  uses: { "scrapecreators.reddit-search": 5, "openrouter.openai-gpt-5.4-mini": 1, "scrapecreators.reddit-comments": 6, "openrouter.anthropic-claude-sonnet-5": 1 },
  share: { review: false },
};

const LLM = "openrouter.anthropic-claude-sonnet-5";
const CHEAP = "openrouter.openai-gpt-5.4-mini";
const textOf = (r) => String(r?.text ?? r?.content ?? r?.choices?.[0]?.message?.content ?? "").trim();
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export function phrases(category, competitors) {
  const c = clean(category).toLowerCase();
  const comps = String(competitors || "").split(",").map(clean).filter(Boolean).slice(0, 3);
  return [c + " too expensive", "best " + c + " for small team", c + " frustrating", ...comps.map((x) => x + " alternative")].slice(0, 5);
}
export function quote(text, max = 260) {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max); const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s\S*$/, "")) + "…";
}

export async function run(sp, { category, competitors, timeframe }) {
  const cat = clean(category); if (cat.length < 3) throw new Error("Name the category, e.g. product analytics");
  const tf = ["month", "year"].includes(String(timeframe || "year")) ? String(timeframe || "year") : "year";
  const qs = phrases(cat, competitors);
  const seen = new Map();
  for (const [i, q] of qs.entries()) {
    const r = await sp.run("search-" + i, "scrapecreators.reddit-search", { query: q, sort: "relevance", timeframe: tf });
    for (const p of r.items || []) if (p.url && !seen.has(p.id)) seen.set(p.id, { ...p, query: q });
  }
  const pool = [...seen.values()].filter((p) => (p.comments ?? 0) >= 3).sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0)).slice(0, 15);
  // Relevance first, as data: only threads by people choosing, buying or using tools in the category are read and counted.
  const pick = pool.length ? JSON.parse(textOf(await sp.run("relevance", CHEAP, { prompt: "Which of these Reddit threads are written by people who choose, buy, pay for or use " + cat + " tools or services (prices, alternatives, setup, missing features, support, switching)? Not careers, jobs, courses, learning or general opinion.\n" +
    'Return JSON only: {"relevant":[0,3]}\n\n' + pool.map((p, i) => i + ": " + p.title + " — " + clean(p.text).slice(0, 300)).join("\n"), max_tokens: 200 })).match(/\{[\s\S]*\}/)?.[0] ?? "{}").relevant ?? [] : [];
  const threads = pool.filter((_, i) => pick.includes(i)).slice(0, 6);
  if (!threads.length) throw new Error("No Reddit threads in this period are about choosing or using " + cat + " tools; try a broader category or a year");
  const comments = [];
  for (const [i, t] of threads.entries()) {
    const r = await sp.run("thread-" + i, "scrapecreators.reddit-comments", { url: t.url, limit: 25 });
    for (const c of r.comments || []) if (clean(c.text).length >= 40) comments.push({ ref: "C" + (comments.length + 1), text: clean(c.text), url: c.url, score: c.score ?? 0, thread: t.title, sub: t.subreddit });
  }
  if (comments.length < 5) throw new Error("Too few comments to find themes");
  const prompt = "You are a customer researcher. Below are Reddit comments about " + cat + ", each with a ref like C12.\n" +
    "Group them into 3 to 6 themes, listing each theme's refs with the comment that shows it most clearly first about what buyers dislike, ask for or want (prices, missing features, setup pain, switching, support...). A comment can be in one theme only; skip comments that are off-topic, jokes, or about careers, jobs or learning.\n" +
    "Also list up to 5 questions buyers ask about choosing, pricing or using these tools (not questions to other commenters), each as the ref of the comment that asks it.\n" +
    'Return JSON only: {"themes":[{"name":"short name in plain words","summary":"one sentence, no numbers","refs":["C1","C7"]}],"questions":["C3"]}\n\nCOMMENTS:\n' +
    comments.map((c) => c.ref + " (r/" + c.sub + "): " + c.text.slice(0, 600)).join("\n");
  const plan = JSON.parse(textOf(await sp.run("themes", LLM, { prompt, max_tokens: 1800 })).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  const byRef = new Map(comments.map((c) => [c.ref, c]));
  const used = new Set();
  const themes = (plan.themes || []).map((t) => ({ name: clean(t.name).slice(0, 60), summary: clean(t.summary).slice(0, 200), items: (t.refs || []).map((r) => byRef.get(String(r).trim())).filter((c) => c && !used.has(c.ref) && used.add(c.ref)) }))
    .filter((t) => t.name && t.items.length >= 2).sort((a, b) => b.items.length - a.items.length);
  if (!themes.length) throw new Error("Could not group the comments into themes");
  const asks = (plan.questions || []).map((r) => byRef.get(String(r).trim())).filter(Boolean).slice(0, 5);
  const top = (t) => t.items.slice(0, 3); // in the order the model ranked them: clearest example first
  return {
    title: "What " + cat + " buyers say on Reddit",
    items: [
      { label: "What we read", text: comments.length + " comments in " + threads.length + " Reddit threads from the last " + tf + ", found with: " + qs.join("; ") + ". The biggest theme: " + themes[0].name.toLowerCase() + " (" + themes[0].items.length + " of " + comments.length + " comments)." },
      ...themes.map((t) => ({ label: t.name + " — " + t.items.length + " comments", text: t.summary + "\n" + top(t).map((c) => "“" + quote(c.text) + "” (r/" + c.sub + ")").join("\n") })),
      ...(asks.length ? [{ label: "Questions buyers ask", text: asks.map((c) => "“" + quote(c.text, 200) + "”").join("\n") }] : []),
      { label: "Threads", text: threads.map((t) => t.title + " — r/" + t.subreddit + ", " + t.comments + " comments, " + t.date).join("\n") },
      ...threads.map((t) => ({ label: t.title || "Link", url: t.url, caption: "r/" + t.subreddit + " · " + t.comments + " comments · " + t.date })),
      { label: "About this", text: "Quotes are copied word for word from public Reddit comments, without usernames. Themes were grouped by AI; counts are comments per theme in this sample, not market shares." },
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
