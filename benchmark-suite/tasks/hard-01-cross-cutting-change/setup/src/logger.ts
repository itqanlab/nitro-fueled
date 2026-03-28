// Naive logger -- just wraps console methods
// This should be replaced with a structured logger

export const log = console.log;
export const warn = console.warn;
export const error = console.error;

export function createLogger(serviceName: string) {
  return {
    log: (...args: unknown[]) => console.log(`[${serviceName}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${serviceName}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${serviceName}]`, ...args),
  };
}
