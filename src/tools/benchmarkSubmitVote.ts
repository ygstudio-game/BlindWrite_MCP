import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkSubmitVoteSchema } from '../types/mcp.js';

export function registerBenchmarkSubmitVote(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_submit_vote',
    "Submit a blind user preference vote ('A', 'B', or 'tie') with optional reasoning and dimension ratings.",
    BenchmarkSubmitVoteSchema.shape,
    async (args) => {
      const result = service.submitVote({
        battleId: args.battle_id,
        choice: args.choice,
        reason: args.reason,
        dimensionScores: args.dimension_scores,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                vote_id: result.voteId,
                battle_id: result.battleId,
                status: result.status,
                unbattled_pairs_remaining: result.unbattledPairsRemaining,
                message:
                  result.unbattledPairsRemaining > 0
                    ? `Vote recorded successfully! There are ${result.unbattledPairsRemaining} unbattled pair(s) remaining for this task.`
                    : 'Vote recorded successfully! All pairs for this task have been evaluated. You can now request final results with reveal: true.',
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
