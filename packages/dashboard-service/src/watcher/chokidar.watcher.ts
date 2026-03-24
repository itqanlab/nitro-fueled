import { watch, type FSWatcher } from 'chokidar';
import type { FileWatcher, FileChangeEvent } from './watcher.interface.js';

export class ChokidarWatcher implements FileWatcher {
  private watcher: FSWatcher | null = null;

  public watch(directory: string, onChange: (path: string, event: FileChangeEvent) => void): void {
    this.watcher = watch(directory, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    this.watcher.on('add', (path: string) => onChange(path, 'add'));
    this.watcher.on('change', (path: string) => onChange(path, 'change'));
    this.watcher.on('unlink', (path: string) => onChange(path, 'unlink'));

    this.watcher.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[watcher] Error:', message);
    });
  }

  public async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
