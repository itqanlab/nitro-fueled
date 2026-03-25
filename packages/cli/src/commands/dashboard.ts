import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn, exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';

interface DashboardOptions {
  port: string;
  service: boolean;
  noBrowser: boolean;
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

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start real-time dashboard with web UI')
    .option('--port <port>', 'HTTP/WebSocket port', '4200')
    .option('--service', 'Start data service only (headless, no web UI)', false)
    .option('--no-browser', 'Do not open browser automatically', false)
    .action((opts: DashboardOptions) => {
      const cwd = process.cwd();
      const taskTrackingDir = resolve(cwd, 'task-tracking');

      if (!existsSync(taskTrackingDir)) {
        console.error('Error: No task-tracking/ directory found.');
        console.error('Run `npx nitro-fueled init` first, or run from project root.');
        process.exitCode = 1;
        return;
      }

      const port = parseInt(opts.port, 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        console.error(`Error: Invalid port "${opts.port}". Must be 1-65535.`);
        process.exitCode = 1;
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
        '--port', String(port),
      ];

      if (existsSync(antiPatternsPath)) {
        args.push('--anti-patterns', antiPatternsPath);
      }

      if (existsSync(reviewLessonsDir)) {
        args.push('--review-lessons', reviewLessonsDir);
      }

      if (webDistPath) {
        args.push('--web-dist', webDistPath);
        console.log(`Starting dashboard with web UI on port ${port}...`);
      } else if (!opts.service) {
        console.warn('Warning: Web UI dist not found. Starting data service only.');
        console.warn('Run `npm run build` in dashboard-web package first.');
      } else {
        console.log(`Starting dashboard data service on port ${port}...`);
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

      // Open browser after a short delay to let the server start
      if (!opts.noBrowser && webDistPath) {
        setTimeout(() => {
          const url = `http://localhost:${port}`;
          console.log(`Opening dashboard at ${url}`);
          openBrowser(url);
        }, 500);
      }

      child.on('exit', (code) => {
        process.exitCode = code ?? 0;
      });
    });
}
