-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Models Catalog
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

-- Benchmark Tasks
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

-- Benchmark Model Outputs
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

-- Pairwise Battles
CREATE TABLE IF NOT EXISTS battles (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE,
    output_a_id TEXT NOT NULL REFERENCES benchmark_outputs(id),
    output_b_id TEXT NOT NULL REFERENCES benchmark_outputs(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Votes
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

-- Cached Rankings
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
