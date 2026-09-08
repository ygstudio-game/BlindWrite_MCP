import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkGenerateOutputsSchema } from '../types/mcp.js';

export function registerBenchmarkGenerateOutputs(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_generate_outputs',
    'Generate writing outputs for a benchmark task across competing models via OpenRouter. Models remain strictly anonymous.',
    BenchmarkGenerateOutputsSchema.shape,
    async (args) => {
      const summary = await service.generateOutputs(args.task_id, args.model_ids, args.temperature);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }
  );
}
