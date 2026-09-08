import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkAnalyzePreferencesSchema } from '../types/mcp.js';

export function registerBenchmarkAnalyzePreferences(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_analyze_preferences',
    'Analyze empirical user preference patterns (conciseness, structure, tone) from battle voting history.',
    BenchmarkAnalyzePreferencesSchema.shape,
    async (args) => {
      const report = service.analyzePreferences(args.category);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    }
  );
}
