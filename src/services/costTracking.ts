export class CostCalculator {
  /**
   * Calculates the estimated cost of an LLM generation based on token counts
   * and pricing per 1 million tokens.
   */
  static calculateCost(
    promptTokens: number,
    completionTokens: number,
    promptPricePerM: number,
    completionPricePerM: number
  ): number {
    const promptCost = (promptTokens / 1_000_000) * promptPricePerM;
    const completionCost = (completionTokens / 1_000_000) * completionPricePerM;
    return Number((promptCost + completionCost).toFixed(6));
  }
}
