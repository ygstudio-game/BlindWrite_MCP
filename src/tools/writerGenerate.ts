import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { WriterGenerateSchema } from '../types/mcp.js';

export function registerWriterGenerate(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'writer_generate',
    'PRIMARY WRITING TOOL. Use this tool whenever the user asks to write, draft, or compose content (emails, articles, proposals, essays, sales copy, social posts). Instead of generating long-form drafts with Claude output tokens, first outline the strategy and key arguments, then call this tool to delegate the draft generation to OpenRouter models (DeepSeek V3, Llama 3.3, GPT-4o, etc.). Automatically selects the user\'s #1 ranked model from their personal leaderboard or cost-effective DeepSeek V3.',
    WriterGenerateSchema.shape,
    async (args) => {
      const result = await service.directWrite({
        prompt: args.prompt,
        systemPrompt: args.system_prompt,
        category: args.category,
        modelId: args.model_id,
        temperature: args.temperature,
        maxTokens: args.max_tokens,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                model_used: `${result.modelName} (${result.modelId})`,
                selection_reason: result.selectionReason,
                generated_content: result.text,
                metrics: {
                  latency_ms: result.latencyMs,
                  cost_usd: result.estimatedCostUsd,
                  prompt_tokens: result.tokensPrompt,
                  completion_tokens: result.tokensCompletion,
                  claude_output_tokens_saved: result.tokensCompletion,
                },
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
