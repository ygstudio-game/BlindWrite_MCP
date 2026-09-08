import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { logger } from '../../src/utils/logger.js';

describe('Configuration & Stderr Logger', () => {
  it('loads valid configuration from environment', () => {
    const config = loadConfig({
      OPENROUTER_API_KEY: 'test-key-12345',
      DB_PATH: ':memory:',
      LOG_LEVEL: 'debug',
    });
    expect(config.openRouterApiKey).toBe('test-key-12345');
    expect(config.dbPath).toBe(':memory:');
    expect(config.logLevel).toBe('debug');
  });

  it('fails when OPENROUTER_API_KEY is missing', () => {
    expect(() => loadConfig({ DB_PATH: ':memory:' })).toThrow();
  });

  it('logs only to stderr and never touches stdout', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.info('Test info message for stderr');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});
