import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { BenchmarkService } from '../../src/services/benchmark.js';
import type Database from 'better-sqlite3';

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

  it('creates task and lists enabled models', () => {
    const task = service.createTask({
      title: 'Sales Pitch Email',
      category: 'Emails',
      prompt: 'Write a cold pitch email to a retail buyer.',
      evaluationCriteria: 'Directness and ROI focus',
    });

    expect(task.id).toMatch(/^tsk_/);
    expect(task.category).toBe('Emails');

    const models = service.listModels();
    expect(models.length).toBeGreaterThanOrEqual(6);
  });

  it('generates outputs in parallel and masks model identities with anonymous IDs', async () => {
    const task = service.createTask({
      title: 'Creative Writing',
      category: 'Creative Writing',
      prompt: 'Write the opening paragraph of a mystery novel.',
    });

    // Mock OpenRouter parallel output generation
    vi.spyOn(service['openRouterService'], 'generateOutputsParallel').mockResolvedValue([
      {
        modelId: 'claude-3-5-sonnet',
        outputText: 'The fog crept through the cobblestone alley.',
        promptTokens: 20,
        completionTokens: 30,
        totalTokens: 50,
        latencyMs: 700,
        estimatedCost: 0.0005,
      },
      {
        modelId: 'gpt-4o',
        outputText: 'Rain tapped relentlessly against the attic window.',
        promptTokens: 20,
        completionTokens: 35,
        totalTokens: 55,
        latencyMs: 850,
        estimatedCost: 0.0004,
      },
    ]);

    const result = await service.generateOutputs(task.id, ['claude-3-5-sonnet', 'gpt-4o']);
    expect(result.outputsGenerated).toBe(2);
    expect(result.anonymousOutputIds.length).toBe(2);

    // Verify outputs are anonymized and stored
    const resultJson = JSON.stringify(result);
    expect(resultJson).not.toContain('claude-3-5-sonnet');
    expect(resultJson).not.toContain('gpt-4o');
  });

  it('orchestrates A/B duel, records vote, updates ratings, and handles tournament reveal gating', async () => {
    const task = service.createTask({
      title: 'Duel Task',
      category: 'Emails',
      prompt: 'Write an email.',
    });

    // Mock outputs
    vi.spyOn(service['openRouterService'], 'generateOutputsParallel').mockResolvedValue([
      {
        modelId: 'claude-3-5-sonnet',
        outputText: 'Response 1',
        promptTokens: 10,
        completionTokens: 10,
        totalTokens: 20,
        latencyMs: 500,
        estimatedCost: 0.0001,
      },
      {
        modelId: 'gpt-4o',
        outputText: 'Response 2',
        promptTokens: 10,
        completionTokens: 10,
        totalTokens: 20,
        latencyMs: 500,
        estimatedCost: 0.0001,
      },
    ]);

    await service.generateOutputs(task.id, ['claude-3-5-sonnet', 'gpt-4o']);

    // 1. Start duel
    const duel = service.startDuel(task.id);
    expect(duel.battleId).toBeDefined();
    expect(duel.responseA.text).toBeDefined();
    expect(duel.responseB.text).toBeDefined();

    // 2. Submit vote for Response A
    const voteResult = service.submitVote({
      battleId: duel.battleId,
      choice: 'A',
      reason: 'Much better tone',
      dimensionScores: { tone: 5 },
    });
    expect(voteResult.status).toBe('recorded');

    // 3. Before reveal: identities are masked
    const unrevealedResults = service.getResults(task.id, false);
    expect(unrevealedResults.revealed).toBe(false);
    expect(unrevealedResults.models).toBeUndefined();
    expect(unrevealedResults.anonymousOutputs?.length).toBe(2);

    // 4. Reveal requested: identities are unveiled
    const revealedResults = service.getResults(task.id, true);
    expect(revealedResults.revealed).toBe(true);
    expect(revealedResults.models).toBeDefined();
    expect(revealedResults.models?.length).toBe(2);
    expect(revealedResults.models?.some(m => m.modelId === 'claude-3-5-sonnet')).toBe(true);

    // 5. Check leaderboard
    const leaderboard = service.getLeaderboard({ scope: 'personal' });
    expect(leaderboard.length).toBeGreaterThan(0);

    // 6. Compare models
    const comparison = service.compareModels('claude-3-5-sonnet', 'gpt-4o');
    expect(comparison.totalBattles).toBe(1);

    // 7. Get model stats
    const stats = service.getModelStats('claude-3-5-sonnet');
    expect(stats.battles).toBe(1);
  });
});
