import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import { detectMcpConfig } from '../utils/mcp-config.js';
import { buildMcpConfigEntry } from '../utils/mcp-setup-guide.js';

interface InitOptions {
  mcpPath: string | undefined;
  skipMcp: boolean;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolvePrompt) => {
    rl.question(question, (answer) => {
      rl.close();
      resolvePrompt(answer.trim());
    });
  });
}

function expandTilde(inputPath: string): string {
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
      console.error(`Warning: Could not parse ${filePath}. Existing file will be backed up.`);
      try {
        writeFileSync(filePath + '.bak', readFileSync(filePath, 'utf-8'), 'utf-8');
        console.error(`Backup saved to ${filePath}.bak`);
      } catch {
        console.error(`Error: Could not create backup of ${filePath}. Aborting.`);
        return false;
      }
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
    writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: Could not write ${filePath}: ${msg}`);
    return false;
  }
  return true;
}

async function configureMcp(cwd: string, serverPath: string, location: 'project' | 'global'): Promise<boolean> {
  const expandedPath = expandTilde(serverPath);
  const resolvedServerPath = resolve(expandedPath);

  // Validate path exists and resolve symlinks to detect traversal
  if (!existsSync(resolvedServerPath)) {
    console.error(`Error: Directory not found: ${resolvedServerPath}`);
    return false;
  }

  let realPath: string;
  try {
    realPath = realpathSync(resolvedServerPath);
  } catch {
    console.error(`Error: Could not resolve path: ${resolvedServerPath}`);
    return false;
  }

  const entryPoint = resolve(realPath, 'dist', 'index.js');

  if (!existsSync(entryPoint)) {
    console.error(`Error: Server entry point not found at ${entryPoint}`);
    console.error('Make sure session-orchestrator is built (npm run build).');
    return false;
  }

  const mcpEntry = buildMcpConfigEntry(realPath);

  if (location === 'project') {
    console.warn('Note: Project-level config uses an absolute path that may not be portable across machines.');
  }

  let targetPath: string;
  if (location === 'project') {
    targetPath = resolve(cwd, '.mcp.json');
  } else {
    targetPath = resolve(homedir(), '.claude.json');
  }

  const success = mergeJsonFile(targetPath, mcpEntry);
  if (!success) {
    return false;
  }
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

      // TODO: Full init scaffolding (copy agents, skills, task-tracking) will be implemented in TASK_2026_009.
      // This command currently handles MCP configuration only.

      const mcpConfig = detectMcpConfig(cwd);
      if (mcpConfig.found) {
        console.log(`MCP session-orchestrator: already configured (${mcpConfig.location}, ${mcpConfig.configPath})`);
        // Do not return early — future scaffolding steps should still run.
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
