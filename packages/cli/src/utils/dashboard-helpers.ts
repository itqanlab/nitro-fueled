import { existsSync, readFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PORT_FILE_NAME = '.dashboard-port';
export const LOCK_FILE_NAME = '.dashboard-start.lock';
export const DEFAULT_PORT = 0; // 0 = OS auto-assigns a free port
export const STARTUP_TIMEOUT_MS = 8000;
export const POLL_INTERVAL_MS = 100;

export function findEntryScript(): string | null {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-service/dist/cli-entry.js'),
    resolve(thisDir, '../../../dashboard-service/dist/cli-entry.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function findWebDistPath(): string | undefined {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Monorepo sibling (preferred during local development to avoid stale embedded assets)
    resolve(thisDir, '../../../dashboard-web/dist'),
    // Embedded in published CLI package (copied during build)
    resolve(thisDir, '../../dashboard-assets'),
    // Installed as a peer npm package
    resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-web/dist'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function openBrowser(url: string): void {
  const [cmd, ...args] = process.platform === 'darwin'
    ? ['open', url]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', url]
      : ['xdg-open', url];
  execFile(cmd, args, () => {});
}

export async function pollForPortFile(portFilePath: string, timeoutMs: number): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(portFilePath)) {
      const raw = readFileSync(portFilePath, 'utf-8').trim();
      const port = parseInt(raw, 10);
      if (!Number.isNaN(port) && port > 0) return port;
    }
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

/** Returns the port if a healthy nitro-fueled dashboard service is already running. */
export async function checkExistingService(portFilePath: string): Promise<number | null> {
  if (!existsSync(portFilePath)) return null;

  const clearStalePortFile = (): void => {
    try { unlinkSync(portFilePath); } catch { /* ignore */ }
  };

  const raw = readFileSync(portFilePath, 'utf-8').trim();
  const port = parseInt(raw, 10);
  if (Number.isNaN(port) || port <= 0) {
    clearStalePortFile();
    return null;
  }

  try {
    const resp = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!resp.ok) {
      clearStalePortFile();
      return null;
    }
    const body = await resp.json() as Record<string, unknown>;
    // Validate service identity — reject any other HTTP server on that port
    if (body.service !== 'nitro-fueled-dashboard') {
      clearStalePortFile();
      return null;
    }
    return port;
  } catch {
    // stale port file — service not running, will be overwritten on next start
    clearStalePortFile();
  }
  return null;
}

/**
 * Try to acquire an exclusive startup lock to prevent TOCTOU races when
 * multiple CLI processes start simultaneously.
 * Returns true if the lock was acquired, false if another process holds it.
 */
export function tryAcquireLock(lockPath: string): boolean {
  try {
    const fd = openSync(lockPath, 'wx'); // O_WRONLY | O_CREAT | O_EXCL
    closeSync(fd);
    return true;
  } catch {
    return false; // EEXIST — another process is already starting
  }
}

export function releaseLock(lockPath: string): void {
  try { unlinkSync(lockPath); } catch { /* ignore */ }
}

/** Resolve paths relative to task-tracking dir for port and lock files. */
export function dashboardFilePaths(taskTrackingDir: string): { portFilePath: string; lockPath: string } {
  return {
    portFilePath: join(taskTrackingDir, PORT_FILE_NAME),
    lockPath: join(taskTrackingDir, LOCK_FILE_NAME),
  };
}
