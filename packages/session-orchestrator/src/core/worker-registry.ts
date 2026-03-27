import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import type { Worker, WorkerStatus, WorkerTokenStats, WorkerCost, WorkerProgress, LauncherMode, Provider } from '../types.js';

const REGISTRY_VERSION = 1;

interface PersistedRegistry {
  version: number;
  entries: [string, Worker][];
}

export class WorkerRegistry {
  private workers = new Map<string, Worker>();
  private readonly persistPath: string;

  constructor(persistPath: string) {
    this.persistPath = persistPath;
    this.hydrateFromDisk();
  }

  private hydrateFromDisk(): void {
    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedRegistry(parsed)) {
        console.error('[WorkerRegistry] registry.json has unexpected shape — starting empty');
        return;
      }
      if (parsed.version !== REGISTRY_VERSION) {
        console.error(`[WorkerRegistry] registry.json version ${parsed.version} != ${REGISTRY_VERSION} — starting empty`);
        return;
      }
      for (const [id, worker] of parsed.entries) {
        this.workers.set(id, { tokens: emptyTokens(), cost: emptyCost(), progress: emptyProgress(), ...(worker as Partial<Worker>) } as Worker);
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.error('[WorkerRegistry] failed to hydrate from disk:', err);
      }
      // ENOENT or parse error — start empty
    }
  }

  private flushToDisk(): void {
    const tmpPath = `${this.persistPath}.tmp`;
    try {
      const payload: PersistedRegistry = {
        version: REGISTRY_VERSION,
        entries: Array.from(this.workers.entries()),
      };
      writeFileSync(tmpPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
      renameSync(tmpPath, this.persistPath);
    } catch (err) {
      console.error('[WorkerRegistry] persist failed:', err);
    }
  }

  register(opts: {
    label: string;
    pid: number;
    session_id: string;
    jsonl_path: string;
    working_directory: string;
    model: string;
    provider?: Provider;
    iterm_session_id: string;
    auto_close: boolean;
    launcher?: LauncherMode;
    log_path?: string;
  }): Worker {
    const worker: Worker = {
      worker_id: randomUUID(),
      label: opts.label,
      pid: opts.pid,
      session_id: opts.session_id,
      jsonl_path: opts.jsonl_path,
      working_directory: opts.working_directory,
      model: opts.model,
      provider: opts.provider ?? 'claude',
      status: 'running',
      started_at: Date.now(),
      tokens: emptyTokens(),
      cost: emptyCost(),
      progress: emptyProgress(),
      iterm_session_id: opts.iterm_session_id,
      auto_close: opts.auto_close,
      launcher: opts.launcher ?? 'iterm',
      log_path: opts.log_path,
    };
    this.workers.set(worker.worker_id, worker);
    this.flushToDisk();
    return worker;
  }

  get(workerId: string): Worker | undefined {
    return this.workers.get(workerId);
  }

  getBySessionId(sessionId: string): Worker | undefined {
    for (const w of this.workers.values()) {
      if (w.session_id === sessionId) return w;
    }
    return undefined;
  }

  list(filter?: 'active' | 'completed' | 'failed' | 'all'): Worker[] {
    const all = Array.from(this.workers.values());
    if (!filter || filter === 'all') return all;
    if (filter === 'active') return all.filter((w) => w.status === 'running');
    return all.filter((w) => w.status === filter);
  }

  updateStatus(workerId: string, status: WorkerStatus): void {
    const w = this.workers.get(workerId);
    if (w) { w.status = status; this.flushToDisk(); }
  }

  updateSession(workerId: string, sessionId: string): void {
    const w = this.workers.get(workerId);
    if (w) { w.session_id = sessionId; this.flushToDisk(); }
  }

  updateJsonlPath(workerId: string, jsonlPath: string): void {
    const w = this.workers.get(workerId);
    if (w) { w.jsonl_path = jsonlPath; this.flushToDisk(); }
  }

  updateTokens(workerId: string, tokens: WorkerTokenStats): void {
    const w = this.workers.get(workerId);
    if (w) { w.tokens = tokens; this.flushToDisk(); }
  }

  updateCost(workerId: string, cost: WorkerCost): void {
    const w = this.workers.get(workerId);
    if (w) { w.cost = cost; this.flushToDisk(); }
  }

  updateProgress(workerId: string, update: Partial<WorkerProgress>): void {
    const w = this.workers.get(workerId);
    if (w) { Object.assign(w.progress, update); this.flushToDisk(); }
  }

  remove(workerId: string): void {
    const deleted = this.workers.delete(workerId);
    if (deleted) this.flushToDisk();
  }
}

function isPersistedRegistry(value: unknown): value is PersistedRegistry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['version'] === 'number' && Array.isArray(v['entries']);
}

function emptyTokens(): WorkerTokenStats {
  return {
    total_input: 0,
    total_output: 0,
    total_cache_creation: 0,
    total_cache_read: 0,
    total_combined: 0,
    context_current_k: 0,
    context_percent: 0,
    compaction_count: 0,
  };
}

function emptyCost(): WorkerCost {
  return { input_usd: 0, output_usd: 0, cache_usd: 0, total_usd: 0 };
}

function emptyProgress(): WorkerProgress {
  return {
    message_count: 0,
    tool_calls: 0,
    files_read: [],
    files_written: [],
    last_action: 'spawned',
    last_action_at: Date.now(),
    elapsed_minutes: 0,
  };
}
