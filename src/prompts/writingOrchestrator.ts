import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerWritingOrchestratorPrompt(server: McpServer): void {
  server.prompt(
    'writing-orchestrator',
    'Orchestrate token-saving AI writing: Claude outlines the strategy, OpenRouter models draft the content via writer_generate with zero token waste.',
    {
      topic: z.string().describe('The writing topic, goals, and key points to cover'),
      category: z.string().optional().describe('Writing category: blog_post, cold_email, technical_doc, marketing_copy, essay, etc.'),
      include_critique: z.string().optional().describe('Set to "true" to have the cheap model include a 3-bullet self-critique without burning Claude tokens'),
    },
    async ({ topic, category, include_critique }) => {
      const categoryStr = category ? `\nCategory: ${category}` : '';
      const critiqueNote =
        include_critique === 'true'
          ? '\nSelf-Critique Requested: Pass include_critique: true to writer_generate to have the model generate a cheap 3-bullet evaluation block.'
          : '';
      return {
        description: 'Claude Thinking + OpenRouter Drafting Orchestration Prompt (Zero-Token-Tax)',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to write a high-impact piece with the following requirements:${categoryStr}${critiqueNote}

Topic & Goals:
${topic}

Please follow the Zero-Token-Waste Writing Orchestrator protocol:
1. Thinking & Strategy (Claude): In 2-3 brief bullets, clarify target audience, tone, and angle.
2. Token-Saving Delegation: Call 'writer_generate' with your crafted prompt, category, and options.
3. Zero-Tax Direct Delivery: Present the returned draft directly to the user with the token/cost metrics badge. Strictly DO NOT burn output tokens writing an unprompted critique or rewriting the draft unless I explicitly ask for a review.`,
            },
          },
        ],
      };
    }
  );
}
