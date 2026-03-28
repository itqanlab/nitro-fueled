import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
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

async function checkLegacyHealthOnPort(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!resp.ok) return false;
    const body = await resp.json() as Record<string, unknown>;
    return body.service === 'nitro-fueled-dashboard' || body.status === 'ok';
  } catch {
    return false;
  }
}

export default class Dashboard extends BaseCommand {
  public static override description = 'Start real-time dashboard with web UI';

  public static override flags = {
    port: Flags.string({ description: 'HTTP/WebSocket port (default: auto-assign)', default: String(DEFAULT_PORT) }),
    service: Flags.boolean({ description: 'Start data service only (headless, no web UI)', default: false }),
    open: Flags.boolean({ description: 'Open browser automatically', default: true, allowNo: true }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Dashboard);
    const cwd = process.cwd();
    const taskTrackingDir = resolve(cwd, 'task-tracking');

    if (!existsSync(taskTrackingDir)) {
      console.error('Error: No task-tracking/ directory found.');
      console.error('Run `npx nitro-fueled init` first, or run from project root.');
      process.exitCode = 1;
      return;
    }

    const requestedPort = parseInt(flags.port, 10);
    if (Number.isNaN(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
      console.error(`Error: Invalid port "${flags.port}". Must be 0-65535 (0 = auto-assign).`);
      process.exitCode = 1;
      return;
    }

    const { portFilePath, lockPath } = dashboardFilePaths(taskTrackingDir);

    // Check if a service is already running
    const existingPort = await checkExistingService(portFilePath);
    if (existingPort !== null) {
      const url = `http://localhost:${existingPort}`;
      console.log(`Dashboard already running at ${url}`);
      if (flags.open && !flags.service) {
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
        if (flags.open && !flags.service) openBrowser(url);
      } else {
        releaseLock(lockPath); // stale lock recovery
        console.error('Error: Dashboard startup timed out (stale startup lock cleared, retry command).');
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
      const webDistPath = flags.service ? undefined : findWebDistPath();

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
      } else if (!flags.service) {
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

      let lockReleased = false;
      const releaseStartupLock = (): void => {
        if (lockReleased) return;
        lockReleased = true;
        releaseLock(lockPath);
      };

      const forwardSignal = (signal: NodeJS.Signals): void => {
        releaseStartupLock();
        if (child.pid !== undefined) {
          try { process.kill(child.pid, signal); } catch { /* already exited */ }
        }
      };

      process.once('SIGINT', () => forwardSignal('SIGINT'));
      process.once('SIGTERM', () => forwardSignal('SIGTERM'));
      process.once('exit', releaseStartupLock);

      // Poll for .dashboard-port to get the actual assigned port, then open browser
      if (flags.open && !flags.service) {
        pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS).then((actualPort) => {
          releaseStartupLock();
          if (actualPort !== null) {
            const url = `http://localhost:${actualPort}`;
            console.log(`Dashboard available at ${url}`);
            openBrowser(url);
          } else if (requestedPort > 0) {
            // Compatibility path for older dashboard-service builds that do not write .dashboard-port.
            checkLegacyHealthOnPort(requestedPort).then((isHealthy) => {
              if (isHealthy) {
                const url = `http://localhost:${requestedPort}`;
                console.log(`Dashboard available at ${url}`);
                openBrowser(url);
              } else {
                console.warn('Warning: Dashboard did not report its port within timeout.');
              }
            }).catch(() => {
              console.warn('Warning: Dashboard did not report its port within timeout.');
            });
          } else {
            console.warn('Warning: Dashboard did not report its port within timeout.');
          }
        }).catch((err: unknown) => {
          releaseStartupLock();
          console.warn(`Warning: Error waiting for dashboard: ${String(err)}`);
        });
      } else {
        // Release lock immediately when not waiting for port
        releaseStartupLock();
      }

      child.on('exit', (code) => {
        releaseStartupLock();
        process.exitCode = code ?? 0;
      });
    } catch (err: unknown) {
      releaseLock(lockPath);
      throw err;
    }
  }
}
