import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkStartDuelSchema } from '../types/mcp.js';

export function registerBenchmarkStartDuel(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_start_duel',
    'Start a randomized, blind A/B battle between two outputs for evaluation. Model identities remain masked.',
    BenchmarkStartDuelSchema.shape,
    async (args) => {
      const duel = service.startDuel(args.task_id, args.output_a_id, args.output_b_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                battle_id: duel.battleId,
                task_id: duel.taskId,
                prompt: duel.prompt,
                evaluation_criteria: duel.evaluationCriteria,
                response_a: {
                  id: duel.responseA.id,
                  text: duel.responseA.text,
                },
                response_b: {
                  id: duel.responseB.id,
                  text: duel.responseB.text,
                },
                voting_instructions: duel.votingInstructions,
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
