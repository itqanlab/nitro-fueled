import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface McpServerEntry {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly args: string[];
  readonly env: Record<string, string>;
  readonly status: 'active' | 'inactive';
  readonly source: 'user' | 'project';
}

export interface McpInstallRequest {
  readonly name: string;
  readonly package?: string;
  readonly path?: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
}

export interface McpToolAccessMatrix {
  readonly servers: string[];
  readonly agents: Array<{ agent: string; access: Record<string, boolean> }>;
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig>;
}

const KNOWN_AGENTS = [
  'nitro-planner',
  'nitro-project-manager',
  'nitro-software-architect',
  'nitro-backend-developer',
  'nitro-frontend-developer',
  'nitro-team-leader',
  'nitro-senior-tester',
];

/** Validates a server name: alphanumeric, hyphens, underscores, dots — no path traversal. */
export function isValidServerName(name: string): boolean {
  return /^[a-zA-Z0-9_.\-]{1,64}$/.test(name);
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly userConfigPath: string;

  public constructor() {
    this.userConfigPath = join(homedir(), '.claude', 'mcp_config.json');
  }

  private readConfig(path: string): McpConfigFile {
    if (!existsSync(path)) return { mcpServers: {} };
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as McpConfigFile;
    } catch (err) {
      this.logger.warn(`Failed to parse MCP config at ${path}`, err);
      return { mcpServers: {} };
    }
  }

  private writeUserConfig(config: McpConfigFile): void {
    writeFileSync(this.userConfigPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  /** List servers from user config and optionally the project-level .mcp.json. */
  public listServers(projectRoot?: string): McpServerEntry[] {
    const servers: McpServerEntry[] = [];
    const seen = new Set<string>();

    const userConfig = this.readConfig(this.userConfigPath);
    for (const [name, cfg] of Object.entries(userConfig.mcpServers ?? {})) {
      servers.push({
        id: name, name, command: cfg.command,
        args: cfg.args ?? [], env: cfg.env ?? {},
        status: 'active', source: 'user',
      });
      seen.add(name);
    }

    if (projectRoot) {
      const projectConfig = this.readConfig(join(projectRoot, '.mcp.json'));
      for (const [name, cfg] of Object.entries(projectConfig.mcpServers ?? {})) {
        if (!seen.has(name)) {
          servers.push({
            id: name, name, command: cfg.command,
            args: cfg.args ?? [], env: cfg.env ?? {},
            status: 'active', source: 'project',
          });
        }
      }
    }

    return servers;
  }

  /** Install a new server by adding it to the user MCP config. */
  public installServer(req: McpInstallRequest): McpServerEntry {
    const config = this.readConfig(this.userConfigPath);
    if (!config.mcpServers) config.mcpServers = {};

    let command: string;
    let args: string[];

    if (req.package) {
      command = 'npx';
      args = ['-y', req.package, ...(req.args ?? [])];
    } else {
      // req.path is validated before calling this method
      command = 'node';
      args = [req.path!, ...(req.args ?? [])];
    }

    const entry: McpServerConfig = { command, args };
    if (req.env && Object.keys(req.env).length > 0) {
      entry.env = req.env;
    }

    config.mcpServers[req.name] = entry;
    this.writeUserConfig(config);

    return {
      id: req.name, name: req.name, command, args,
      env: req.env ?? {}, status: 'active', source: 'user',
    };
  }

  /**
   * Remove a server from the user MCP config.
   * Returns false when the server does not exist in user config (project-level servers are read-only).
   */
  public removeServer(id: string): boolean {
    const config = this.readConfig(this.userConfigPath);
    if (!config.mcpServers || !(id in config.mcpServers)) return false;
    delete config.mcpServers[id];
    this.writeUserConfig(config);
    return true;
  }

  /** Return a tool-access matrix for all configured servers × known agents. */
  public getToolAccess(projectRoot?: string): McpToolAccessMatrix {
    const servers = this.listServers(projectRoot).map((s) => s.id);
    const agents = KNOWN_AGENTS.map((agent) => ({
      agent,
      access: Object.fromEntries(servers.map((name) => [name, true])),
    }));
    return { servers, agents };
  }
}
