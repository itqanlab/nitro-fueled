import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import {
  DEFAULT_PORT,
  STARTUP_TIMEOUT_MS,
  checkExistingService,
  dashboardFilePaths,
  findEntryScript,
  findWebDistPath,
  openBrowser,
  pollForPortFile,
  releaseLock,
  tryAcquireLock,
} from '../utils/dashboard-helpers.js';

interface DashboardOptions {
  port: string;
  service: boolean;
  open: boolean; // false when --no-open is passed
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

      const { portFilePath, lockPath } = dashboardFilePaths(taskTrackingDir);

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

      // Acquire exclusive startup lock to prevent TOCTOU races
      if (!tryAcquireLock(lockPath)) {
        // Another process won the race — wait for it to finish starting
        console.log('Another dashboard instance is starting, waiting...');
        const port = await pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS);
        if (port !== null) {
          const url = `http://localhost:${port}`;
          console.log(`Dashboard available at ${url}`);
          if (opts.open && !opts.service) openBrowser(url);
        } else {
          console.error('Error: Dashboard startup timed out.');
          process.exitCode = 1;
        }
        return;
      }

      try {
        const entryScript = findEntryScript();
        if (entryScript === null) {
          console.error('Error: Dashboard service not found. Build dashboard-service package first.');
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
          console.warn('Run `npm run build:dashboard` first to embed web assets.');
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
            try { process.kill(child.pid, signal); } catch { /* already exited */ }
          }
        };

        process.once('SIGINT', () => forwardSignal('SIGINT'));
        process.once('SIGTERM', () => forwardSignal('SIGTERM'));

        // Poll for .dashboard-port to get the actual assigned port, then open browser
        if (opts.open && !opts.service) {
          pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS).then((actualPort) => {
            releaseLock(lockPath);
            if (actualPort !== null) {
              const url = `http://localhost:${actualPort}`;
              console.log(`Dashboard available at ${url}`);
              openBrowser(url);
            } else {
              console.warn('Warning: Dashboard did not report its port within timeout.');
            }
          }).catch((err: unknown) => {
            releaseLock(lockPath);
            console.warn(`Warning: Error waiting for dashboard: ${String(err)}`);
          });
        } else {
          // Release lock immediately when not waiting for port
          releaseLock(lockPath);
        }

        child.on('exit', (code) => {
          process.exitCode = code ?? 0;
        });
      } catch (err: unknown) {
        releaseLock(lockPath);
        throw err;
      }
    });
}
