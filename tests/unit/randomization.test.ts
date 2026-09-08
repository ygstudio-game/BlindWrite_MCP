import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RandomizationService } from '../../src/services/randomization.js';
import { DuelService } from '../../src/services/duelService.js';
import { initDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { TaskRepository } from '../../src/db/repositories/taskRepo.js';
import { OutputRepository } from '../../src/db/repositories/outputRepo.js';
import { BattleRepository } from '../../src/db/repositories/battleRepo.js';
import type Database from 'better-sqlite3';

describe('Cryptographic Randomization & Duel Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('generates unique anonymous IDs with anon_ prefix', () => {
    const id1 = RandomizationService.generateAnonymousId();
    const id2 = RandomizationService.generateAnonymousId();
    expect(id1).toMatch(/^anon_[a-f0-9]{8}$/);
    expect(id2).toMatch(/^anon_[a-f0-9]{8}$/);
    expect(id1).not.toBe(id2);
  });

  it('balances positional assignment (A vs B) uniformly over 1,000 trials', () => {
    let flippedCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const { isFlipped } = RandomizationService.shufflePair('model1', 'model2');
      if (isFlipped) flippedCount++;
    }
    // With 1000 trials, 50% expectation has stddev sqrt(1000*0.25) ~ 15.8
    // Between 420 and 580 covers > 99.999% confidence
    expect(flippedCount).toBeGreaterThan(420);
    expect(flippedCount).toBeLessThan(580);
  });

  it('selects unbattled pairs to avoid redundant battles', () => {
    const outputs = [
      { id: 'out_1', anonymous_id: 'anon_1' },
      { id: 'out_2', anonymous_id: 'anon_2' },
      { id: 'out_3', anonymous_id: 'anon_3' },
    ];

    const existingBattles = [
      { output_a_id: 'out_1', output_b_id: 'out_2' },
    ];

    const pair = RandomizationService.findUnbattledPair(outputs as any, existingBattles as any);
    expect(pair).not.toBeNull();
    // Pair should be (out_1, out_3) or (out_2, out_3)
    const ids = [pair![0].id, pair![1].id].sort();
    expect(ids).not.toEqual(['out_1', 'out_2']);
  });

  it('creates an anonymous duel view strictly hiding model identities', () => {
    const taskRepo = new TaskRepository(db);
    const outputRepo = new OutputRepository(db);
    const battleRepo = new BattleRepository(db);
    const duelService = new DuelService(taskRepo, outputRepo, battleRepo);

    const task = taskRepo.createTask({
      title: 'Email Duel',
      category: 'Emails',
      prompt: 'Write an apology email.',
      evaluationCriteria: 'Empathy, conciseness',
    });

    const out1 = outputRepo.createOutput({
      taskId: task.id,
      modelId: 'claude-3-5-sonnet',
      anonymousId: 'anon_alpha',
      outputText: 'Apology text from Claude.',
    });

    const out2 = outputRepo.createOutput({
      taskId: task.id,
      modelId: 'gpt-4o',
      anonymousId: 'anon_beta',
      outputText: 'Apology text from GPT.',
    });

    const duel = duelService.createDuel(task.id);
    expect(duel.battleId).toBeDefined();
    expect(duel.taskId).toBe(task.id);
    expect(duel.prompt).toBe('Write an apology email.');
    expect(duel.evaluationCriteria).toBe('Empathy, conciseness');

    // Both outputs are present as Response A and Response B
    expect(['anon_alpha', 'anon_beta']).toContain(duel.responseA.id);
    expect(['anon_alpha', 'anon_beta']).toContain(duel.responseB.id);
    expect(duel.responseA.id).not.toBe(duel.responseB.id);

    // Verify STRICT blindness: no model_id or provider leaks in response
    const duelJson = JSON.stringify(duel);
    expect(duelJson).not.toContain('claude-3-5-sonnet');
    expect(duelJson).not.toContain('gpt-4o');
    expect(duelJson).not.toContain('Anthropic');
    expect(duelJson).not.toContain('OpenAI');
  });
});
