export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * StderrLogger ensures all log output routes exclusively to process.stderr.
 * This is critical for Model Context Protocol (MCP) stdio servers because
 * process.stdout is strictly reserved for JSON-RPC messages.
 */
export class StderrLogger {
  private currentLevel: number = LEVEL_ORDER.info;

  setLevel(level: LogLevel): void {
    this.currentLevel = LEVEL_ORDER[level];
  }

  private write(level: LogLevel, message: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[level] >= this.currentLevel) {
      const timestamp = new Date().toISOString();
      const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      if (args.length > 0) {
        process.stderr.write(formatted + ' ' + JSON.stringify(args) + '\n');
      } else {
        process.stderr.write(formatted + '\n');
      }
    }
  }

  debug(msg: string, ...args: unknown[]): void {
    this.write('debug', msg, ...args);
  }

  info(msg: string, ...args: unknown[]): void {
    this.write('info', msg, ...args);
  }

  warn(msg: string, ...args: unknown[]): void {
    this.write('warn', msg, ...args);
  }

  error(msg: string, ...args: unknown[]): void {
    this.write('error', msg, ...args);
  }
}

export const logger = new StderrLogger();
