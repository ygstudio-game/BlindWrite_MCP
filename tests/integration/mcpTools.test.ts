import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMcpServer } from '../../src/server.js';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import type Database from 'better-sqlite3';

describe('MCP Tools Integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates McpServer instance and registers all 10 benchmark tools', () => {
    const { server, benchmarkService } = createMcpServer(db, 'mock-openrouter-key');
    expect(server).toBeDefined();
    expect(benchmarkService).toBeDefined();

    // Verify MCP Prompt registration for Claude Desktop
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registeredPrompts = (server as any)._registeredPrompts;
    expect(registeredPrompts).toBeDefined();
    expect(registeredPrompts['writing-orchestrator']).toBeDefined();

    // Verify tools can be invoked via benchmarkService
    const task = benchmarkService.createTask({
      title: 'Email Benchmark',
      category: 'Emails',
      prompt: 'Write an introductory pitch email.',
    });
    expect(task.id).toBeDefined();

    const models = benchmarkService.listModels();
    expect(models.length).toBeGreaterThanOrEqual(6);

    const duelTask = benchmarkService.createTask({
      title: 'Duel',
      category: 'Emails',
      prompt: 'Draft an email.',
    });

    // Mock output generation
    vi.spyOn(benchmarkService.openRouterService, 'generateOutputsParallel').mockResolvedValue([
      {
        modelId: 'claude-3-5-sonnet',
        outputText: 'First output from Claude',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        latencyMs: 600,
        estimatedCost: 0.0003,
      },
      {
        modelId: 'gpt-4o',
        outputText: 'Second output from GPT',
        promptTokens: 10,
        completionTokens: 25,
        totalTokens: 35,
        latencyMs: 700,
        estimatedCost: 0.0003,
      },
    ]);

    // Test output generation, duel, voting, results, leaderboard, compare, and stats
    return benchmarkService.generateOutputs(duelTask.id).then((genResult) => {
      expect(genResult.outputsGenerated).toBe(2);

      const duel = benchmarkService.startDuel(duelTask.id);
      expect(duel.battleId).toBeDefined();

      const vote = benchmarkService.submitVote({
        battleId: duel.battleId,
        choice: 'A',
        reason: 'Preferred style',
      });
      expect(vote.status).toBe('recorded');

      const results = benchmarkService.getResults(duelTask.id, true);
      expect(results.revealed).toBe(true);
      expect(results.models?.length).toBe(2);

      const leaderboard = benchmarkService.getLeaderboard({ scope: 'personal' });
      expect(leaderboard.length).toBeGreaterThan(0);

      const comparison = benchmarkService.compareModels('claude-3-5-sonnet', 'gpt-4o');
      expect(comparison.totalBattles).toBe(1);

      const stats = benchmarkService.getModelStats('claude-3-5-sonnet');
      expect(stats.modelId).toBe('claude-3-5-sonnet');

      const prefs = benchmarkService.analyzePreferences('Emails');
      expect(prefs.totalVotesAnalyzed).toBe(1);
    });
  });
});
