import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env");
const envContent = readFileSync(envPath, "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  if (key) envVars[key.trim()] = rest.join("=").trim();
}
const OPENROUTER_API_KEY = envVars.OPENROUTER_API_KEY;
const DB_PATH = envVars.DB_PATH || resolve(projectRoot, "data", "blindwrite.sqlite");

async function callOR(modelId, prompt, apiKey, maxTokens = 150) {
  const start = Date.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json", "HTTP-Referer": "https://github.com/ygstudio-game/BlindWrite_MCP", "X-Title": "BlindWrite Verify" },
    body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.7 })
  });
  const latencyMs = Date.now() - start;
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, latencyMs, data, ok: r.ok };
}

const TEST = "Write one sentence about why clear writing matters.";
console.log("=== BlindWrite MCP — Connection Verification ===");
console.log("Key (masked): sk-or-..." + OPENROUTER_API_KEY.slice(-8));
console.log("");

console.log("TEST 1: DeepSeek V4.1 Flash");
try {
  const { status, latencyMs, data, ok } = await callOR("deepseek/deepseek-v4.1-flash", TEST, OPENROUTER_API_KEY);
  if (ok) {
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "(empty)";
    const u = data?.usage ?? {}; const cost = ((u.prompt_tokens||0)*0.15 + (u.completion_tokens||0)*0.60) / 1000000;
    console.log("  PASS HTTP " + status + " " + latencyMs + "ms | " + (u.prompt_tokens||0) + "in/" + (u.completion_tokens||0) + "out | $" + cost.toFixed(8));
    console.log("  Output: " + JSON.stringify(text));
  } else { console.log("  FAIL HTTP " + status + " | " + JSON.stringify(data).substring(0,300)); }
} catch(e) { console.log("  EXCEPTION: " + e.message); }

console.log("\nTEST 2: GLM 5.3");
try {
  const { status, latencyMs, data, ok } = await callOR("z-ai/glm-5.3", TEST, OPENROUTER_API_KEY);
  if (ok) {
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "(empty)";
    const u = data?.usage ?? {}; const cost = ((u.prompt_tokens||0)*0.936 + (u.completion_tokens||0)*3.168) / 1000000;
    console.log("  PASS HTTP " + status + " " + latencyMs + "ms | " + (u.prompt_tokens||0) + "in/" + (u.completion_tokens||0) + "out | $" + cost.toFixed(8));
    console.log("  Output: " + JSON.stringify(text));
  } else { console.log("  FAIL HTTP " + status + " | " + JSON.stringify(data).substring(0,300)); }
} catch(e) { console.log("  EXCEPTION: " + e.message); }

console.log("\nTEST 3: Bad key failure test");
try {
  const { status, latencyMs, data, ok } = await callOR("deepseek/deepseek-v4.1-flash", TEST, "sk-or-BADKEY");
  if (!ok) { console.log("  CORRECTLY FAILED HTTP " + status + " | " + JSON.stringify(data).substring(0,300)); }
  else { console.log("  UNEXPECTED PASS HTTP " + status + " — investigate"); }
} catch(e) { console.log("  Exception: " + e.message); }

console.log("\nTEST 4: DB state");
try {
  const req = createRequire(import.meta.url);
  const Database = req("better-sqlite3");
  const db = new Database(DB_PATH, { readonly: true });
  const models = db.prepare("SELECT id, openrouter_model_id, enabled, prompt_price_per_m, completion_price_per_m FROM models WHERE enabled = 1").all();
  for (const m of models) console.log("  " + m.id + " | " + m.openrouter_model_id + " | $" + m.prompt_price_per_m + "/$" + m.completion_price_per_m);
  const rc = db.prepare("SELECT COUNT(*) as count FROM rankings").get();
  console.log("  Leaderboard rows: " + rc.count + " (0 = empty, expected)");
  db.close();
} catch(e) { console.log("  DB FAIL: " + e.message); }

console.log("\n=== Done ===");
console.log("Key source: .env file (OPENROUTER_API_KEY)");
console.log("Export path: data/drafts/{category}-{timestamp}.md");
console.log("Pricing: static in DB (update migrations.ts + run fix_pricing.js when prices change)");
console.log("Prompt ceiling: 128k context window (DeepSeek Flash + GLM 5.3). No internal truncation.");
console.log("Retry policy: 2 retries on transient errors. Hard failures (401/400) fail immediately.");
console.log("Silent fallback: NONE. Throws BlindWriteError explicitly on all failures.");
