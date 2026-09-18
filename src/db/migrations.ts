import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

// Pricing sourced from OpenRouter model pages on 2026-09-14.
// GLM 5.3: https://openrouter.ai/z-ai/glm-5.3
// DeepSeek V4.1 Flash: https://openrouter.ai/deepseek/deepseek-v4.1-flash
// Re-verify against OpenRouter if more than 30 days have passed since above date.
export const SEED_MODELS = [
  {
    id: 'glm-5-3',
    openrouter_model_id: 'z-ai/glm-5.3',
    display_name: 'GLM 5.3',
    provider: 'Z-AI',
    enabled: 1,
    prompt_price_per_m: 0.936,
    completion_price_per_m: 3.168,
  },
  {
    id: 'deepseek-v4-1-flash',
    openrouter_model_id: 'deepseek/deepseek-v4.1-flash',
    display_name: 'DeepSeek V4.1 Flash',
    provider: 'DeepSeek',
    enabled: 1,
    prompt_price_per_m: 0.15,
    completion_price_per_m: 0.60,
  },
];

export const STANDARD_CATEGORIES = [
  'General Writing',
  'Emails',
  'Business Writing',
  'Creative Writing',
  'Marketing',
  'Summarization',
  'Rewriting',
  'Technical Writing',
  'Persuasive Writing',
  'Research Writing',
  'Social Media',
  'Instruction Following',
];

export function runMigrations(db: Database.Database): void {
  // 1. Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        openrouter_model_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        provider TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        prompt_price_per_m REAL DEFAULT 0.0,
        completion_price_per_m REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS benchmark_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        prompt TEXT NOT NULL,
        evaluation_criteria TEXT,
        difficulty TEXT DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'created',
        revealed INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS benchmark_outputs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE,
        model_id TEXT NOT NULL REFERENCES models(id),
        anonymous_id TEXT NOT NULL,
        output_text TEXT NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        estimated_cost REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS battles (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE,
        output_a_id TEXT NOT NULL REFERENCES benchmark_outputs(id),
        output_b_id TEXT NOT NULL REFERENCES benchmark_outputs(id),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS votes (
        id TEXT PRIMARY KEY,
        battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id),
        selected_output_id TEXT REFERENCES benchmark_outputs(id),
        is_tie INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        dimension_scores TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rankings (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        user_id TEXT,
        category TEXT,
        model_id TEXT NOT NULL REFERENCES models(id),
        bradley_terry_score REAL NOT NULL DEFAULT 100.0,
        elo_rating REAL NOT NULL DEFAULT 1200.0,
        battles_count INTEGER NOT NULL DEFAULT 0,
        wins_count INTEGER NOT NULL DEFAULT 0,
        losses_count INTEGER NOT NULL DEFAULT 0,
        ties_count INTEGER NOT NULL DEFAULT 0,
        win_rate REAL NOT NULL DEFAULT 0.0,
        uncertainty REAL NOT NULL DEFAULT 1.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user ON benchmark_tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_outputs_task ON benchmark_outputs(task_id);
    CREATE INDEX IF NOT EXISTS idx_battles_task ON battles(task_id);
    CREATE INDEX IF NOT EXISTS idx_votes_battle ON votes(battle_id);
    CREATE INDEX IF NOT EXISTS idx_rankings_lookup ON rankings(scope, category, model_id);
  `);

  // 2. Seed default user if absent
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, name) VALUES ('default_user', 'Claude Desktop User')
  `);
  insertUser.run();

  // 3. Seed models if absent
  const insertModel = db.prepare(`
    INSERT OR IGNORE INTO models (
      id, openrouter_model_id, display_name, provider, enabled, prompt_price_per_m, completion_price_per_m
    ) VALUES (
      @id, @openrouter_model_id, @display_name, @provider, @enabled, @prompt_price_per_m, @completion_price_per_m
    )
  `);

  const tx = db.transaction((models) => {
    for (const m of models) {
      insertModel.run(m);
    }
  });
  tx(SEED_MODELS);

  // 4. Ensure only GLM 5.3 and DeepSeek Flash exist and are enabled.
  // Try to delete legacy models; fall back to disabling them if FK constraints prevent deletion.
  try {
    db.prepare(`
      DELETE FROM models WHERE id NOT IN ('glm-5-3', 'deepseek-v4-1-flash')
    `).run();
  } catch {
    db.prepare(`
      UPDATE models SET enabled = 0 WHERE id NOT IN ('glm-5-3', 'deepseek-v4-1-flash')
    `).run();
  }
  db.prepare(`
    UPDATE models SET enabled = 1 WHERE id IN ('glm-5-3', 'deepseek-v4-1-flash')
  `).run();

  // 5. Fix pricing on already-seeded rows (INSERT OR IGNORE won't update existing rows).
  // Keep this block in sync with SEED_MODELS above whenever pricing changes.
  db.prepare(`
    UPDATE models
    SET prompt_price_per_m = 0.936, completion_price_per_m = 3.168
    WHERE id = 'glm-5-3'
      AND (prompt_price_per_m != 0.936 OR completion_price_per_m != 3.168)
  `).run();
  db.prepare(`
    UPDATE models
    SET prompt_price_per_m = 0.15, completion_price_per_m = 0.60
    WHERE id = 'deepseek-v4-1-flash'
      AND (prompt_price_per_m != 0.15 OR completion_price_per_m != 0.60)
  `).run();

  logger.info('Database migrations and seeds successfully executed');
}
