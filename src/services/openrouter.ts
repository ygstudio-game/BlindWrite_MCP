import type { ModelRecord } from '../db/repositories/modelRepo.js';
import type { GenerationOptions, GenerationResult } from '../types/domain.js';
import { CostCalculator } from './costTracking.js';
import { logger } from '../utils/logger.js';
import { BlindWriteError } from '../utils/errors.js';

/**
 * Maximum number of times generateOutput will retry on transient errors
 * (network issues, 429 rate-limits, 5xx server errors).
 * Hard failures (401, 402, 400) are never retried — no point retrying a bad key.
 */
const API_MAX_RETRIES = 2;

/**
 * Base delay in ms for exponential backoff.
 * Attempt 1 retry: 1 s, attempt 2 retry: 2 s.
 */
const API_RETRY_BASE_MS = 1000;

/**
 * HTTP status codes that are transient and safe to retry.
 * 429 = rate limit, 5xx = server errors.
 * 400/401/402/403 are hard failures — they will not resolve on retry.
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenRouterService {
  private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private apiKey: string) {}

  async generateOutput(
    model: ModelRecord,
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    const timeoutMs =
      options.timeoutMs ?? Math.max(180_000, (options.maxTokens ?? 2000) * 60);

    const startTime = Date.now();
    let lastError: BlindWriteError | null = null;

    for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoffMs = API_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        logger.warn(
          `OpenRouter: retrying model '${model.id}' ` +
          `(attempt ${attempt + 1}/${API_MAX_RETRIES + 1}) ` +
          `after ${backoffMs}ms — ${lastError?.message ?? 'unknown error'}`
        );
        await sleep(backoffMs);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ygstudio-game/BlindWrite_MCP',
            'X-Title': 'BlindWrite MCP',
          },
          body: JSON.stringify({
            model: model.openrouter_model_id,
            messages: [
              ...(options.systemPrompt
                ? [{ role: 'system', content: options.systemPrompt }]
                : []),
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

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          const err = new BlindWriteError(
            `OpenRouter API error for model ${model.openrouter_model_id} (HTTP ${response.status}): ${errorText}`,
            'OPENROUTER_ERROR'
          );

          // Do NOT retry hard auth/validation failures — they won't resolve on retry.
          if (!RETRYABLE_STATUS_CODES.has(response.status)) {
            logger.error(
              `OpenRouter: non-retryable error (HTTP ${response.status}) for model '${model.id}' — failing immediately`
            );
            throw err;
          }

          // Transient error — record and loop for retry.
          lastError = err;
          continue;
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
          `Generated response for model '${model.id}' in ${latencyMs}ms ` +
          `(${completionTokens} completion tokens, $${estimatedCost.toFixed(6)})`
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
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        // If it's already a BlindWriteError with a non-retryable cause, re-throw immediately.
        if (err instanceof BlindWriteError) {
          throw err;
        }

        // Network / timeout / abort errors are treated as transient.
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          `OpenRouter: network/timeout error for model '${model.id}' after ${latencyMs}ms: ${message}`
        );
        lastError = new BlindWriteError(
          `OpenRouter request failed for ${model.id}: ${message}`,
          'NETWORK_ERROR'
        );
        // Loop continues for retry.
      }
    }

    // All retries exhausted — throw clearly. Never fall back to a different model.
    const totalMs = Date.now() - startTime;
    logger.error(
      `OpenRouter: all ${API_MAX_RETRIES + 1} attempts exhausted for model '${model.id}' ` +
      `after ${totalMs}ms. Last error: ${lastError?.message ?? 'unknown'}`
    );
    throw (
      lastError ??
      new BlindWriteError(
        `OpenRouter request failed for model '${model.id}' after ${API_MAX_RETRIES + 1} attempts`,
        'NETWORK_ERROR'
      )
    );
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
