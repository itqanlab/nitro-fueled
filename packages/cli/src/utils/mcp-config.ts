import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

type McpServerType = 'stdio' | 'http';

interface McpServerEntry {
  type?: McpServerType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

interface McpServersMap {
  [name: string]: McpServerEntry;
}

export type McpConfigLocation = 'global' | 'project';

export interface McpConfigResult {
  found: boolean;
  location: McpConfigLocation | null;
  configPath: string | null;
  entry: McpServerEntry | null;
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractMcpEntry(data: Record<string, unknown>): McpServerEntry | null {
  const servers = data['mcpServers'] as McpServersMap | undefined;
  if (servers === undefined || servers === null) {
    return null;
  }
  const entry = servers['session-orchestrator'];
  if (entry === undefined || entry === null) {
    return null;
  }
  return entry;
}

export function detectMcpConfig(cwd: string): McpConfigResult {
  const notFound: McpConfigResult = {
    found: false,
    location: null,
    configPath: null,
    entry: null,
  };

  // Check project-level first: .mcp.json in project root
  const projectMcpPath = resolve(cwd, '.mcp.json');
  const projectData = readJsonSafe(projectMcpPath);
  if (projectData !== null) {
    const entry = extractMcpEntry(projectData);
    if (entry !== null) {
      return { found: true, location: 'project', configPath: projectMcpPath, entry };
    }
  }

  // Check project-level: .claude/settings.json
  const projectSettingsPath = resolve(cwd, '.claude', 'settings.json');
  const projectSettings = readJsonSafe(projectSettingsPath);
  if (projectSettings !== null) {
    const entry = extractMcpEntry(projectSettings);
    if (entry !== null) {
      return { found: true, location: 'project', configPath: projectSettingsPath, entry };
    }
  }

  // Check global: ~/.claude.json
  const globalPath = resolve(homedir(), '.claude.json');
  const globalData = readJsonSafe(globalPath);
  if (globalData !== null) {
    const entry = extractMcpEntry(globalData);
    if (entry !== null) {
      return { found: true, location: 'global', configPath: globalPath, entry };
    }
  }

  // Check global: ~/.claude/settings.json
  const globalSettingsPath = resolve(homedir(), '.claude', 'settings.json');
  const globalSettings = readJsonSafe(globalSettingsPath);
  if (globalSettings !== null) {
    const entry = extractMcpEntry(globalSettings);
    if (entry !== null) {
      return { found: true, location: 'global', configPath: globalSettingsPath, entry };
    }
  }

  return notFound;
}
