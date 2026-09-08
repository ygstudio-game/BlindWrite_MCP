import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { BenchmarkService } from './services/benchmark.js';
import { registerBenchmarkCreateTask } from './tools/benchmarkCreateTask.js';
import { registerBenchmarkListModels } from './tools/benchmarkListModels.js';
import { registerBenchmarkGenerateOutputs } from './tools/benchmarkGenerateOutputs.js';
import { registerBenchmarkStartDuel } from './tools/benchmarkStartDuel.js';
import { registerBenchmarkSubmitVote } from './tools/benchmarkSubmitVote.js';
import { registerBenchmarkGetResults } from './tools/benchmarkGetResults.js';
import { registerBenchmarkGetLeaderboard } from './tools/benchmarkGetLeaderboard.js';
import { registerBenchmarkCompareModels } from './tools/benchmarkCompareModels.js';
import { registerBenchmarkAnalyzePreferences } from './tools/benchmarkAnalyzePreferences.js';
import { registerBenchmarkGetModelStats } from './tools/benchmarkGetModelStats.js';
import { logger } from './utils/logger.js';

export function createMcpServer(
  db: Database.Database,
  openRouterApiKey: string
): {
  server: McpServer;
  benchmarkService: BenchmarkService;
} {
  const server = new McpServer({
    name: 'BlindWrite MCP',
    version: '1.0.0',
  });

  const benchmarkService = new BenchmarkService(db, openRouterApiKey);

  // Register all 10 MCP tools
  registerBenchmarkCreateTask(server, benchmarkService);
  registerBenchmarkListModels(server, benchmarkService);
  registerBenchmarkGenerateOutputs(server, benchmarkService);
  registerBenchmarkStartDuel(server, benchmarkService);
  registerBenchmarkSubmitVote(server, benchmarkService);
  registerBenchmarkGetResults(server, benchmarkService);
  registerBenchmarkGetLeaderboard(server, benchmarkService);
  registerBenchmarkCompareModels(server, benchmarkService);
  registerBenchmarkAnalyzePreferences(server, benchmarkService);
  registerBenchmarkGetModelStats(server, benchmarkService);

  logger.info('Registered 10 BlindWrite MCP tools on McpServer');

  return { server, benchmarkService };
}
