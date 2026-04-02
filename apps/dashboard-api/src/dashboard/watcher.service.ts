import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { watch, type FSWatcher } from 'chokidar';
import { join } from 'node:path';
import { resolveProjectRoot } from '../app/resolve-project-root';
import type { FileChangeEvent } from './dashboard.types';

/**
 * WatcherService provides file watching for task-tracking directory.
 * Migrated from dashboard-service/src/watcher/chokidar.watcher.ts.
 * Implements OnModuleInit to begin watching on startup.
 */
@Injectable()
export class WatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatcherService.name);
  private readonly watchers: FSWatcher[] = [];
  private readonly handlers = new Set<(path: string, event: FileChangeEvent) => void>();

  /**
   * Start watching task-tracking directory on module init.
   */
  public onModuleInit(): void {
    const taskTrackingPath = join(resolveProjectRoot(), 'task-tracking');
    this.logger.log(`Starting watcher for: ${taskTrackingPath}`);
    this.watch(taskTrackingPath, (path, event) => {
      this.logger.debug(`File ${event}: ${path}`);
      for (const handler of this.handlers) {
        try {
          handler(path, event);
        } catch (err) {
          this.logger.error(`Handler error for ${path}:`, err);
        }
      }
    });
  }

  /**
   * Close all watchers on module destroy.
   */
  public async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing file watchers');
    await this.close();
  }

  /**
   * Subscribe to file change events.
   * Returns an unsubscribe function.
   */
  public subscribe(handler: (path: string, event: FileChangeEvent) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Watch a directory for file changes.
   */
  public watch(directory: string, onChange: (path: string, event: FileChangeEvent) => void): void {
    const watcher = watch(directory, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    watcher.on('add', (path: string) => onChange(path, 'add'));
    watcher.on('change', (path: string) => onChange(path, 'change'));
    watcher.on('unlink', (path: string) => onChange(path, 'unlink'));

    watcher.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Watcher error: ${message}`);
    });

    this.watchers.push(watcher);
  }

  /**
   * Close all watchers.
   */
  public async close(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.close()));
    this.watchers.length = 0;
    this.handlers.clear();
  }
}
