import { watch } from 'chokidar';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type Database from 'better-sqlite3';
import type { ToolResult } from '../tools/types.js';

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

export interface WatchEvent {
  worker_id: string;
  /** H5: session_id stored on each event so drainEvents can filter by it. */
  session_id: string;
  event_label: string;
  triggered_at: string;
  condition: WatchCondition;
}

/** Synthetic event pushed when the queue overflows so callers can detect dropped events. */
interface QueueOverflowEvent {
  type: 'queue_overflow';
  worker_id: string;
  session_id: string;
  dropped_count: number;
  triggered_at: string;
}

type QueueEntry = WatchEvent | QueueOverflowEvent;

interface WorkerSubscription {
  conditions: WatchCondition[];
  watchers: ReturnType<typeof watch>[];
  satisfied: boolean;
  /** H5: session_id of the worker that created this subscription. */
  session_id: string;
}

export class FileWatcher {
  private subscriptions = new Map<string, WorkerSubscription>();
  private eventQueue: QueueEntry[] = [];

  subscribe(workerId: string, sessionId: string, workingDirectory: string, conditions: WatchCondition[]): string[] {
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
    const sub: WorkerSubscription = { conditions, watchers, satisfied: false, session_id: sessionId };
    this.subscriptions.set(workerId, sub);

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const absolutePath = absolutePaths[i]!;

      // L3: file_exists should fire immediately on existing files (ignoreInitial: false).
      // file_value and file_contains should NOT fire on existing content until a change
      // occurs (ignoreInitial: true) — avoids spurious events at subscription time.
      const ignoreInitial = condition.type !== 'file_exists';

      let watcher: ReturnType<typeof watch>;
      try {
        watcher = watch(absolutePath, { persistent: false, ignoreInitial, followSymlinks: false });
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

  /** H5: Accept optional session_id to filter events. Only returns events for that session. */
  drainEvents(sessionId?: string): QueueEntry[] {
    if (sessionId) {
      const matching: QueueEntry[] = [];
      const remaining: QueueEntry[] = [];
      for (const event of this.eventQueue) {
        if (event.session_id === sessionId) {
          matching.push(event);
        } else {
          remaining.push(event);
        }
      }
      this.eventQueue = remaining;
      return matching;
    }
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
      this.enqueueAndCleanup(workerId, sub.session_id, condition, sub);
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
      this.enqueueAndCleanup(workerId, sub.session_id, condition, sub);
    } else {
      sub.satisfied = false;
    }
  }

  private enqueueAndCleanup(workerId: string, sessionId: string, condition: WatchCondition, sub: WorkerSubscription): void {
    if (this.eventQueue.length < MAX_EVENT_QUEUE_SIZE) {
      // H5: store session_id on the event for session-scoped draining.
      this.eventQueue.push({
        worker_id: workerId,
        session_id: sessionId,
        event_label: condition.event_label,
        triggered_at: new Date().toISOString(),
        condition,
      });
    } else {
      // L4: Replace the oldest event with a queue_overflow sentinel so callers detect drops.
      process.stderr.write(`[file-watcher] event queue full, dropping oldest event for ${workerId}\n`);
      this.eventQueue.shift();
      this.eventQueue.push({
        type: 'queue_overflow',
        worker_id: workerId,
        session_id: sessionId,
        dropped_count: 1,
        triggered_at: new Date().toISOString(),
      });
    }
    this.cleanup(workerId);
  }
}

export function handleSubscribeWorker(
  db: Database.Database,
  fileWatcher: FileWatcher,
  args: { worker_id: string; conditions: WatchCondition[] },
): ToolResult {
  const worker = db.prepare('SELECT id, session_id, working_directory FROM workers WHERE id = ?').get(args.worker_id) as { id: string; session_id: string; working_directory: string | null } | undefined;

  if (!worker || !worker.working_directory) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({
      subscribed: false, error: `Worker ${args.worker_id} not found or has no working_directory.`, watched_paths: [],
    }) }] };
  }

  try {
    // H5: pass session_id so events are tagged for session-scoped draining.
    const watchedPaths = fileWatcher.subscribe(args.worker_id, worker.session_id, worker.working_directory, args.conditions);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ subscribed: true, watched_paths: watchedPaths }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ subscribed: false, error: String(err), watched_paths: [] }) }] };
  }
}

export function handleGetPendingEvents(fileWatcher: FileWatcher, sessionId?: string): ToolResult {
  // H5: filter by session_id when provided.
  const events = fileWatcher.drainEvents(sessionId);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ events: events.length > 0 ? events : [] }, events.length > 0 ? null : undefined, events.length > 0 ? 2 : undefined) }] };
}
