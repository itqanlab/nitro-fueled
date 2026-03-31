import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';
import { buildMcpConfigEntry } from './mcp-setup-guide.js';

export function expandTilde(inputPath: string): string {
  if (inputPath.startsWith('~/') || inputPath === '~') {
    return resolve(homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function mergeJsonFile(filePath: string, mcpEntry: Record<string, unknown>): boolean {
  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    } catch {
      logger.error(`Error: Could not parse ${filePath} as JSON.`);
      logger.error('Please fix or remove the file manually, then re-run init.');
      return false;
    }
  }

  const existingServers = (existing['mcpServers'] ?? {}) as Record<string, unknown>;
  const newServers = (mcpEntry['mcpServers'] ?? {}) as Record<string, unknown>;
  existing['mcpServers'] = { ...existingServers, ...newServers };

  const dir = resolve(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  try {
    writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Error: Could not write ${filePath}: ${msg}`);
    return false;
  }
  return true;
}

async function configureMcpServer(
  cwd: string,
  serverPath: string,
  location: 'project' | 'global',
  serverName: string,
  entryBuilder: (realPath: string) => Record<string, unknown>
): Promise<boolean> {
  const expandedPath = expandTilde(serverPath);
  const resolvedServerPath = resolve(expandedPath);

  if (!existsSync(resolvedServerPath)) {
    logger.error(`Error: Directory not found: ${resolvedServerPath}`);
    return false;
  }

  let realPath: string;
  try {
    realPath = realpathSync(resolvedServerPath);
  } catch {
    logger.error(`Error: Could not resolve path: ${resolvedServerPath}`);
    return false;
  }

  const entryPoint = resolve(realPath, 'dist', 'index.js');
  if (!existsSync(entryPoint)) {
    logger.error(`Error: ${serverName} entry point not found at ${entryPoint}`);
    logger.error(`Make sure ${serverName} is built (npm run build).`);
    return false;
  }

  const mcpEntry = entryBuilder(realPath);

  if (location === 'project') {
    logger.warn('Note: Project-level config uses an absolute path that may not be portable across machines.');
  }

  const targetPath = location === 'project'
    ? resolve(cwd, '.mcp.json')
    : resolve(homedir(), '.claude.json');

  const success = mergeJsonFile(targetPath, mcpEntry);
  if (success) {
    logger.log(`  MCP ${serverName} configured in ${targetPath}`);
  }
  return success;
}

export async function configureMcp(
  cwd: string,
  serverPath: string,
  location: 'project' | 'global'
): Promise<boolean> {
  return configureMcpServer(cwd, serverPath, location, 'nitro-cortex', buildMcpConfigEntry);
}
