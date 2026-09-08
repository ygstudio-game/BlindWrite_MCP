import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkListModelsSchema } from '../types/mcp.js';

export function registerBenchmarkListModels(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_list_models',
    'List all AI writing models available in the benchmark registry with pricing information.',
    BenchmarkListModelsSchema.shape,
    async (args) => {
      const models = service.listModels(args.enabled_only);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              models.map((m) => ({
                id: m.id,
                openrouter_model_id: m.openrouter_model_id,
                display_name: m.display_name,
                provider: m.provider,
                enabled: Boolean(m.enabled),
                prompt_price_per_m_usd: m.prompt_price_per_m,
                completion_price_per_m_usd: m.completion_price_per_m,
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
