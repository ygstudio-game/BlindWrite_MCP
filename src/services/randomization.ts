import crypto from 'crypto';

export class RandomizationService {
  /**
   * Generates a secure, cryptographically random anonymous ID.
   * Example: "anon_8f3a1b02"
   */
  static generateAnonymousId(): string {
    const bytes = crypto.randomBytes(4).toString('hex');
    return `anon_${bytes}`;
  }

  /**
   * Shuffles two items with an exact 50/50 cryptographic coin toss.
   * Prevents positional bias where the first-generated model always appears as Response A.
   */
  static shufflePair<T>(first: T, second: T): { itemA: T; itemB: T; isFlipped: boolean } {
    const isFlipped = crypto.randomInt(0, 2) === 1;
    return isFlipped
      ? { itemA: second, itemB: first, isFlipped: true }
      : { itemA: first, itemB: second, isFlipped: false };
  }

  /**
   * Finds a pair of outputs for a task that has not yet faced each other in battle.
   * If all combinations have been battled, falls back to a random pair.
   */
  static findUnbattledPair<T extends { id: string }>(
    outputs: T[],
    existingBattles: Array<{ output_a_id: string; output_b_id: string }>
  ): [T, T] | null {
    if (outputs.length < 2) {
      return null;
    }

    const battledPairs = new Set<string>();
    for (const b of existingBattles) {
      const key1 = `${b.output_a_id}:${b.output_b_id}`;
      const key2 = `${b.output_b_id}:${b.output_a_id}`;
      battledPairs.add(key1);
      battledPairs.add(key2);
    }

    const unbattledPairs: [T, T][] = [];

    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const key = `${outputs[i].id}:${outputs[j].id}`;
        if (!battledPairs.has(key)) {
          unbattledPairs.push([outputs[i], outputs[j]]);
        }
      }
    }

    if (unbattledPairs.length > 0) {
      const randomIndex = crypto.randomInt(0, unbattledPairs.length);
      return unbattledPairs[randomIndex];
    }

    // All pairs have been evaluated; pick a random pair for additional sample collection
    const idxA = crypto.randomInt(0, outputs.length);
    let idxB = crypto.randomInt(0, outputs.length);
    while (idxB === idxA) {
      idxB = crypto.randomInt(0, outputs.length);
    }

    return [outputs[idxA], outputs[idxB]];
  }
}
