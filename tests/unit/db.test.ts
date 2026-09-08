import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { TaskRepository } from '../../src/db/repositories/taskRepo.js';
import { ModelRepository } from '../../src/db/repositories/modelRepo.js';
import { OutputRepository } from '../../src/db/repositories/outputRepo.js';
import { BattleRepository } from '../../src/db/repositories/battleRepo.js';
import { VoteRepository } from '../../src/db/repositories/voteRepo.js';
import { RankingRepository } from '../../src/db/repositories/rankingRepo.js';
import type Database from 'better-sqlite3';

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
    expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
    expect(models.some(m => m.id === 'deepseek-v3')).toBe(true);
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
    expect(fetched?.category).toBe('Emails');
  });

  it('handles outputs, battles, votes, and rankings lifecycle', () => {
    const taskRepo = new TaskRepository(db);
    const outputRepo = new OutputRepository(db);
    const battleRepo = new BattleRepository(db);
    const voteRepo = new VoteRepository(db);
    const rankingRepo = new RankingRepository(db);

    const task = taskRepo.createTask({
      userId: 'default_user',
      title: 'Test Task',
      category: 'General Writing',
      prompt: 'Summarize quantum computing.',
    });

    const output1 = outputRepo.createOutput({
      taskId: task.id,
      modelId: 'claude-3-5-sonnet',
      anonymousId: 'anon_001',
      outputText: 'Output 1 text',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      latencyMs: 800,
      estimatedCost: 0.0003,
    });

    const output2 = outputRepo.createOutput({
      taskId: task.id,
      modelId: 'gpt-4o',
      anonymousId: 'anon_002',
      outputText: 'Output 2 text',
      promptTokens: 10,
      completionTokens: 25,
      totalTokens: 35,
      latencyMs: 950,
      estimatedCost: 0.0003,
    });

    const outputs = outputRepo.getOutputsByTaskId(task.id);
    expect(outputs.length).toBe(2);

    const battle = battleRepo.createBattle({
      taskId: task.id,
      outputAId: output1.id,
      outputBId: output2.id,
    });
    expect(battle.status).toBe('pending');

    const vote = voteRepo.createVote({
      battleId: battle.id,
      userId: 'default_user',
      selectedOutputId: output1.id,
      isTie: false,
      reason: 'Output A was clearer and better organized.',
      dimensionScores: { clarity: 5, structure: 4 },
    });
    expect(vote.id).toBeDefined();

    battleRepo.markVoted(battle.id);
    const updatedBattle = battleRepo.getBattleById(battle.id);
    expect(updatedBattle?.status).toBe('voted');

    rankingRepo.upsertRanking({
      scope: 'personal',
      userId: 'default_user',
      category: 'General Writing',
      modelId: 'claude-3-5-sonnet',
      bradleyTerryScore: 110.5,
      eloRating: 1220.0,
      battlesCount: 1,
      winsCount: 1,
      lossesCount: 0,
      tiesCount: 0,
      winRate: 1.0,
      uncertainty: 0.8,
    });

    const rankings = rankingRepo.getRankings({ scope: 'personal', userId: 'default_user', category: 'General Writing' });
    expect(rankings.length).toBe(1);
    expect(rankings[0].model_id).toBe('claude-3-5-sonnet');
    expect(rankings[0].elo_rating).toBe(1220.0);
  });
});
