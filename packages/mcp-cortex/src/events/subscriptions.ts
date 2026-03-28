import { watch } from 'chokidar';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type Database from 'better-sqlite3';

type ToolResult = { content: Array<{ type: 'text'; text: string }> };

const MAX_CONDITIONS_PER_WORKER = 20;
const MAX_EVENT_QUEUE_SIZE = 1_000;

interface FileValueCondition {
  type: 'file_value';
  path: string;
  value: string;
  event_label: string;
}

interface FileContainsCondition {
  type: 'file_contains';
  path: string;
  contains: string;
  event_label: string;
}

interface FileExistsCondition {
  type: 'file_exists';
  path: string;
  event_label: string;
}

type WatchCondition = FileValueCondition | FileContainsCondition | FileExistsCondition;

interface WatchEvent {
  worker_id: string;
  event_label: string;
  triggered_at: string;
  condition: WatchCondition;
}

interface WorkerSubscription {
  conditions: WatchCondition[];
  watchers: ReturnType<typeof watch>[];
  satisfied: boolean;
}

export class FileWatcher {
  private subscriptions = new Map<string, WorkerSubscription>();
  private eventQueue: WatchEvent[] = [];

  subscribe(workerId: string, workingDirectory: string, conditions: WatchCondition[]): string[] {
    if (conditions.length > MAX_CONDITIONS_PER_WORKER) {
      throw new Error(`Too many conditions: ${conditions.length} > ${MAX_CONDITIONS_PER_WORKER}`);
    }

    const resolvedBase = resolve(workingDirectory) + sep;
    const absolutePaths = conditions.map((c) => {
      const abs = resolve(workingDirectory, c.path);
      if (!abs.startsWith(resolvedBase)) {
        throw new Error(`Path "${c.path}" escapes working_directory boundary`);
      }
      return abs;
    });

    this.cleanup(workerId);

    const watchers: ReturnType<typeof watch>[] = [];
    const sub: WorkerSubscription = { conditions, watchers, satisfied: false };
    this.subscriptions.set(workerId, sub);

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const absolutePath = absolutePaths[i]!;

      let watcher: ReturnType<typeof watch>;
      try {
        watcher = watch(absolutePath, { persistent: false, ignoreInitial: false, followSymlinks: false });
      } catch (err) {
        process.stderr.write(`[file-watcher] failed to watch ${absolutePath}: ${err}\n`);
        continue;
      }
      watchers.push(watcher);

      const onEvent = () => {
        if (sub.satisfied) return;
        sub.satisfied = true;
        this.evaluateCondition(workerId, condition, absolutePath, sub).catch((err) => {
          process.stderr.write(`[file-watcher] error evaluating condition for ${workerId}: ${err}\n`);
        });
      };

      watcher.on('add', onEvent);
      watcher.on('change', onEvent);
    }

    return absolutePaths;
  }

  drainEvents(): WatchEvent[] {
    return this.eventQueue.splice(0);
  }

  closeAll(): void {
    for (const id of [...this.subscriptions.keys()]) {
      this.cleanup(id);
    }
  }

  private cleanup(workerId: string): void {
    const sub = this.subscriptions.get(workerId);
    if (sub) {
      for (const w of sub.watchers) { w.close().catch(() => {}); }
      this.subscriptions.delete(workerId);
    }
  }

  private async evaluateCondition(
    workerId: string, condition: WatchCondition, absolutePath: string, sub: WorkerSubscription,
  ): Promise<void> {
    if (condition.type === 'file_exists') {
      this.enqueueAndCleanup(workerId, condition, sub);
      return;
    }

    let content: string;
    try {
      content = await readFile(absolutePath, 'utf-8');
    } catch {
      await new Promise((r) => setTimeout(r, 100));
      try {
        content = await readFile(absolutePath, 'utf-8');
      } catch {
        sub.satisfied = false;
        return;
      }
    }

    const trimmed = content.trim();
    let met = false;
    if (condition.type === 'file_value') {
      met = trimmed === condition.value.trim();
    } else if (condition.type === 'file_contains') {
      met = trimmed.includes(condition.contains);
    }

    if (met) {
      this.enqueueAndCleanup(workerId, condition, sub);
    } else {
      sub.satisfied = false;
    }
  }

  private enqueueAndCleanup(workerId: string, condition: WatchCondition, sub: WorkerSubscription): void {
    if (this.eventQueue.length < MAX_EVENT_QUEUE_SIZE) {
      this.eventQueue.push({
        worker_id: workerId,
        event_label: condition.event_label,
        triggered_at: new Date().toISOString(),
        condition,
      });
    } else {
      process.stderr.write(`[file-watcher] event queue full, dropping event for ${workerId}\n`);
    }
    this.cleanup(workerId);
  }
}

export function handleSubscribeWorker(
  db: Database.Database,
  fileWatcher: FileWatcher,
  args: { worker_id: string; conditions: WatchCondition[] },
): ToolResult {
  const worker = db.prepare('SELECT id, working_directory FROM workers WHERE id = ?').get(args.worker_id) as { id: string; working_directory: string | null } | undefined;

  if (!worker || !worker.working_directory) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({
      subscribed: false, error: `Worker ${args.worker_id} not found or has no working_directory.`, watched_paths: [],
    }) }] };
  }

  try {
    const watchedPaths = fileWatcher.subscribe(args.worker_id, worker.working_directory, args.conditions);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ subscribed: true, watched_paths: watchedPaths }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ subscribed: false, error: String(err), watched_paths: [] }) }] };
  }
}

export function handleGetPendingEvents(fileWatcher: FileWatcher): ToolResult {
  const events = fileWatcher.drainEvents();
  return { content: [{ type: 'text' as const, text: JSON.stringify({ events: events.length > 0 ? events : [] }, events.length > 0 ? null : undefined, events.length > 0 ? 2 : undefined) }] };
}
