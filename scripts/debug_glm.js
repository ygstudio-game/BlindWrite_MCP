import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envContent = readFileSync(resolve(projectRoot, ".env"), "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.trim().split("=");
  if (key && !key.startsWith("#")) envVars[key.trim()] = rest.join("=").trim();
}
const API_KEY = envVars.OPENROUTER_API_KEY;

console.log("Testing GLM 5.3 with full response inspection...");
const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": "Bearer " + API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://github.com/ygstudio-game/BlindWrite_MCP", "X-Title": "BlindWrite Debug" },
  body: JSON.stringify({ model: "z-ai/glm-5.3", messages: [{ role: "user", content: "Write one sentence about clear writing." }], max_tokens: 200, temperature: 0.7 })
});
console.log("HTTP Status:", r.status);
const data = await r.json();
console.log("Full response:", JSON.stringify(data, null, 2));
