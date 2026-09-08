import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { BenchmarkService } from '../../src/services/benchmark.js';
import type Database from 'better-sqlite3';

describe('WriterGenerate and directWrite', () => {
  let db: Database.Database;
  let service: BenchmarkService;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
    db.prepare("INSERT OR IGNORE INTO users (id, name) VALUES ('default_user', 'Default User')").run();
    service = new BenchmarkService(db, 'mock-key');
  });

  afterEach(() => {
    db.close();
  });

  it('delegates writing to explicit model via OpenRouter', async () => {
    vi.spyOn(service.openRouterService, 'generateOutput').mockResolvedValue({
      modelId: 'gpt-4o',
      outputText: 'Subject: Quick question regarding your sales pipeline\n\nHi Alex, noticed your recent growth...',
      promptTokens: 50,
      completionTokens: 120,
      totalTokens: 170,
      latencyMs: 820,
      estimatedCost: 0.001325,
    });

    const result = await service.directWrite({
      prompt: 'Write a cold email to a VP of Sales.',
      modelId: 'openai/gpt-4o',
      temperature: 0.7,
    });

    expect(result.text).toContain('Quick question');
    expect(result.modelId).toBe('gpt-4o');
    expect(result.latencyMs).toBe(820);
    expect(result.tokensCompletion).toBe(120);
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.selectionReason).toContain('Explicitly specified');
  });

  it('defaults to cost-saving DeepSeek V3 when no model is specified and no rankings exist', async () => {
    vi.spyOn(service.openRouterService, 'generateOutput').mockResolvedValue({
      modelId: 'deepseek-v3',
      outputText: 'Draft content generated at super low cost.',
      promptTokens: 30,
      completionTokens: 80,
      totalTokens: 110,
      latencyMs: 450,
      estimatedCost: 0.000026,
    });

    const result = await service.directWrite({
      prompt: 'Summarize our key value propositions.',
    });

    expect(result.modelId).toBe('deepseek-v3');
    expect(result.selectionReason).toContain('DeepSeek V3');
    expect(result.tokensCompletion).toBe(80);
  });

  it('picks personal #1 ranked model for category when available', async () => {
    // Seed a personal ranking for category 'Emails'
    service.rankingRepo.upsertRanking({
      scope: 'personal',
      userId: 'default_user',
      category: 'Emails',
      modelId: 'claude-3-5-sonnet',
      bradleyTerryScore: 125.0,
      eloRating: 1350.0,
      battlesCount: 8,
      winsCount: 7,
      lossesCount: 1,
      tiesCount: 0,
      winRate: 0.875,
      uncertainty: 0.2,
    });

    vi.spyOn(service.openRouterService, 'generateOutput').mockResolvedValue({
      modelId: 'claude-3-5-sonnet',
      outputText: 'Top-ranked email draft from Claude 3.5 Sonnet.',
      promptTokens: 40,
      completionTokens: 150,
      totalTokens: 190,
      latencyMs: 950,
      estimatedCost: 0.00237,
    });

    const result = await service.directWrite({
      prompt: 'Draft an executive memo.',
      category: 'Emails',
    });

    expect(result.modelId).toBe('claude-3-5-sonnet');
    expect(result.selectionReason).toContain('Ranked #1 on your personal leaderboard');
  });

  it('appends self-critique instructions when includeCritique is true', async () => {
    const spy = vi.spyOn(service.openRouterService, 'generateOutput').mockResolvedValue({
      modelId: 'deepseek-v3',
      outputText: 'Draft with self-critique block at the end.',
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
      latencyMs: 500,
      estimatedCost: 0.00003,
    });

    const result = await service.directWrite({
      prompt: 'Write an apology email to a customer.',
      includeCritique: true,
      exportFile: false,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('[SELF-EVALUATION]'),
      expect.anything()
    );
    expect(result.text).toContain('Draft with self-critique');
  });

  it('exports draft to local data/drafts/ directory by default', async () => {
    vi.spyOn(service.openRouterService, 'generateOutput').mockResolvedValue({
      modelId: 'deepseek-v3',
      outputText: 'Draft meant to be saved locally.',
      promptTokens: 40,
      completionTokens: 90,
      totalTokens: 130,
      latencyMs: 400,
      estimatedCost: 0.000025,
    });

    const result = await service.directWrite({
      prompt: 'Draft an engineering update.',
      category: 'Technical Writing',
      exportFile: true,
    });

    expect(result.savedToFile).toBeDefined();
    expect(result.savedToFile).toContain('technical-writing');
  });
});

