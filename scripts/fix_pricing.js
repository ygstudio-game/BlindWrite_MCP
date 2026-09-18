import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const Database = req('better-sqlite3');

const db = new Database('d:/COding/InternShip Work/E-STUDYPAL/LAUNCHPIT/BlindWrite_MCP/data/blindwrite.sqlite');

db.prepare("UPDATE models SET prompt_price_per_m = 0.936, completion_price_per_m = 3.168 WHERE id = 'glm-5-3'").run();
db.prepare("UPDATE models SET prompt_price_per_m = 0.15, completion_price_per_m = 0.60 WHERE id = 'deepseek-v4-1-flash'").run();

const models = db.prepare('SELECT id, enabled, prompt_price_per_m, completion_price_per_m FROM models WHERE enabled = 1').all();
console.log('Live DB pricing after fix:');
console.log(JSON.stringify(models, null, 2));
db.close();

