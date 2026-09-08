import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  DB_PATH: z.string().default('./data/blindwrite.sqlite'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = {
  openRouterApiKey: string;
  dbPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = ConfigSchema.parse(env);
  return {
    openRouterApiKey: parsed.OPENROUTER_API_KEY,
    dbPath: parsed.DB_PATH,
    logLevel: parsed.LOG_LEVEL,
  };
}
