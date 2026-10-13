// Superpowers recipe: competitor email offer watch. First run creates one private receive-only address per competitor;
// the user (or their agent) signs up to each competitor's newsletter with it. Later runs read what arrived and write a brief.
// Same file runs on the server ("Try it") and locally.
export const recipe = {
  slug: "competitor-email-offer-watch",
  order: 5,
  name: "Competitor email offer watch",
  description: "Gives you a private email address per competitor to sign up to their newsletters, then reads what they send and writes a brief: each welcome offer, hook, call to action and link, plus patterns worth copying.",
  inputs: {
    competitors: { title: "Competitors", description: "Up to five brand names, separated by commas (first run)", example: "Olipop, Poppi, Zevia", maxLength: 200 },
    watch: { title: "Watch list", description: "The watch value returned by the first run, to read what arrived", maxLength: 1200 },
  },
  uses: { "agentmail.create-address": 3, "agentmail.list-messages": 3, "agentmail.get-message": 6, "openrouter.openai-gpt-5.4-mini": 1 },
  share: { review: false },
};

const LLM = "openrouter.openai-gpt-5.4-mini";
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "brand";

export function parseWatch(w) {
  return String(w).split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const [name, address, token] = x.split("|").map((y) => (y ?? "").trim());
    if (!name || !/@agentmail\.to$/.test(address ?? "") || !/^[A-Za-z0-9_-]{32}$/.test(token ?? "")) throw new Error("watch must be the value returned by the first run");
    return { name, address, token };
  });
}

export async function run(sp, { competitors, watch }) {
  if (!watch) {
    const names = String(competitors ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (!names.length) throw new Error("Give competitors for the first run, or the watch value from it");
    const made = await Promise.all(names.map((n, i) => sp.run("address-" + (i + 1), "agentmail.create-address", { label: slug(n) })));
    const list = names.map((n, i) => ({ name: n, address: made[i].address, token: made[i].access_token }));
    return {
      title: "Watch addresses for " + names.join(", "),
      items: [
        ...list.map((w) => ({ label: w.name, text: "Sign up to " + w.name + "'s newsletter (footer or pop-up form on their site) with " + w.address })),
        { label: "Next step", text: "Welcome emails usually arrive within minutes; campaigns over the following days. Confirm any 'confirm your subscription' email by opening its link. Then run this recipe again with the watch value below." },
        { label: "watch", text: list.map((w) => w.name + "|" + w.address + "|" + w.token).join("; ") },
      ],
    };
  }
  const list = parseWatch(watch).slice(0, 5); const mails = [];
  for (const [i, w] of list.entries()) {
    const l = await sp.run("list-" + (i + 1), "agentmail.list-messages", { address: w.address, access_token: w.token, limit: 5 });
    for (const [j, m] of (l.messages ?? []).entries()) {
      const g = await sp.run("read-" + (i + 1) + "-" + (j + 1), "agentmail.get-message", { address: w.address, access_token: w.token, message_id: m.message_id });
      mails.push({ competitor: w.name, received_at: m.received_at, from: g.from, subject: g.subject, text: String(g.text ?? "").slice(0, 3000), links: (g.links ?? []).slice(0, 12) });
    }
  }
  const counts = list.map((w) => w.name + ": " + mails.filter((m) => m.competitor === w.name).length + " email(s)").join(", ");
  if (!mails.length) return { title: "Nothing has arrived yet", items: [{ label: "Status", text: counts + ". Check that each sign-up went through, then run again later." }] };
  const prompt = "You are a DTC growth analyst. From ONLY the emails below (JSON), write a markdown brief titled \"Competitor email offer watch\". One section per competitor that sent mail: sender, received date (exact), subject (exact quote), the offer and its terms quoted from the email text or links (a discount code in a link counts; write \"no offer in the email text\" if none), hook, call to action, and 1-3 links copied exactly from its links list. Then \"Patterns worth copying\" (3 bullets) and \"Gap to exploit\" (1 bullet). Never invent offers, numbers or links.\n\nEMAILS:\n" + JSON.stringify(mails);
  const brief = await sp.run("brief", LLM, { prompt, max_tokens: 1500 });
  return { title: "Competitor email offer watch", items: [{ label: "Brief", text: String(brief.text ?? "").trim() }, { label: "Emails read", text: counts }] };
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
