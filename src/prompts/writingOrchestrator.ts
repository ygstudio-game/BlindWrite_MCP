import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerWritingOrchestratorPrompt(server: McpServer): void {
  server.prompt(
    'writing-orchestrator',
    'Orchestrate token-saving AI writing: Claude outlines the strategy, OpenRouter models draft the content via writer_generate.',
    {
      topic: z.string().describe('The writing topic, goals, and key points to cover'),
      category: z.string().optional().describe('Writing category: blog_post, cold_email, technical_doc, marketing_copy, essay, etc.'),
    },
    async ({ topic, category }) => {
      const categoryStr = category ? `\nCategory: ${category}` : '';
      return {
        description: 'Claude Thinking + OpenRouter Drafting Orchestration Prompt',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to write a high-impact piece with the following requirements:${categoryStr}

Topic & Goals:
${topic}

Please follow the Writing Orchestrator protocol:
1. Thinking & Strategy: Analyze the audience, define the core angle/hook, and produce a concise structural outline.
2. Token-Saving Delegation: DO NOT write the entire draft yourself. Instead, call the 'writer_generate' tool with detailed section prompts, style guidelines, and the desired category.
3. Review & Polishing: Present the draft returned by the model, report the tokens and latency saved, and offer strategic revisions.`,
            },
          },
        ],
      };
    }
  );
}
