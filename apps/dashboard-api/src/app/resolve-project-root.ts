import { existsSync } from 'node:fs';
import { join, dirname, parse } from 'node:path';

let cachedRoot: string | undefined;

/**
 * Find the nitro-fueled project root by walking up from cwd.
 * Looks for `.nitro/` or `task-tracking/` directory as marker.
 * Handles the case where the server runs from a subdirectory (e.g. apps/dashboard-api).
 * Override with NITRO_PROJECT_ROOT env var.
 */
export function resolveProjectRoot(): string {
  if (cachedRoot) return cachedRoot;

  if (process.env['NITRO_PROJECT_ROOT']) {
    cachedRoot = process.env['NITRO_PROJECT_ROOT'];
    return cachedRoot;
  }

  let dir = process.cwd();
  const { root } = parse(dir);
  while (dir !== root) {
    if (
      existsSync(join(dir, '.nitro')) ||
      existsSync(join(dir, 'task-tracking'))
    ) {
      cachedRoot = dir;
      return dir;
    }
    dir = dirname(dir);
  }

  cachedRoot = process.cwd();
  return cachedRoot;
}

/**
 * Resolve the cortex DB path.
 * Priority: NITRO_CORTEX_DB env var > project root search > cwd fallback.
 */
export function resolveCortexDbPath(): string {
  if (process.env['NITRO_CORTEX_DB']) {
    return process.env['NITRO_CORTEX_DB'];
  }
  return join(resolveProjectRoot(), '.nitro', 'cortex.db');
}
