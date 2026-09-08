import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkGetLeaderboardSchema } from '../types/mcp.js';

export function registerBenchmarkGetLeaderboard(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_get_leaderboard',
    'Get personal or global model rankings calculated with Bradley-Terry Maximum Likelihood Estimation and Elo.',
    BenchmarkGetLeaderboardSchema.shape,
    async (args) => {
      const leaderboard = service.getLeaderboard({
        scope: args.scope,
        category: args.category,
        metric: args.metric,
        minBattles: args.min_battles,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                scope: args.scope ?? 'personal',
                category: args.category ?? 'All Categories',
                metric: args.metric ?? 'bradley_terry',
                total_models_ranked: leaderboard.length,
                leaderboard,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
