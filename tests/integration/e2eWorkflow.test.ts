import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { BenchmarkService } from '../../src/services/benchmark.js';
import type Database from 'better-sqlite3';

describe('End-to-End Tournament Simulation Workflow', () => {
  let db: Database.Database;
  let service: BenchmarkService;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
    service = new BenchmarkService(db, 'mock-openrouter-key');
  });

  afterEach(() => {
    db.close();
  });

  it('runs a complete tournament: creation -> generation -> blind battles -> voting -> reveal -> ranking -> analytics', async () => {
    // 1. User asks Claude to benchmark models for "Technical Writing"
    const task = service.createTask({
      userId: 'user_engineering_lead',
      title: 'API Authentication RFC',
      category: 'Technical Writing',
      prompt: 'Write an architectural RFC section explaining OAuth 2.0 PKCE flow for single-page applications.',
      evaluationCriteria: 'Technical accuracy, clarity, and security completeness',
      difficulty: 'hard',
    });
    expect(task.id).toBeDefined();

    // 2. Select 4 competing models
    const selectedModelIds = ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1-5-pro', 'deepseek-v3'];

    // Mock OpenRouter parallel responses
    vi.spyOn(service.openRouterService, 'generateOutputsParallel').mockResolvedValue([
      {
        modelId: 'claude-3-5-sonnet',
        outputText: 'OAuth 2.0 with PKCE enhances security for SPAs by eliminating client secret requirements.\n- Step 1: Code Verifier\n- Step 2: Code Challenge\n- Step 3: Authorization Code Exchange',
        promptTokens: 45,
        completionTokens: 85,
        totalTokens: 130,
        latencyMs: 920,
        estimatedCost: 0.0014,
      },
      {
        modelId: 'gpt-4o',
        outputText: 'The Proof Key for Code Exchange (PKCE) is defined in RFC 7636. In this flow, the client creates a cryptographic secret called code_verifier.',
        promptTokens: 45,
        completionTokens: 90,
        totalTokens: 135,
        latencyMs: 1100,
        estimatedCost: 0.0010,
      },
      {
        modelId: 'gemini-1-5-pro',
        outputText: 'PKCE (RFC 7636) prevents authorization code interception attacks. Here is the architectural overview:\n1. Client generates secret\n2. Client hashes secret\n3. Auth server verifies hash',
        promptTokens: 45,
        completionTokens: 75,
        totalTokens: 120,
        latencyMs: 810,
        estimatedCost: 0.0004,
      },
      {
        modelId: 'deepseek-v3',
        outputText: 'Overview of PKCE protocol:\n- Verifier generation: random 43-128 chars\n- Challenge: BASE64URL-ENCODE(SHA256(verifier))\n- Token request validation',
        promptTokens: 45,
        completionTokens: 70,
        totalTokens: 115,
        latencyMs: 650,
        estimatedCost: 0.0001,
      },
    ]);

    // 3. Generate outputs (verify strict blindness in returned summary)
    const genResult = await service.generateOutputs(task.id, selectedModelIds);
    expect(genResult.outputsGenerated).toBe(4);
    expect(genResult.anonymousOutputIds.length).toBe(4);

    const jsonStr = JSON.stringify(genResult);
    expect(jsonStr).not.toContain('claude-3-5-sonnet');
    expect(jsonStr).not.toContain('gpt-4o');
    expect(jsonStr).not.toContain('gemini-1-5-pro');
    expect(jsonStr).not.toContain('deepseek-v3');

    // 4. Conduct multiple pairwise duels
    // Duel 1
    const duel1 = service.startDuel(task.id);
    expect(duel1.battleId).toBeDefined();
    expect(duel1.responseA.text).toBeDefined();
    expect(duel1.responseB.text).toBeDefined();

    // User votes for Response A with reasoning
    const vote1 = service.submitVote({
      battleId: duel1.battleId,
      choice: 'A',
      reason: 'Loved the structured bullet points and concise breakdown.',
      dimensionScores: { clarity: 5, structure: 5, accuracy: 5 },
      userId: 'user_engineering_lead',
    });
    expect(vote1.status).toBe('recorded');

    // Duel 2
    const duel2 = service.startDuel(task.id);
    const vote2 = service.submitVote({
      battleId: duel2.battleId,
      choice: 'B',
      reason: 'Response B was much more direct.',
      dimensionScores: { clarity: 4, conciseness: 5 },
      userId: 'user_engineering_lead',
    });
    expect(vote2.status).toBe('recorded');

    // Duel 3 (A tie)
    const duel3 = service.startDuel(task.id);
    const vote3 = service.submitVote({
      battleId: duel3.battleId,
      choice: 'tie',
      reason: 'Both responses covered all key points equally well.',
      dimensionScores: { clarity: 4, accuracy: 4 },
      userId: 'user_engineering_lead',
    });
    expect(vote3.status).toBe('recorded');

    // 5. Pre-reveal verification: Calling getResults without reveal flag MUST hide model identities
    const preReveal = service.getResults(task.id, false);
    expect(preReveal.revealed).toBe(false);
    expect(preReveal.models).toBeUndefined();
    expect(preReveal.anonymousOutputs?.length).toBe(4);

    // 6. Post-reveal verification: Reveal flag unmasks all outputs and marks task revealed
    const postReveal = service.getResults(task.id, true);
    expect(postReveal.revealed).toBe(true);
    expect(postReveal.models).toBeDefined();
    expect(postReveal.models?.length).toBe(4);
    for (const m of postReveal.models!) {
      expect(m.displayName).toBeDefined();
      expect(m.provider).toBeDefined();
      expect(m.avgLatencyMs).toBeGreaterThan(0);
    }

    // 7. Check Leaderboard (Personal and Category-filtered)
    const personalLeaderboard = service.getLeaderboard({
      scope: 'personal',
      userId: 'user_engineering_lead',
      category: 'Technical Writing',
    });
    expect(personalLeaderboard.length).toBeGreaterThan(0);
    expect(personalLeaderboard[0].score).toBeDefined();
    expect(personalLeaderboard[0].elo).toBeDefined();
    expect(personalLeaderboard[0].confidence).toBeDefined();

    // 8. Head-to-Head Model Comparison
    const comparison = service.compareModels('claude-3-5-sonnet', 'gpt-4o');
    expect(comparison.modelA.displayName).toBe('Claude 3.5 Sonnet');
    expect(comparison.modelB.displayName).toBe('GPT-4o');

    // 9. Detailed Model Statistics
    const claudeStats = service.getModelStats('claude-3-5-sonnet');
    expect(claudeStats.displayName).toBe('Claude 3.5 Sonnet');
    expect(claudeStats.provider).toBe('Anthropic');
    expect(claudeStats.eloRating).toBeGreaterThan(0);

    // 10. Preference Analytics
    const preferences = service.analyzePreferences('Technical Writing', 'user_engineering_lead');
    expect(preferences.totalVotesAnalyzed).toBeGreaterThanOrEqual(3);
    expect(preferences.dimensionAverages).toBeDefined();
    expect(preferences.topMatchingModels).toBeDefined();
  });
});
