import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

export const SEED_MODELS = [
  {
    id: 'claude-3-5-sonnet',
    openrouter_model_id: 'anthropic/claude-3.5-sonnet',
    display_name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    enabled: 1,
    prompt_price_per_m: 3.0,
    completion_price_per_m: 15.0,
  },
  {
    id: 'gpt-4o',
    openrouter_model_id: 'openai/gpt-4o',
    display_name: 'GPT-4o',
    provider: 'OpenAI',
    enabled: 1,
    prompt_price_per_m: 2.5,
    completion_price_per_m: 10.0,
  },
  {
    id: 'gemini-1-5-pro',
    openrouter_model_id: 'google/gemini-pro-1.5',
    display_name: 'Gemini 1.5 Pro',
    provider: 'Google',
    enabled: 1,
    prompt_price_per_m: 1.25,
    completion_price_per_m: 5.0,
  },
  {
    id: 'deepseek-v3',
    openrouter_model_id: 'deepseek/deepseek-chat',
    display_name: 'DeepSeek V3',
    provider: 'DeepSeek',
    enabled: 1,
    prompt_price_per_m: 0.14,
    completion_price_per_m: 0.28,
  },
  {
    id: 'llama-3-3-70b',
    openrouter_model_id: 'meta-llama/llama-3.3-70b-instruct',
    display_name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    enabled: 1,
    prompt_price_per_m: 0.12,
    completion_price_per_m: 0.3,
  },
  {
    id: 'qwen-2-5-72b',
    openrouter_model_id: 'qwen/qwen-2.5-72b-instruct',
    display_name: 'Qwen 2.5 72B Instruct',
    provider: 'Qwen',
    enabled: 1,
    prompt_price_per_m: 0.35,
    completion_price_per_m: 0.4,
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

  logger.info('Database migrations and seeds successfully executed');
}
