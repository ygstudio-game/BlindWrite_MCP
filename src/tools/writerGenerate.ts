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
            text: result.text,
          },
        ],
      };
    }
  );
}
