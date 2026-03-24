import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import { detectMcpConfig } from '../utils/mcp-config.js';

interface InitOptions {
  mcpPath: string | undefined;
  skipMcp: boolean;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function mergeJsonFile(filePath: string, mcpEntry: Record<string, unknown>): void {
  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    } catch {
      console.error(`Warning: Could not parse ${filePath}. Creating new file.`);
    }
  }

  const existingServers = (existing['mcpServers'] ?? {}) as Record<string, unknown>;
  const newServers = (mcpEntry['mcpServers'] ?? {}) as Record<string, unknown>;

  existing['mcpServers'] = { ...existingServers, ...newServers };

  const dir = resolve(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
}

async function configureMcp(cwd: string, serverPath: string, location: 'project' | 'global'): Promise<boolean> {
  const resolvedServerPath = resolve(serverPath);
  const entryPoint = resolve(resolvedServerPath, 'dist', 'index.js');

  if (!existsSync(entryPoint)) {
    console.error(`Error: Server entry point not found at ${entryPoint}`);
    console.error('Make sure session-orchestrator is built (npm run build).');
    return false;
  }

  const mcpEntry = {
    mcpServers: {
      'session-orchestrator': {
        type: 'stdio',
        command: 'node',
        args: [entryPoint],
      },
    },
  };

  let targetPath: string;
  if (location === 'project') {
    targetPath = resolve(cwd, '.mcp.json');
  } else {
    targetPath = resolve(homedir(), '.claude.json');
  }

  mergeJsonFile(targetPath, mcpEntry);
  console.log(`MCP session-orchestrator configured in ${targetPath}`);
  return true;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold .claude/ and task-tracking/ into the current project')
    .option('--mcp-path <path>', 'Path to session-orchestrator server')
    .option('--skip-mcp', 'Skip MCP server configuration', false)
    .action(async (opts: InitOptions) => {
      const cwd = process.cwd();

      console.log('nitro-fueled init');
      console.log('=================');
      console.log('');

      // TODO: Full init scaffolding will be implemented in TASK_2026_009.
      // This command currently handles MCP configuration only.

      const mcpConfig = detectMcpConfig(cwd);
      if (mcpConfig.found) {
        console.log(`MCP session-orchestrator: already configured (${mcpConfig.location}, ${mcpConfig.configPath})`);
        return;
      }

      if (opts.skipMcp) {
        console.log('Skipping MCP configuration (--skip-mcp).');
        return;
      }

      console.log('MCP session-orchestrator is not configured.');
      console.log('The Supervisor requires this to spawn and manage worker sessions.');
      console.log('');

      let serverPath = opts.mcpPath;
      if (serverPath === undefined) {
        serverPath = await prompt('Path to session-orchestrator directory (or press Enter to skip): ');
        if (serverPath === '') {
          console.log('Skipping MCP configuration. Run init again or configure manually.');
          return;
        }
      }

      const locationAnswer = await prompt('Configure globally or per-project? (global/project) [project]: ');
      const location: 'project' | 'global' = locationAnswer === 'global' ? 'global' : 'project';

      const success = await configureMcp(cwd, serverPath, location);
      if (success) {
        console.log('');
        console.log('Restart Claude Code to pick up the new MCP configuration.');
      } else {
        process.exitCode = 1;
      }
    });
}
