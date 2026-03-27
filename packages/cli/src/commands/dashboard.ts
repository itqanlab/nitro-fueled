import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawn, exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';

const PORT_FILE_NAME = '.dashboard-port';
const DEFAULT_PORT = 0; // 0 = OS auto-assigns a free port
const STARTUP_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 100;

interface DashboardOptions {
  port: string;
  service: boolean;
  open: boolean; // false when --no-open is passed
}

function findEntryScript(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-service/dist/cli-entry.js'),
    resolve(thisDir, '../../../dashboard-service/dist/cli-entry.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[1];
}

function findWebDistPath(): string | undefined {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-web/dist'),
    resolve(thisDir, '../../../dashboard-web/dist'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return undefined;
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${command} ${url}`, () => {});
}

async function pollForPortFile(portFilePath: string, timeoutMs: number): Promise<number | null> {
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

async function checkExistingService(portFilePath: string): Promise<number | null> {
  if (!existsSync(portFilePath)) return null;

  const raw = readFileSync(portFilePath, 'utf-8').trim();
  const port = parseInt(raw, 10);
  if (Number.isNaN(port) || port <= 0) return null;

  try {
    const resp = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (resp.ok) return port;
  } catch {
    // stale port file — service not running, will be overwritten on next start
  }
  return null;
}

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start real-time dashboard with web UI')
    .option('--port <port>', 'HTTP/WebSocket port (default: auto-assign)', String(DEFAULT_PORT))
    .option('--service', 'Start data service only (headless, no web UI)', false)
    .option('--no-open', 'Do not open browser automatically')
    .action(async (opts: DashboardOptions) => {
      const cwd = process.cwd();
      const taskTrackingDir = resolve(cwd, 'task-tracking');

      if (!existsSync(taskTrackingDir)) {
        console.error('Error: No task-tracking/ directory found.');
        console.error('Run `npx nitro-fueled init` first, or run from project root.');
        process.exitCode = 1;
        return;
      }

      const requestedPort = parseInt(opts.port, 10);
      if (Number.isNaN(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
        console.error(`Error: Invalid port "${opts.port}". Must be 0-65535 (0 = auto-assign).`);
        process.exitCode = 1;
        return;
      }

      const portFilePath = join(taskTrackingDir, PORT_FILE_NAME);

      // Check if a service is already running
      const existingPort = await checkExistingService(portFilePath);
      if (existingPort !== null) {
        const url = `http://localhost:${existingPort}`;
        console.log(`Dashboard already running at ${url}`);
        if (opts.open && !opts.service) {
          openBrowser(url);
        }
        return;
      }

      const entryScript = findEntryScript();
      if (!existsSync(entryScript)) {
        console.error('Error: Dashboard service not found. Build dashboard-service package first.');
        console.error(`Expected at: ${entryScript}`);
        process.exitCode = 1;
        return;
      }

      const antiPatternsPath = resolve(cwd, '.claude/anti-patterns.md');
      const reviewLessonsDir = resolve(cwd, '.claude/review-lessons');
      const webDistPath = opts.service ? undefined : findWebDistPath();

      const args = [
        entryScript,
        '--task-tracking-dir', taskTrackingDir,
        '--port', String(requestedPort),
      ];

      if (existsSync(antiPatternsPath)) {
        args.push('--anti-patterns', antiPatternsPath);
      }

      if (existsSync(reviewLessonsDir)) {
        args.push('--review-lessons', reviewLessonsDir);
      }

      if (webDistPath) {
        args.push('--web-dist', webDistPath);
        console.log('Starting dashboard with web UI...');
      } else if (!opts.service) {
        console.warn('Warning: Web UI dist not found. Starting data service only.');
        console.warn('Run `npm run build` in dashboard-web package first.');
      } else {
        console.log('Starting dashboard data service...');
      }

      console.log(`Watching: ${taskTrackingDir}`);

      const child = spawn(process.execPath, args, {
        stdio: 'inherit',
        cwd,
      });

      const forwardSignal = (signal: NodeJS.Signals): void => {
        if (child.pid !== undefined) {
          process.kill(child.pid, signal);
        }
      };

      process.on('SIGINT', () => forwardSignal('SIGINT'));
      process.on('SIGTERM', () => forwardSignal('SIGTERM'));

      // Poll for .dashboard-port to get the actual assigned port, then open browser
      if (opts.open && !opts.service) {
        pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS).then((actualPort) => {
          if (actualPort !== null) {
            const url = `http://localhost:${actualPort}`;
            console.log(`Dashboard available at ${url}`);
            openBrowser(url);
          } else {
            console.warn('Warning: Dashboard did not report its port within timeout.');
          }
        }).catch(() => {});
      }

      child.on('exit', (code) => {
        process.exitCode = code ?? 0;
      });
    });
}
