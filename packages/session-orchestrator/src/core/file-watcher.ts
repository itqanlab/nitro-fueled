import { watch } from 'chokidar';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { WatchCondition, WatchEvent } from '../types.js';

const MAX_CONDITIONS_PER_WORKER = 20;
const MAX_EVENT_QUEUE_SIZE = 1_000;

interface WorkerSubscription {
  conditions: WatchCondition[];
  watchers: ReturnType<typeof watch>[];
  satisfied: boolean;
}

/**
 * Watches file-system conditions for registered workers.
 * When any condition for a worker is satisfied, enqueues a WatchEvent.
 * Events are drained (removed) when drainEvents() is called.
 *
 * Security: all watched paths are resolved and asserted to remain within
 * the worker's registered working_directory before any watch is set up.
 */
export class FileWatcher {
  private subscriptions = new Map<string, WorkerSubscription>();
  private eventQueue: WatchEvent[] = [];

  /**
   * Register watch conditions for a worker.
   * Any single condition being satisfied triggers completion.
   *
   * @param workerId   Worker ID from the registry.
   * @param workingDirectory  Absolute path from the worker's registry entry (not caller input).
   * @param conditions Up to MAX_CONDITIONS_PER_WORKER watch conditions.
   * @returns List of absolute paths being watched (for confirmation logging).
   * @throws If any condition.path escapes workingDirectory or conditions exceed the cap.
   */
  subscribe(workerId: string, workingDirectory: string, conditions: WatchCondition[]): string[] {
    if (conditions.length > MAX_CONDITIONS_PER_WORKER) {
      throw new Error(
        `Too many conditions for worker ${workerId}: ${conditions.length} > ${MAX_CONDITIONS_PER_WORKER}`,
      );
    }

    // Validate all paths before setting up any watchers
    const resolvedBase = resolve(workingDirectory) + sep;
    const absolutePaths = conditions.map((condition) => {
      const abs = resolve(workingDirectory, condition.path);
      if (!abs.startsWith(resolvedBase)) {
        throw new Error(
          `Condition path "${condition.path}" for worker ${workerId} escapes working_directory boundary`,
        );
      }
      return abs;
    });

    this.cleanup(workerId);

    const watchers: ReturnType<typeof watch>[] = [];

    const sub: WorkerSubscription = {
      conditions,
      watchers,
      satisfied: false,
    };
    this.subscriptions.set(workerId, sub);

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const absolutePath = absolutePaths[i]!;

      let watcher: ReturnType<typeof watch>;
      try {
        // ignoreInitial: false ensures we fire for files that already exist when the
        // watcher is registered — critical for fast workers that finish before subscribe is called.
        // followSymlinks: false prevents symlink escape outside the working_directory boundary.
        watcher = watch(absolutePath, { persistent: false, ignoreInitial: false, followSymlinks: false });
      } catch (err) {
        process.stderr.write(
          `[file-watcher] failed to watch ${absolutePath} for worker ${workerId}: ${err}\n`,
        );
        continue;
      }
      watchers.push(watcher);

      const onEvent = () => {
        if (sub.satisfied) return;
        // Optimistic lock: mark satisfied synchronously to block concurrent events
        // from also entering evaluateCondition. Reset if the condition is not met.
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

  /**
   * Drain and return all pending completion events.
   * Each call removes the returned events from the queue (idempotent drain).
   */
  drainEvents(): WatchEvent[] {
    return this.eventQueue.splice(0);
  }

  /**
   * Close all watchers (called on MCP server shutdown).
   */
  closeAll(): void {
    for (const id of this.subscriptions.keys()) {
      this.cleanup(id);
    }
  }

  /**
   * Remove all watchers for a worker (called on satisfaction or explicit cleanup).
   */
  private cleanup(workerId: string): void {
    const sub = this.subscriptions.get(workerId);
    if (sub) {
      for (const watcher of sub.watchers) {
        watcher.close().catch(() => {});
      }
      this.subscriptions.delete(workerId);
    }
  }

  private async evaluateCondition(
    workerId: string,
    condition: WatchCondition,
    absolutePath: string,
    sub: WorkerSubscription,
  ): Promise<void> {
    // file_exists: the 'add'/'change' event itself proves existence — no read needed.
    if (condition.type === 'file_exists') {
      this.enqueueAndCleanup(workerId, condition, sub);
      return;
    }

    let content: string;
    try {
      content = await readFile(absolutePath, 'utf-8');
    } catch {
      // File briefly absent (e.g., atomic rename in progress) — retry once after 100ms.
      await new Promise((r) => setTimeout(r, 100));
      try {
        content = await readFile(absolutePath, 'utf-8');
      } catch {
        // File gone — condition not met, release the optimistic lock.
        sub.satisfied = false;
        return;
      }
    }

    const trimmed = content.trim();
    let conditionMet = false;

    if (condition.type === 'file_value') {
      conditionMet = trimmed === condition.value.trim();
    } else if (condition.type === 'file_contains') {
      conditionMet = trimmed.includes(condition.contains);
    }

    if (conditionMet) {
      this.enqueueAndCleanup(workerId, condition, sub);
    } else {
      // Condition not met — release the optimistic lock for the next event.
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
      process.stderr.write(
        `[file-watcher] event queue full (${MAX_EVENT_QUEUE_SIZE}), dropping event for ${workerId}\n`,
      );
    }
    this.cleanup(workerId);
  }
}
