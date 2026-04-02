/**
 * CLI structured logger.
 * Info/log writes to stdout; warn/error writes to stderr.
 * Debug output enabled when DEBUG env var is set.
 */

export const logger = {
  log: (...args: unknown[]): void => {
    console.log(...args);
  },
  info: (...args: unknown[]): void => {
    console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
  debug: (...args: unknown[]): void => {
    if (process.env['DEBUG']) {
      console.error('[DEBUG]', ...args);
    }
  },
};
