import { MatchResult, BradleyTerryOutput } from '../types/domain.js';

export class RankingService {
  /**
   * Estimates model skill ratings via the Bradley-Terry Maximum Likelihood
   * Estimation (MLE) using the iterative Minorization-Maximization (MM / Hunter 2004) algorithm.
   *
   * Includes Laplace prior regularization (alpha = 1.0) to prevent division by zero
   * and ensure convergence even with disconnected matchup graphs or zero-win models.
   */
  static calculateBradleyTerry(
    modelIds: string[],
    matches: MatchResult[],
    options: { maxIterations?: number; tolerance?: number; alpha?: number } = {}
  ): BradleyTerryOutput {
    const maxIterations = options.maxIterations ?? 100;
    const tolerance = options.tolerance ?? 1e-5;
    const alpha = options.alpha ?? 1.0;

    const n = modelIds.length;
    if (n === 0) {
      return { scores: {}, uncertainties: {}, iterations: 0, converged: true };
    }

    if (n === 1) {
      return {
        scores: { [modelIds[0]]: 100.0 },
        uncertainties: { [modelIds[0]]: 0.5 },
        iterations: 0,
        converged: true,
      };
    }

    // Map model ID to array index
    const modelIndex = new Map<string, number>();
    modelIds.forEach((id, idx) => modelIndex.set(id, idx));

    // Wins vector W and pairwise match matrix N
    const W = new Float64Array(n);
    const N: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const totalBattlesPerModel = new Float64Array(n);

    for (const match of matches) {
      const idxWin = modelIndex.get(match.winnerId);
      const idxLose = modelIndex.get(match.loserId);

      if (idxWin !== undefined && idxLose !== undefined && idxWin !== idxLose) {
        if (match.isTie) {
          W[idxWin] += 0.5;
          W[idxLose] += 0.5;
        } else {
          W[idxWin] += 1.0;
        }
        N[idxWin][idxLose] += 1;
        N[idxLose][idxWin] += 1;
        totalBattlesPerModel[idxWin] += 1;
        totalBattlesPerModel[idxLose] += 1;
      }
    }

    // Initialize skill parameters pi to 1.0
    let pi = new Float64Array(n).fill(1.0);
    let iterations = 0;
    let converged = false;

    for (let iter = 0; iter < maxIterations; iter++) {
      iterations++;
      const nextPi = new Float64Array(n);
      let maxDiff = 0.0;

      for (let i = 0; i < n; i++) {
        let denominator = 0.0;
        for (let j = 0; j < n; j++) {
          if (i !== j && N[i][j] > 0) {
            denominator += N[i][j] / (pi[i] + pi[j]);
          }
        }
        // MM update rule with Laplace prior regularization (alpha)
        nextPi[i] = (W[i] + alpha) / (denominator + alpha);
      }

      // Normalize by geometric mean to maintain numerical stability
      let logSum = 0.0;
      for (let i = 0; i < n; i++) {
        logSum += Math.log(Math.max(nextPi[i], 1e-12));
      }
      const geomMean = Math.exp(logSum / n);
      for (let i = 0; i < n; i++) {
        nextPi[i] /= geomMean;
      }

      // Check convergence
      for (let i = 0; i < n; i++) {
        const diff = Math.abs(nextPi[i] - pi[i]);
        if (diff > maxDiff) {
          maxDiff = diff;
        }
      }

      pi = nextPi;
      if (maxDiff < tolerance) {
        converged = true;
        break;
      }
    }

    // Standardize scores onto a user-friendly scale (base 100.0, 20 pts per natural log odds)
    const scores: Record<string, number> = {};
    const uncertainties: Record<string, number> = {};

    for (let i = 0; i < n; i++) {
      const id = modelIds[i];
      const logAbility = Math.log(Math.max(pi[i], 1e-12));
      const standardizedScore = Number((100.0 + 20.0 * logAbility).toFixed(2));
      scores[id] = standardizedScore;

      // Standard error / uncertainty estimate
      const battles = totalBattlesPerModel[i];
      const se = Number((1.0 / Math.sqrt(battles + 1)).toFixed(3));
      uncertainties[id] = se;
    }

    return { scores, uncertainties, iterations, converged };
  }

  /**
   * Computes dynamic Elo rating updates for a completed battle.
   */
  static calculateEloUpdates(
    ratingA: number,
    ratingB: number,
    outcome: 'A' | 'B' | 'tie',
    battlesCountA: number,
    battlesCountB: number
  ): { newRatingA: number; newRatingB: number } {
    const expectedA = 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));
    const expectedB = 1.0 - expectedA;

    const actualA = outcome === 'A' ? 1.0 : outcome === 'B' ? 0.0 : 0.5;
    const actualB = outcome === 'B' ? 1.0 : outcome === 'A' ? 0.0 : 0.5;

    // Dynamic K-factor: higher sensitivity during early placement battles
    const kA = battlesCountA < 20 ? 32 : 16;
    const kB = battlesCountB < 20 ? 32 : 16;

    const newRatingA = Math.round(ratingA + kA * (actualA - expectedA));
    const newRatingB = Math.round(ratingB + kB * (actualB - expectedB));

    return { newRatingA, newRatingB };
  }

  /**
   * Assesses statistical confidence based on accumulated battle sample size.
   */
  static assessConfidence(battleCount: number): 'preliminary' | 'emerging' | 'established' {
    if (battleCount < 5) return 'preliminary';
    if (battleCount <= 15) return 'emerging';
    return 'established';
  }
}
