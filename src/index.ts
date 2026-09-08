#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { initDatabase } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import { createMcpServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    logger.setLevel(config.logLevel);

    logger.info('Starting BlindWrite MCP server...');

    const db = initDatabase(config.dbPath);
    runMigrations(db);

    const { server } = createMcpServer(db, config.openRouterApiKey);
    const transport = new StdioServerTransport();

    await server.connect(transport);
    logger.info('BlindWrite MCP server successfully connected via StdioServerTransport');

    const handleShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        db.close();
      } catch (err) {
        logger.error(`Error closing SQLite connection: ${String(err)}`);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (err: unknown) {
    logger.error(`Fatal error starting BlindWrite MCP server: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
