import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { BenchmarkCreateTaskSchema } from '../types/mcp.js';

export function registerBenchmarkCreateTask(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'benchmark_create_task',
    'Create a new blind AI writing benchmark task with a category, prompt, and optional evaluation criteria.',
    BenchmarkCreateTaskSchema.shape,
    async (args) => {
      const task = service.createTask({
        title: args.title,
        category: args.category,
        prompt: args.prompt,
        evaluationCriteria: args.evaluation_criteria,
        difficulty: args.difficulty,
        userId: args.user_id,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                task_id: task.id,
                title: task.title,
                category: task.category,
                prompt: task.prompt,
                evaluation_criteria: task.evaluation_criteria,
                status: task.status,
                created_at: task.created_at,
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
