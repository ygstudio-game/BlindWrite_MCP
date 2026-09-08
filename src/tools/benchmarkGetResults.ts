import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkGetResultsSchema } from '../types/mcp.js';

export function registerBenchmarkGetResults(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_get_results',
    'Retrieve benchmark results for a task. When reveal is true, model identities are unmasked.',
    BenchmarkGetResultsSchema.shape,
    async (args) => {
      const results = service.getResults(args.task_id, args.reveal);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );
}
