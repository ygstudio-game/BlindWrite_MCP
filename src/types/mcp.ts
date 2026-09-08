import { z } from 'zod';

export const BenchmarkCreateTaskSchema = z.object({
  title: z.string().min(3).max(120).describe('Title describing the writing task'),
  category: z.string().min(2).describe('Writing category, e.g. Emails, Technical Writing, Marketing'),
  prompt: z.string().min(5).describe('The writing prompt sent identically to competing models'),
  evaluation_criteria: z.string().optional().describe('Optional criteria for judging outputs'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium').describe('Task difficulty'),
  user_id: z.string().optional().default('default_user').describe('User/session ID'),
});

export const BenchmarkListModelsSchema = z.object({
  category: z.string().optional().describe('Optional category filter'),
  enabled_only: z.boolean().optional().default(true).describe('Filter to enabled models only'),
});

export const BenchmarkGenerateOutputsSchema = z.object({
  task_id: z.string().describe('The ID of the benchmark task'),
  model_ids: z.array(z.string()).optional().describe('Optional specific model IDs; defaults to all enabled models'),
  temperature: z.number().min(0).max(2).optional().default(0.7).describe('Sampling temperature for generation'),
});

export const BenchmarkStartDuelSchema = z.object({
  task_id: z.string().describe('The benchmark task ID'),
  output_a_id: z.string().optional().describe('Optional specific anonymous output ID for Response A'),
  output_b_id: z.string().optional().describe('Optional specific anonymous output ID for Response B'),
});

export const BenchmarkSubmitVoteSchema = z.object({
  battle_id: z.string().describe('The battle ID being voted on'),
  choice: z.enum(['A', 'B', 'tie']).describe("The winner ('A', 'B', or 'tie')"),
  reason: z.string().optional().describe('Optional user reasoning explaining the vote'),
  dimension_scores: z
    .record(z.string(), z.number().min(1).max(5))
    .optional()
    .describe('Optional dimension ratings e.g. {"clarity": 5, "tone": 4, "conciseness": 5}'),
});

export const BenchmarkGetResultsSchema = z.object({
  task_id: z.string().describe('The benchmark task ID'),
  reveal: z.boolean().optional().default(false).describe('Set to true to unmask model identities and end the blind stage'),
});

export const BenchmarkGetLeaderboardSchema = z.object({
  scope: z.enum(['personal', 'global']).optional().default('personal').describe('Rankings scope'),
  category: z.string().optional().describe('Filter leaderboard by writing category'),
  metric: z.enum(['bradley_terry', 'elo', 'win_rate']).optional().default('bradley_terry').describe('Ranking algorithm'),
  min_battles: z.number().optional().default(0).describe('Minimum battles required to appear on the leaderboard'),
});

export const BenchmarkCompareModelsSchema = z.object({
  model_a_id: z.string().describe('First model ID to compare'),
  model_b_id: z.string().describe('Second model ID to compare'),
  category: z.string().optional().describe('Optional category filter for head-to-head records'),
});

export const BenchmarkAnalyzePreferencesSchema = z.object({
  category: z.string().optional().describe('Optional writing category to analyze'),
  min_votes: z.number().optional().default(1).describe('Minimum votes threshold'),
});

export const BenchmarkGetModelStatsSchema = z.object({
  model_id: z.string().describe('The model ID to inspect'),
});

export const WriterGenerateSchema = z.object({
  prompt: z.string().min(1).describe('The writing prompt crafted by Claude after thinking/outlining'),
  system_prompt: z.string().optional().describe('Optional system prompt defining voice, tone, or style guidelines'),
  category: z.string().optional().describe('Optional writing category (e.g. "Emails", "Creative Writing", "Technical Writing") used to pick the top-ranked model from your personal leaderboard'),
  model_id: z.string().optional().describe('Optional specific OpenRouter model ID (e.g. "deepseek/deepseek-chat", "openai/gpt-4o", "anthropic/claude-3.5-sonnet"). Defaults to your #1 ranked model or DeepSeek V3.'),
  temperature: z.number().min(0).max(2).optional().default(0.7).describe('Sampling temperature'),
  max_tokens: z.number().optional().describe('Optional maximum output tokens'),
});

