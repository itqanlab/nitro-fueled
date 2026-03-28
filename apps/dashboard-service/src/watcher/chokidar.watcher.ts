import { watch, type FSWatcher } from 'chokidar';
import type { FileWatcher, FileChangeEvent } from './watcher.interface.js';

export class ChokidarWatcher implements FileWatcher {
  private readonly watchers: FSWatcher[] = [];

  public watch(directory: string, onChange: (path: string, event: FileChangeEvent) => void): void {
    const watcher = watch(directory, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: false,
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
      console.error('[watcher] Error:', message);
    });

    this.watchers.push(watcher);
  }

  public async close(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.close()));
    this.watchers.length = 0;
  }
}
