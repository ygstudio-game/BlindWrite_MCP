import { describe, it, expect } from 'vitest';
import { RankingService } from '../../src/services/ranking.js';

describe('Ranking Engine (Bradley-Terry & Elo)', () => {
  it('correctly ranks models with clear transitive margins', () => {
    // Model A beats B 4 times
    // Model B beats C 4 times
    // Model A beats C 4 times
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
      { winnerId: 'A', loserId: 'C', isTie: false },
      { winnerId: 'A', loserId: 'C', isTie: false },
    ];

    const result = RankingService.calculateBradleyTerry(['A', 'B', 'C'], matches);
    expect(result.converged).toBe(true);
    expect(result.scores['A']).toBeGreaterThan(result.scores['B']);
    expect(result.scores['B']).toBeGreaterThan(result.scores['C']);
  });

  it('handles ties as half-wins (0.5) gracefully', () => {
    const matches = [
      { winnerId: 'A', loserId: 'B', isTie: true },
      { winnerId: 'A', loserId: 'B', isTie: true },
    ];

    const result = RankingService.calculateBradleyTerry(['A', 'B'], matches);
    expect(result.converged).toBe(true);
    expect(result.scores['A']).toBeCloseTo(result.scores['B'], 1);
  });

  it('handles disconnected and zero-win models via Laplace prior regularization without NaN or infinity', () => {
    const matches = [
      { winnerId: 'A', loserId: 'B', isTie: false },
      { winnerId: 'A', loserId: 'B', isTie: false },
    ];

    // Model C has 0 battles
    const result = RankingService.calculateBradleyTerry(['A', 'B', 'C'], matches);
    expect(result.converged).toBe(true);
    expect(Number.isFinite(result.scores['A'])).toBe(true);
    expect(Number.isFinite(result.scores['B'])).toBe(true);
    expect(Number.isFinite(result.scores['C'])).toBe(true);
    expect(result.scores['A']).toBeGreaterThan(result.scores['B']);
  });

  it('calculates dynamic Elo updates for win, loss, and tie', () => {
    // Win scenario: 1200 vs 1200
    const winResult = RankingService.calculateEloUpdates(1200, 1200, 'A', 5, 5);
    expect(winResult.newRatingA).toBe(1216); // 1200 + 32 * (1 - 0.5)
    expect(winResult.newRatingB).toBe(1184); // 1200 + 32 * (0 - 0.5)

    // Tie scenario: 1200 vs 1200
    const tieResult = RankingService.calculateEloUpdates(1200, 1200, 'tie', 5, 5);
    expect(tieResult.newRatingA).toBe(1200);
    expect(tieResult.newRatingB).toBe(1200);

    // K-factor transition after 20 battles
    const establishedResult = RankingService.calculateEloUpdates(1200, 1200, 'A', 25, 25);
    expect(establishedResult.newRatingA).toBe(1208); // 1200 + 16 * (1 - 0.5)
    expect(establishedResult.newRatingB).toBe(1192);
  });

  it('categorizes uncertainty and confidence appropriately', () => {
    expect(RankingService.assessConfidence(2)).toBe('preliminary');
    expect(RankingService.assessConfidence(8)).toBe('emerging');
    expect(RankingService.assessConfidence(20)).toBe('established');
  });
});
