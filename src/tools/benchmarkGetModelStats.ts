import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkGetModelStatsSchema } from '../types/mcp.js';

export function registerBenchmarkGetModelStats(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_get_model_stats',
    'Get comprehensive performance metrics, win rates, and ranking score for a specific model.',
    BenchmarkGetModelStatsSchema.shape,
    async (args) => {
      const stats = service.getModelStats(args.model_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }
  );
}
