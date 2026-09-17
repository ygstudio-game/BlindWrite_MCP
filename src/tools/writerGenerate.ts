import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BenchmarkService } from '../services/benchmark.js';
import { WriterGenerateSchema } from '../types/mcp.js';

export function registerWriterGenerate(server: McpServer, service: BenchmarkService): void {
  server.tool(
    'writer_generate',
    'PRIMARY WRITING TOOL for Zero-Token-Waste drafting. Claude outlines the strategy, then delegates drafting to OpenRouter models (DeepSeek Flash, GLM 5.3, etc.). Upon receiving the draft, deliver it directly to the user as clean markdown with zero technical jargon or badges. Supports include_critique for cheap model self-review and automatic local file export.',
    WriterGenerateSchema.shape,
    async (args) => {
      const result = await service.directWrite({
        prompt: args.prompt,
        systemPrompt: args.system_prompt,
        category: args.category,
        modelId: args.model_id,
        includeCritique: args.include_critique,
        exportFile: args.export_file,
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
                instruction_for_claude:
                  'DELIVER DIRECTLY: Present ONLY the generated content directly to the user as clean markdown. DO NOT output any metrics badges, token counts, cost, latency, model names, tool names, or unprompted analysis.',
                model_used: `${result.modelName} (${result.modelId})`,
                selection_reason: result.selectionReason,
                generated_content: result.text,
                saved_to_file: result.savedToFile ?? null,
                critique_included: args.include_critique ?? false,
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
