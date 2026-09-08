import type { ModelRecord } from '../db/repositories/modelRepo.js';
import type { GenerationOptions, GenerationResult } from '../types/domain.js';
import { CostCalculator } from './costTracking.js';
import { logger } from '../utils/logger.js';
import { BlindWriteError } from '../utils/errors.js';

export class OpenRouterService {
  private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private apiKey: string) {}

  async generateOutput(
    model: ModelRecord,
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/blindwrite/blindwrite-mcp',
          'X-Title': 'BlindWrite MCP',
        },
        body: JSON.stringify({
          model: model.openrouter_model_id,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new BlindWriteError(
          `OpenRouter API error for model ${model.openrouter_model_id} (${response.status}): ${errorText}`,
          'OPENROUTER_ERROR'
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const outputText = data.choices?.[0]?.message?.content?.trim() ?? '';
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens);

      const estimatedCost = CostCalculator.calculateCost(
        promptTokens,
        completionTokens,
        model.prompt_price_per_m,
        model.completion_price_per_m
      );

      logger.debug(
        `Generated response for model '${model.id}' in ${latencyMs}ms ($${estimatedCost})`
      );

      return {
        modelId: model.id,
        outputText,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        estimatedCost,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      if (err instanceof BlindWriteError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to generate output from model '${model.id}' after ${latencyMs}ms: ${message}`);
      throw new BlindWriteError(`OpenRouter request failed for ${model.id}: ${message}`, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateOutputsParallel(
    models: ModelRecord[],
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<GenerationResult[]> {
    logger.info(`Dispatching parallel generation across ${models.length} models`);

    const promises = models.map(async (model) => {
      try {
        return await this.generateOutput(model, prompt, options);
      } catch (err) {
        logger.warn(`Model ${model.id} failed during parallel benchmark generation: ${String(err)}`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((res): res is GenerationResult => res !== null);
  }
}
