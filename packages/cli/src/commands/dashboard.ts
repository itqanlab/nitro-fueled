import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';

interface DashboardOptions {
  port: string;
  service: boolean;
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

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start the real-time dashboard data service')
    .option('--port <port>', 'HTTP/WebSocket port', '4200')
    .option('--service', 'Start data service only (headless, no web UI)', false)
    .action((opts: DashboardOptions) => {
      const cwd = process.cwd();
      const taskTrackingDir = resolve(cwd, 'task-tracking');

      if (!existsSync(taskTrackingDir)) {
        console.error('Error: No task-tracking/ directory found.');
        console.error('Run `npx nitro-fueled init` first, or run from the project root.');
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
        console.error('Error: Dashboard service not found. Build the dashboard-service package first.');
        console.error(`Expected at: ${entryScript}`);
        process.exitCode = 1;
        return;
      }

      const antiPatternsPath = resolve(cwd, '.claude/anti-patterns.md');
      const reviewLessonsDir = resolve(cwd, '.claude/review-lessons');

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

      console.log(`Starting dashboard service on port ${port}...`);
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

      child.on('exit', (code) => {
        process.exitCode = code ?? 0;
      });
    });
}
