import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterService } from '../../src/services/openrouter.js';
import { CostCalculator } from '../../src/services/costTracking.js';

describe('OpenRouter Gateway & Cost Tracking', () => {
  it('calculates cost accurately based on token pricing', () => {
    // $3.00 per 1M prompt tokens, $15.00 per 1M completion tokens
    // 1,000 prompt tokens = $0.003
    // 500 completion tokens = $0.0075
    // Total = $0.0105
    const cost = CostCalculator.calculateCost(1000, 500, 3.0, 15.0);
    expect(cost).toBeCloseTo(0.0105, 5);
  });

  it('handles zero tokens and zero pricing without error', () => {
    const cost = CostCalculator.calculateCost(0, 0, 0, 0);
    expect(cost).toBe(0.0);
  });

  it('sends prompt to OpenRouter and measures latency and token usage', async () => {
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'This is a professional cold outreach email.' } }],
        usage: { prompt_tokens: 35, completion_tokens: 60, total_tokens: 95 },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const service = new OpenRouterService('mock-api-key');
    const result = await service.generateOutput(
      {
        id: 'claude-3-5-sonnet',
        openrouter_model_id: 'anthropic/claude-3.5-sonnet',
        display_name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        enabled: 1,
        prompt_price_per_m: 3.0,
        completion_price_per_m: 15.0,
        created_at: new Date().toISOString(),
      },
      'Write a cold outreach email to a potential client.',
      { temperature: 0.7 }
    );

    expect(result.outputText).toBe('This is a professional cold outreach email.');
    expect(result.promptTokens).toBe(35);
    expect(result.completionTokens).toBe(60);
    expect(result.totalTokens).toBe(95);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.estimatedCost).toBeGreaterThan(0);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-api-key',
          'Content-Type': 'application/json',
        }),
      })
    );

    global.fetch = originalFetch;
  });

  it('dispatches parallel requests across multiple models', async () => {
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockImplementation((url, options) => {
      const body = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `Response from ${body.model}` } }],
          usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
        }),
      });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const service = new OpenRouterService('mock-api-key');
    const models = [
      {
        id: 'model-a',
        openrouter_model_id: 'provider/model-a',
        display_name: 'Model A',
        provider: 'Provider',
        enabled: 1,
        prompt_price_per_m: 1.0,
        completion_price_per_m: 2.0,
        created_at: '',
      },
      {
        id: 'model-b',
        openrouter_model_id: 'provider/model-b',
        display_name: 'Model B',
        provider: 'Provider',
        enabled: 1,
        prompt_price_per_m: 1.5,
        completion_price_per_m: 3.0,
        created_at: '',
      },
    ];

    const results = await service.generateOutputsParallel(models, 'Compare these two approaches.');
    expect(results.length).toBe(2);
    expect(results[0].outputText).toContain('provider/model-a');
    expect(results[1].outputText).toContain('provider/model-b');

    global.fetch = originalFetch;
  });
});
