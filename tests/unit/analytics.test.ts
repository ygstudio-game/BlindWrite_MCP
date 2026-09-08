import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalyticsService } from '../../src/services/analytics.js';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { TaskRepository } from '../../src/db/repositories/taskRepo.js';
import { OutputRepository } from '../../src/db/repositories/outputRepo.js';
import { BattleRepository } from '../../src/db/repositories/battleRepo.js';
import { VoteRepository } from '../../src/db/repositories/voteRepo.js';
import { ModelRepository } from '../../src/db/repositories/modelRepo.js';
import type Database from 'better-sqlite3';

describe('Preference Analytics Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('extracts structural, length, and readability metrics from text', () => {
    const text = `Hi Alex,\n\nHere is the executive summary:\n- Revenue grew by 45%\n- Churn dropped to 1.2%\n- Expansion plan is on track\n\nLet me know your thoughts.\nBest regards.`;
    const metrics = AnalyticsService.extractTextMetrics(text);

    expect(metrics.wordCount).toBeGreaterThan(20);
    expect(metrics.sentenceCount).toBeGreaterThanOrEqual(3);
    expect(metrics.bulletPointCount).toBe(3);
    expect(metrics.avgWordLength).toBeGreaterThan(3);
  });

  it('analyzes user preferences from voting history without hallucination', () => {
    const taskRepo = new TaskRepository(db);
    const outputRepo = new OutputRepository(db);
    const battleRepo = new BattleRepository(db);
    const voteRepo = new VoteRepository(db);
    const modelRepo = new ModelRepository(db);
    const analytics = new AnalyticsService(taskRepo, outputRepo, battleRepo, voteRepo, modelRepo);

    // Empty state returns empty report with 0 votes analyzed
    const emptyReport = analytics.analyzeUserPreferences('default_user');
    expect(emptyReport.totalVotesAnalyzed).toBe(0);
    expect(emptyReport.observedPreferences.length).toBe(0);

    // Seed task, outputs, and votes
    const task = taskRepo.createTask({
      userId: 'default_user',
      title: 'Email Brief',
      category: 'Emails',
      prompt: 'Write a cold pitch email.',
    });

    // Short concise output (Claude) vs verbose output (GPT)
    const shortOutput = outputRepo.createOutput({
      taskId: task.id,
      modelId: 'claude-3-5-sonnet',
      anonymousId: 'anon_short',
      outputText: 'Short concise pitch with bullet points:\n- Point 1\n- Point 2',
    });

    const verboseOutput = outputRepo.createOutput({
      taskId: task.id,
      modelId: 'gpt-4o',
      anonymousId: 'anon_long',
      outputText: 'This is an extremely long, wordy, flowery paragraph with excessive adjectives describing the product at great length without any clear bullet points or structure.',
    });

    const battle = battleRepo.createBattle({
      taskId: task.id,
      outputAId: shortOutput.id,
      outputBId: verboseOutput.id,
    });

    voteRepo.createVote({
      battleId: battle.id,
      userId: 'default_user',
      selectedOutputId: shortOutput.id,
      isTie: false,
      reason: 'Much more concise and easy to read.',
      dimensionScores: { conciseness: 5, clarity: 5, tone: 4 },
    });
    battleRepo.markVoted(battle.id);

    const report = analytics.analyzeUserPreferences('default_user', 'Emails');
    expect(report.totalVotesAnalyzed).toBe(1);
    expect(report.dimensionAverages['conciseness']).toBe(5);
    expect(report.dimensionAverages['clarity']).toBe(5);

    expect(report.observedPreferences.some(p => p.dimension === 'Brevity & Conciseness')).toBe(true);
    expect(report.topMatchingModels.length).toBeGreaterThan(0);
    expect(report.topMatchingModels[0].modelId).toBe('claude-3-5-sonnet');
  });
});
