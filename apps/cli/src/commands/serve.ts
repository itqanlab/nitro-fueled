import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { logger } from '../utils/logger.js';
import {
  STARTUP_TIMEOUT_MS,
  dashboardFilePaths,
  findEntryScript,
  openBrowser,
  pollForPortFile,
} from '../utils/dashboard-helpers.js';

const SERVE_DEFAULT_PORT = 3001;

export default class Serve extends BaseCommand {
  public static override description = 'Start the dashboard API server as a persistent foreground process';

  public static override flags = {
    port: Flags.integer({
      description: `HTTP port to listen on (default: ${SERVE_DEFAULT_PORT})`,
      default: SERVE_DEFAULT_PORT,
    }),
    open: Flags.boolean({
      description: 'Open browser to the API docs after startup',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Serve);
    const cwd = process.cwd();
    const taskTrackingDir = resolve(cwd, 'task-tracking');

    if (!existsSync(taskTrackingDir)) {
      logger.error('Error: No task-tracking/ directory found.');
      logger.error('Run `npx nitro-fueled init` first, or run from your project root.');
      process.exitCode = 1;
      return;
    }

    if (flags.port < 0 || flags.port > 65535) {
      logger.error(`Error: Invalid port ${flags.port}. Must be 0-65535.`);
      process.exitCode = 1;
      return;
    }

    const entryScript = findEntryScript();
    if (entryScript === null) {
      logger.error('Error: Dashboard API service not found.');
      logger.error('Install @nitro-fueled/dashboard-service, or build apps/dashboard-api first.');
      process.exitCode = 1;
      return;
    }

    const args = [
      entryScript,
      '--task-tracking-dir', taskTrackingDir,
      '--port', String(flags.port),
    ];

    const antiPatternsPath = resolve(cwd, '.claude/anti-patterns.md');
    if (existsSync(antiPatternsPath)) {
      args.push('--anti-patterns', antiPatternsPath);
    }

    const reviewLessonsDir = resolve(cwd, '.claude/review-lessons');
    if (existsSync(reviewLessonsDir)) {
      args.push('--review-lessons', reviewLessonsDir);
    }

    logger.log('');
    logger.log('DASHBOARD API SERVER');
    logger.log('--------------------');
    logger.log(`Port:     ${flags.port}`);
    logger.log(`Watching: ${taskTrackingDir}`);
    logger.log('');

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

    if (flags.open) {
      const { portFilePath } = dashboardFilePaths(taskTrackingDir);
      pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS).then((actualPort) => {
        const port = actualPort ?? flags.port;
        const url = `http://localhost:${port}/api/docs`;
        logger.log(`Opening: ${url}`);
        openBrowser(url);
      }).catch(() => {
        // Non-fatal — browser open is best-effort
      });
    }

    child.on('exit', (code) => {
      process.exitCode = code ?? 0;
    });
  }
}
