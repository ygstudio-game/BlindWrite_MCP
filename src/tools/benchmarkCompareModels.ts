import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkCompareModelsSchema } from '../types/mcp.js';

export function registerBenchmarkCompareModels(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_compare_models',
    'Compare two AI models head-to-head using accumulated pairwise benchmark battle history.',
    BenchmarkCompareModelsSchema.shape,
    async (args) => {
      const comparison = service.compareModels(args.model_a_id, args.model_b_id, args.category);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(comparison, null, 2),
          },
        ],
      };
    }
  );
}
