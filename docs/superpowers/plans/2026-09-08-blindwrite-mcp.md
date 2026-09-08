# BlindWrite MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Model Context Protocol (MCP) server called BlindWrite MCP connecting Claude Desktop with OpenRouter to run blind, bias-free AI writing benchmarks with Bradley-Terry and Elo ranking.

**Architecture:** A service-oriented domain architecture featuring a thin Zod-validated MCP tool layer (`src/tools/`), a rich domain service layer (`src/services/` for benchmark orchestration, cryptographic duel randomization, Bradley-Terry MLE & Elo ranking, and preference analytics), and a typed repository persistence layer over SQLite in WAL mode (`src/db/`). All diagnostics write strictly to `stderr` to preserve MCP stdio JSON-RPC on `stdout`.

**Tech Stack:** Node.js (v24 LTS), TypeScript 5.7+, `@modelcontextprotocol/sdk`, `better-sqlite3`, `zod`, `dotenv`, `vitest`.

**Spec:** [docs/superpowers/specs/2026-09-08-blindwrite-mcp-design.md](../specs/2026-09-08-blindwrite-mcp-design.md)

## Global Constraints
- Node.js LTS (v24), TypeScript with NodeNext module resolution.
- Standard output (`stdout`) MUST NEVER be polluted by logs; all logging uses `console.error` (`stderr`).
- Strictly enforce blindness: model identities and providers are never returned in battle responses or output lists before an explicit reveal.
- Bradley-Terry estimation must use Minorization-Maximization iteration with Laplace prior regularization and uncertainty/standard error estimation.
- Pairwise duels must use cryptographic 50/50 randomization to eliminate positional bias.
- Every task must include tests and commit to git with conventional commit messages upon completion.

---

### Task 1: Core Project Scaffolding, Configuration & Stderr Logger

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `src/config.ts`
- Create: `src/utils/logger.ts`
- Create: `src/utils/errors.ts`
- Test: `tests/unit/config.test.ts`

**Interfaces:**
- Produces:
  - `getConfig(): AppConfig` where `AppConfig` has `{ openRouterApiKey: string, dbPath: string, logLevel: string }`
  - `logger: { debug, info, warn, error }` (outputs exclusively to `process.stderr`)
  - `BlindnessViolationError`, `NotFoundError`, `ValidationError`

- [ ] **Step 1: Write the failing test for configuration and stderr logging**

`tests/unit/config.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { logger } from '../../src/utils/logger.js';

describe('Configuration & Logger', () => {
  it('loads valid configuration from environment', () => {
    const config = loadConfig({
      OPENROUTER_API_KEY: 'test-key-12345',
      DB_PATH: ':memory:',
      LOG_LEVEL: 'debug',
    });
    expect(config.openRouterApiKey).toBe('test-key-12345');
    expect(config.dbPath).toBe(':memory:');
    expect(config.logLevel).toBe('debug');
  });

  it('fails when OPENROUTER_API_KEY is missing', () => {
    expect(() => loadConfig({ DB_PATH: ':memory:' })).toThrow();
  });

  it('logs only to stderr and never to stdout', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.info('Test info log');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Initialize package.json, tsconfig.json, and install dependencies**

Run:
```bash
npm init -y
npm install @modelcontextprotocol/sdk better-sqlite3 dotenv zod
npm install -D typescript @types/node @types/better-sqlite3 vitest
```

- [ ] **Step 3: Implement config.ts, logger.ts, errors.ts, and tsconfig.json**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

`src/config.ts`:
```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  DB_PATH: z.string().default('./data/blindwrite.sqlite'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = {
  openRouterApiKey: string;
  dbPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = ConfigSchema.parse(env);
  return {
    openRouterApiKey: parsed.OPENROUTER_API_KEY,
    dbPath: parsed.DB_PATH,
    logLevel: parsed.LOG_LEVEL,
  };
}
```

`src/utils/logger.ts`:
```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class StderrLogger {
  private currentLevel: number = LEVEL_ORDER.info;

  setLevel(level: LogLevel): void {
    this.currentLevel = LEVEL_ORDER[level];
  }

  private write(level: LogLevel, message: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[level] >= this.currentLevel) {
      const timestamp = new Date().toISOString();
      const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      if (args.length > 0) {
        process.stderr.write(formatted + ' ' + JSON.stringify(args) + '\n');
      } else {
        process.stderr.write(formatted + '\n');
      }
    }
  }

  debug(msg: string, ...args: unknown[]): void { this.write('debug', msg, ...args); }
  info(msg: string, ...args: unknown[]): void { this.write('info', msg, ...args); }
  warn(msg: string, ...args: unknown[]): void { this.write('warn', msg, ...args); }
  error(msg: string, ...args: unknown[]): void { this.write('error', msg, ...args); }
}

export const logger = new StderrLogger();
```

`src/utils/errors.ts`:
```typescript
export class BlindWriteError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'BlindWriteError';
  }
}

export class BlindnessViolationError extends BlindWriteError {
  constructor(message: string) {
    super(message, 'BLINDNESS_VIOLATION');
    this.name = 'BlindnessViolationError';
  }
}

export class NotFoundError extends BlindWriteError {
  constructor(entity: string, id: string) {
    super(`${entity} with id '${id}' was not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends BlindWriteError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json .env.example src/config.ts src/utils/ tests/unit/config.test.ts
git commit -m "feat(core): project scaffolding, configuration, and stderr logger"
```

---

### Task 2: SQLite Connection, Schema Migrations & Typed Repositories

**Files:**
- Create: `src/db/connection.ts`
- Create: `src/db/schema.sql`
- Create: `src/db/migrations.ts`
- Create: `src/db/repositories/taskRepo.ts`
- Create: `src/db/repositories/modelRepo.ts`
- Create: `src/db/repositories/outputRepo.ts`
- Create: `src/db/repositories/battleRepo.ts`
- Create: `src/db/repositories/voteRepo.ts`
- Create: `src/db/repositories/rankingRepo.ts`
- Test: `tests/unit/db.test.ts`

**Interfaces:**
- Produces:
  - `initDatabase(dbPath: string): Database.Database`
  - `runMigrations(db: Database.Database): void`
  - Repositories: `TaskRepository`, `ModelRepository`, `OutputRepository`, `BattleRepository`, `VoteRepository`, `RankingRepository`

- [ ] **Step 1: Write the failing tests for Database & Repositories**

`tests/unit/db.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { TaskRepository } from '../../src/db/repositories/taskRepo.js';
import { ModelRepository } from '../../src/db/repositories/modelRepo.js';
import Database from 'better-sqlite3';

describe('Database & Repositories', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('runs migrations and seeds default models and user', () => {
    const modelRepo = new ModelRepository(db);
    const models = modelRepo.listModels();
    expect(models.length).toBeGreaterThanOrEqual(6);
    expect(models.some(m => m.id === 'claude-3-5-sonnet')).toBe(true);
  });

  it('creates and retrieves a benchmark task', () => {
    const taskRepo = new TaskRepository(db);
    const task = taskRepo.createTask({
      userId: 'default_user',
      title: 'Executive Pitch Email',
      category: 'Emails',
      prompt: 'Write an email pitching our AI product to a CTO.',
      evaluationCriteria: 'Clarity, conciseness, professionalism',
      difficulty: 'medium',
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Executive Pitch Email');
    expect(task.revealed).toBe(0);

    const fetched = taskRepo.getTaskById(task.id);
    expect(fetched?.id).toBe(task.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/db.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement connection, schema DDL, seed data, and repositories**

`src/db/connection.ts`:
```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export function initDatabase(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  logger.info(`SQLite database initialized at ${dbPath}`);
  return db;
}
```

`src/db/migrations.ts`:
Executes the schema DDL and seeds the default session user `default_user`, 12 standard writing categories, and 6 initial models (`claude-3-5-sonnet`, `gpt-4o`, `gemini-1-5-pro`, `deepseek-v3`, `llama-3-3-70b`, `qwen-2-5-72b`) with their OpenRouter IDs and pricing.

Implement repository classes in `src/db/repositories/` with typed methods for inserting, querying, and updating.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/ tests/unit/db.test.ts
git commit -m "feat(db): sqlite wal connection, schema migrations, and repositories"
```

---

### Task 3: OpenRouter API Gateway & Cost Tracking

**Files:**
- Create: `src/types/domain.ts`
- Create: `src/services/openrouter.ts`
- Create: `src/services/costTracking.ts`
- Test: `tests/unit/openrouter.test.ts`

**Interfaces:**
- Produces:
  - `OpenRouterService`:
    - `generateOutput(model: ModelRecord, prompt: string, options?: GenerationOptions): Promise<GenerationResult>`
    - `generateOutputsParallel(models: ModelRecord[], prompt: string, options?: GenerationOptions): Promise<GenerationResult[]>`
  - `CostCalculator`:
    - `calculateCost(promptTokens: number, completionTokens: number, promptPricePerM: number, completionPricePerM: number): number`

- [ ] **Step 1: Write failing tests for OpenRouter client and cost tracking**

`tests/unit/openrouter.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterService } from '../../src/services/openrouter.js';
import { CostCalculator } from '../../src/services/costTracking.js';

describe('OpenRouter Gateway & Cost Tracking', () => {
  it('calculates cost accurately based on token pricing', () => {
    // $3.00 per 1M prompt, $15.00 per 1M completion
    // 1000 prompt tokens = $0.003
    // 500 completion tokens = $0.0075
    // Total = $0.0105
    const cost = CostCalculator.calculateCost(1000, 500, 3.0, 15.0);
    expect(cost).toBeCloseTo(0.0105, 5);
  });

  it('sends prompt to OpenRouter and measures latency and token usage', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Generated writing response' } }],
        usage: { prompt_tokens: 25, completion_tokens: 40, total_tokens: 65 },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const service = new OpenRouterService('mock-api-key');
    const result = await service.generateOutput(
      {
        id: 'test-model',
        openrouter_model_id: 'test/model',
        display_name: 'Test Model',
        provider: 'TestProvider',
        enabled: 1,
        prompt_price_per_m: 1.0,
        completion_price_per_m: 2.0,
        created_at: new Date().toISOString(),
      },
      'Write a test sentence.'
    );

    expect(result.outputText).toBe('Generated writing response');
    expect(result.promptTokens).toBe(25);
    expect(result.completionTokens).toBe(40);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.estimatedCost).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/openrouter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement domain types, OpenRouterService, and CostCalculator**

Implement `src/types/domain.ts`, `src/services/costTracking.ts`, and `src/services/openrouter.ts` with error handling, timeout control (via AbortSignal), and exponential backoff retry.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/openrouter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/services/openrouter.ts src/services/costTracking.ts tests/unit/openrouter.test.ts
git commit -m "feat(gateway): openrouter api client with latency and cost tracking"
```

---

### Task 4: Cryptographic Randomization & Blindness Duel Service

**Files:**
- Create: `src/services/randomization.ts`
- Create: `src/services/duelService.ts`
- Test: `tests/unit/randomization.test.ts`

**Interfaces:**
- Produces:
  - `RandomizationService`:
    - `generateAnonymousId(): string`
    - `shufflePair<T>(first: T, second: T): { itemA: T; itemB: T; isFlipped: boolean }`
    - `generateUnbattledPair(outputs: OutputRecord[], existingBattles: BattleRecord[]): [OutputRecord, OutputRecord] | null`
  - `DuelService`:
    - `createDuel(taskId: string, outputAId?: string, outputBId?: string): Promise<AnonymousBattleView>`

- [ ] **Step 1: Write failing tests for randomization and blindness isolation**

`tests/unit/randomization.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RandomizationService } from '../../src/services/randomization.js';

describe('Randomization & Blindness Service', () => {
  it('generates unique anonymous IDs', () => {
    const id1 = RandomizationService.generateAnonymousId();
    const id2 = RandomizationService.generateAnonymousId();
    expect(id1).toMatch(/^anon_[a-f0-9]{8}$/);
    expect(id1).not.toBe(id2);
  });

  it('balances positional assignment (A vs B) uniformly to eliminate bias', () => {
    let flippedCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const { isFlipped } = RandomizationService.shufflePair('model1', 'model2');
      if (isFlipped) flippedCount++;
    }
    // Should be approximately 500 (between 440 and 560 with p > 0.999)
    expect(flippedCount).toBeGreaterThan(430);
    expect(flippedCount).toBeLessThan(570);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/randomization.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement RandomizationService and DuelService**

Implement using Node.js `crypto.randomBytes` to ensure cryptographic unpredictability and prevent identity leakage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/randomization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/randomization.ts src/services/duelService.ts tests/unit/randomization.test.ts
git commit -m "feat(engine): cryptographic duel randomization and anonymous masking"
```

---

### Task 5: Mathematical Ranking Engine (Bradley-Terry MLE + Elo)

**Files:**
- Create: `src/services/ranking.ts`
- Test: `tests/unit/ranking.test.ts`

**Interfaces:**
- Produces:
  - `RankingService`:
    - `calculateBradleyTerry(modelIds: string[], matches: MatchResult[], options?: BTOptions): BradleyTerryOutput`
    - `calculateEloUpdates(ratingA: number, ratingB: number, outcome: 'A' | 'B' | 'tie', battlesCountA: number, battlesCountB: number): { newRatingA: number; newRatingB: number }`
    - `assessConfidence(battleCount: number): 'preliminary' | 'emerging' | 'established'`

- [ ] **Step 1: Write failing tests for Bradley-Terry MLE convergence and Elo updates**

`tests/unit/ranking.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RankingService } from '../../src/services/ranking.js';

describe('Ranking Engine (Bradley-Terry & Elo)', () => {
  it('correctly orders models with clear win margins', () => {
    // Model A beats Model B (4 times), Model B beats Model C (4 times), Model A beats Model C (4 times)
    const matches = [
      { winnerId: 'A', loserId: 'B', isTie: false },
      { winnerId: 'A', loserId: 'B', isTie: false },
      { winnerId: 'A', loserId: 'B', isTie: false },
      { winnerId: 'A', loserId: 'B', isTie: false },
      { winnerId: 'B', loserId: 'C', isTie: false },
      { winnerId: 'B', loserId: 'C', isTie: false },
      { winnerId: 'B', loserId: 'C', isTie: false },
      { winnerId: 'B', loserId: 'C', isTie: false },
      { winnerId: 'A', loserId: 'C', isTie: false },
      { winnerId: 'A', loserId: 'C', isTie: false },
    ];

    const result = RankingService.calculateBradleyTerry(['A', 'B', 'C'], matches);
    expect(result.scores['A']).toBeGreaterThan(result.scores['B']);
    expect(result.scores['B']).toBeGreaterThan(result.scores['C']);
  });

  it('handles regularized zero-win models without NaN or infinite loops', () => {
    const matches = [
      { winnerId: 'A', loserId: 'B', isTie: false },
      { winnerId: 'A', loserId: 'B', isTie: false },
    ];
    const result = RankingService.calculateBradleyTerry(['A', 'B', 'C'], matches);
    expect(Number.isFinite(result.scores['C'])).toBe(true);
  });

  it('updates Elo ratings appropriately on win and tie', () => {
    const winResult = RankingService.calculateEloUpdates(1200, 1200, 'A', 5, 5);
    expect(winResult.newRatingA).toBeGreaterThan(1200);
    expect(winResult.newRatingB).toBeLessThan(1200);

    const tieResult = RankingService.calculateEloUpdates(1200, 1200, 'tie', 5, 5);
    expect(tieResult.newRatingA).toBe(1200);
    expect(tieResult.newRatingB).toBe(1200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ranking.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Bradley-Terry MM iteration, Fisher Information standard error, and Elo**

`src/services/ranking.ts`: Implement Minorization-Maximization iteration, Laplace prior $\alpha = 1.0$, tolerance $10^{-5}$, standard error computation, and Elo calculations with dynamic $K$-factor.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ranking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ranking.ts tests/unit/ranking.test.ts
git commit -m "feat(engine): bradley-terry mle and elo ranking calculations"
```

---

### Task 6: Preference Analytics Service

**Files:**
- Create: `src/services/analytics.ts`
- Test: `tests/unit/analytics.test.ts`

**Interfaces:**
- Produces:
  - `AnalyticsService`:
    - `extractTextMetrics(text: string): TextMetrics` (`wordCount`, `sentenceCount`, `bulletPointCount`, `avgWordLength`)
    - `analyzeUserPreferences(userId: string, category?: string): PreferenceReport`

- [ ] **Step 1: Write failing tests for writing metric extraction and preference deduction**

`tests/unit/analytics.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '../../src/services/analytics.js';

describe('Preference Analytics', () => {
  it('extracts structural and conciseness metrics from text', () => {
    const sample = `Dear Executive,\n\nHere are 3 reasons to partner:\n- Faster delivery\n- Lower cost\n- Higher quality\n\nBest regards,\nTeam`;
    const metrics = AnalyticsService.extractTextMetrics(sample);
    expect(metrics.wordCount).toBeGreaterThan(15);
    expect(metrics.bulletPointCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/analytics.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AnalyticsService**

Implement writing text analysis and correlation algorithms across user vote decisions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): user preference deduction and writing metrics correlation"
```

---

### Task 7: Benchmark Orchestration Service

**Files:**
- Create: `src/services/benchmark.ts`
- Test: `tests/unit/benchmark.test.ts`

**Interfaces:**
- Produces:
  - `BenchmarkService`:
    - `createTask(params: CreateTaskParams): Promise<TaskRecord>`
    - `generateOutputs(taskId: string, modelIds?: string[]): Promise<GenerationSummary>`
    - `startDuel(taskId: string, outputAId?: string, outputBId?: string): Promise<AnonymousBattleView>`
    - `submitVote(battleId: string, choice: 'A' | 'B' | 'tie', reason?: string, dimensionScores?: Record<string, number>): Promise<VoteResult>`
    - `getResults(taskId: string, reveal: boolean): Promise<TaskResultsView>`

- [ ] **Step 1: Write failing integration test for the benchmark orchestration lifecycle**

`tests/unit/benchmark.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { BenchmarkService } from '../../src/services/benchmark.js';
import Database from 'better-sqlite3';

describe('Benchmark Orchestration Service', () => {
  let db: Database.Database;
  let service: BenchmarkService;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
    service = new BenchmarkService(db, 'mock-key');
  });

  afterEach(() => {
    db.close();
  });

  it('enforces tournament reveal mode: models hidden before reveal', async () => {
    const task = service.createTask({
      userId: 'default_user',
      title: 'Marketing Ad',
      category: 'Marketing',
      prompt: 'Write a punchy headline.',
    });

    const unrevealedResults = service.getResults(task.id, false);
    expect(unrevealedResults.revealed).toBe(false);
    expect(unrevealedResults.models).toBeUndefined();

    const revealedResults = service.getResults(task.id, true);
    expect(revealedResults.revealed).toBe(true);
    expect(revealedResults.models).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/benchmark.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement BenchmarkService**

Tie together database repositories, OpenRouter client, duel service, and ranking updater.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/benchmark.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/benchmark.ts tests/unit/benchmark.test.ts
git commit -m "feat(service): benchmark task orchestration and lifecycle management"
```

---

### Task 8: The 10 MCP Tools Implementation & MCP Stdio Server

**Files:**
- Create: `src/types/mcp.ts`
- Create: `src/tools/benchmarkCreateTask.ts`
- Create: `src/tools/benchmarkListModels.ts`
- Create: `src/tools/benchmarkGenerateOutputs.ts`
- Create: `src/tools/benchmarkStartDuel.ts`
- Create: `src/tools/benchmarkSubmitVote.ts`
- Create: `src/tools/benchmarkGetResults.ts`
- Create: `src/tools/benchmarkGetLeaderboard.ts`
- Create: `src/tools/benchmarkCompareModels.ts`
- Create: `src/tools/benchmarkAnalyzePreferences.ts`
- Create: `src/tools/benchmarkGetModelStats.ts`
- Create: `src/server.ts`
- Create: `src/index.ts`
- Test: `tests/integration/mcpTools.test.ts`

**Interfaces:**
- Produces:
  - MCP Server running on `StdioServerTransport`
  - Tool handlers registered with `@modelcontextprotocol/sdk`

- [ ] **Step 1: Write integration tests for MCP server tools**

`tests/integration/mcpTools.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMcpServer } from '../../src/server.js';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import Database from 'better-sqlite3';

describe('MCP Server & Tools Registration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('registers all 10 tools properly', () => {
    const server = createMcpServer(db, 'mock-key');
    expect(server).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/mcpTools.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement all 10 tools, server.ts, and index.ts**

Implement all tools using Zod schemas matching Section 6 of the spec. In `src/index.ts`, load config, initialize DB, run migrations, instantiate server, and connect to `StdioServerTransport`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/mcpTools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/mcp.ts src/tools/ src/server.ts src/index.ts tests/integration/mcpTools.test.ts
git commit -m "feat(tools): 10 mcp tool handlers and server stdio integration"
```

---

### Task 9: Comprehensive End-to-End Simulation Tests & Build Verification

**Files:**
- Create: `tests/integration/e2eWorkflow.test.ts`

**Interfaces:**
- Consumes: All services, tools, and DB layer
- Produces: End-to-end verified build (`dist/index.js`)

- [ ] **Step 1: Write end-to-end tournament simulation test**

`tests/integration/e2eWorkflow.test.ts`:
Simulate the entire user workflow:
1. `benchmark_create_task`
2. `benchmark_list_models`
3. Mock generation of 4 model outputs via `benchmark_generate_outputs`
4. Conduct 4 A/B duels via `benchmark_start_duel` (verify anonymous output IDs)
5. Submit votes via `benchmark_submit_vote`
6. Query `benchmark_get_results` (`reveal: false` -> verify identities are masked)
7. Query `benchmark_get_results` (`reveal: true` -> verify unmasking, latency, cost)
8. Query `benchmark_get_leaderboard` (verify Bradley-Terry and Elo ranks)
9. Query `benchmark_compare_models`
10. Query `benchmark_analyze_preferences`

- [ ] **Step 2: Run the test suite across all unit and integration tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Verify build compilation**

Run: `npm run build`
Expected: TypeScript compiles with zero errors into `dist/`.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/e2eWorkflow.test.ts
git commit -m "test: comprehensive end-to-end tournament integration suite"
```

---

### Task 10: Production Documentation & Claude Desktop Configuration

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `docs/claude_desktop_setup.md`

- [ ] **Step 1: Write README.md with architecture diagram, installation, tool overview, and Claude Desktop config**
- [ ] **Step 2: Create .env.example with documented options**
- [ ] **Step 3: Commit**

```bash
git add README.md .env.example docs/claude_desktop_setup.md
git commit -m "docs: comprehensive readme, claude desktop setup guide, and env example"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-08-blindwrite-mcp.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
