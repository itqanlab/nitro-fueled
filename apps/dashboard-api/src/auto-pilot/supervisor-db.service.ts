/**
 * SupervisorDbService — writable access to the cortex SQLite database.
 *
 * Handles session lifecycle, task claiming, worker records, and event logging.
 * Opens the DB in read-write mode (WAL journal handles concurrent access with
 * the cortex MCP server that workers use).
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveCortexDbPath } from '../app/resolve-project-root';
import Database from 'better-sqlite3';
import type {
  LoopStatus,
  WorkerType,
  ProviderType,
  LauncherMode,
  HealthStatus,
  TaskCandidate,
  ActiveWorkerInfo,
  CustomFlow,
  CustomFlowStep,
} from './auto-pilot.types';

// ============================================================
// DB row types
// ============================================================

interface WorkerRow {
  id: string;
  session_id: string;
  task_id: string | null;
  worker_type: WorkerType;
  label: string;
  status: string;
  pid: number | null;
  model: string | null;
  provider: string | null;
  spawn_time: string;
  compaction_count: number;
  tokens_json: string;
  cost_json: string;
  progress_json: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  complexity: string;
  dependencies: string | null;
  model: string | null;
  description: string;
  custom_flow_id: string | null;
}

interface CustomFlowRow {
  id: string;
  name: string;
  description: string | null;
  steps: string;
}

// ============================================================
// Token/cost types (mirrors cortex schema.ts)
// ============================================================

interface WorkerTokenStats {
  total_input: number;
  total_output: number;
  total_cache_creation: number;
  total_cache_read: number;
  total_combined: number;
  context_current_k: number;
  context_percent: number;
  compaction_count: number;
}

interface WorkerCost {
  input_usd: number;
  output_usd: number;
  cache_usd: number;
  total_usd: number;
}

interface WorkerProgress {
  message_count: number;
  tool_calls: number;
  files_read: string[];
  files_written: string[];
  last_action: string;
  last_action_at: number;
  elapsed_minutes: number;
}

const EMPTY_TOKENS: WorkerTokenStats = {
  total_input: 0, total_output: 0,
  total_cache_creation: 0, total_cache_read: 0,
  total_combined: 0, context_current_k: 0,
  context_percent: 0, compaction_count: 0,
};

const EMPTY_COST: WorkerCost = { input_usd: 0, output_usd: 0, cache_usd: 0, total_usd: 0 };

const EMPTY_PROGRESS: WorkerProgress = {
  message_count: 0, tool_calls: 0,
  files_read: [], files_written: [],
  last_action: 'spawned', last_action_at: Date.now(),
  elapsed_minutes: 0,
};

const STARTUP_GRACE_MS = 300_000;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

@Injectable()
export class SupervisorDbService implements OnModuleDestroy {
  private readonly logger = new Logger(SupervisorDbService.name);
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  public constructor() {
    this.dbPath = resolveCortexDbPath();
  }

  public onModuleDestroy(): void {
    this.close();
  }

  public isAvailable(): boolean {
    return existsSync(this.dbPath);
  }

  // ============================================================
  // Connection management
  // ============================================================

  public getDb(): Database.Database {
    if (this.db) return this.db;
    if (!existsSync(this.dbPath)) {
      mkdirSync(dirname(this.dbPath), { recursive: true, mode: 0o700 });
    }
    this.db = new Database(this.dbPath, { fileMustExist: false });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    return this.db;
  }

  public close(): void {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
    }
  }

  // ============================================================
  // Session management
  // ============================================================

  public createSession(source: string, config: Record<string, unknown>, taskLimit?: number): string {
    const db = this.getDb();
    const id = this.buildSessionId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO sessions (id, source, config, task_limit, last_heartbeat) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, source, JSON.stringify(config), taskLimit ?? null, now);

    // Release orphaned claims from dead sessions
    this.releaseOrphanedClaims();

    return id;
  }

  public updateHeartbeat(sessionId: string): void {
    const db = this.getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE sessions SET last_heartbeat = ?, updated_at = ? WHERE id = ?`,
    ).run(now, now, sessionId);
  }

  public updateSessionStatus(sessionId: string, status: LoopStatus, summary?: string): void {
    const db = this.getDb();
    const now = new Date().toISOString();
    const endedAt = status === 'stopped' ? now : null;
    db.prepare(
      `UPDATE sessions SET loop_status = ?, ended_at = COALESCE(?, ended_at), summary = COALESCE(?, summary), updated_at = ? WHERE id = ?`,
    ).run(status, endedAt, summary ?? null, now, sessionId);
  }

  public updateSessionTerminalCount(sessionId: string, count: number): void {
    const db = this.getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE sessions SET tasks_terminal = ?, updated_at = ? WHERE id = ?`,
    ).run(count, now, sessionId);
  }

  public setDrainRequested(sessionId: string): void {
    const db = this.getDb();
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE sessions SET drain_requested = 1, updated_at = ? WHERE id = ?',
    ).run(now, sessionId);
  }

  public getDrainRequested(sessionId: string): boolean {
    const db = this.getDb();
    const row = db.prepare(
      'SELECT drain_requested FROM sessions WHERE id = ?',
    ).get(sessionId) as { drain_requested: number } | undefined;
    return row?.drain_requested === 1;
  }

  // ============================================================
  // Task operations
  // ============================================================

  public getTaskCandidates(): TaskCandidate[] {
    const db = this.getDb();
    const rows = db.prepare(
      `SELECT id, title, status, type, priority, complexity, dependencies, model, custom_flow_id
       FROM tasks
       WHERE status IN ('CREATED', 'IMPLEMENTED')
       ORDER BY
         CASE priority WHEN 'P0-Critical' THEN 0 WHEN 'P1-High' THEN 1 WHEN 'P2-Medium' THEN 2 ELSE 3 END,
         id`,
    ).all() as TaskRow[];

    const completeTasks = new Set(
      (db.prepare("SELECT id FROM tasks WHERE status = 'COMPLETE' LIMIT 1000").all() as Array<{ id: string }>).map(r => r.id),
    );

    return rows
      .map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        type: row.type,
        priority: row.priority,
        complexity: row.complexity ?? 'Medium',
        dependencies: parseJson<string[]>(row.dependencies, []),
        model: row.model,
        customFlowId: row.custom_flow_id ?? null,
      }))
      .filter(task => {
        // Only return tasks whose dependencies are all COMPLETE
        return task.dependencies.length === 0 || task.dependencies.every(d => completeTasks.has(d));
      });
  }

  public claimTask(taskId: string, sessionId: string): boolean {
    const db = this.getDb();
    const now = new Date().toISOString();
    const info = db.prepare(
      `UPDATE tasks SET session_claimed = ?, claimed_at = ?, status = 'IN_PROGRESS', updated_at = ?
       WHERE id = ? AND (session_claimed IS NULL OR session_claimed = ?)`,
    ).run(sessionId, now, now, taskId, sessionId);
    return info.changes > 0;
  }

  public updateTaskStatus(taskId: string, status: string): void {
    const db = this.getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
    ).run(status, now, taskId);
  }

  public getTaskDescription(taskId: string): string | null {
    const db = this.getDb();
    const row = db.prepare('SELECT description FROM tasks WHERE id = ?').get(taskId) as { description: string } | undefined;
    return row?.description ?? null;
  }

  public getCustomFlow(flowId: string): CustomFlow | null {
    const db = this.getDb();
    const row = db.prepare(
      'SELECT id, name, description, steps FROM custom_flows WHERE id = ?',
    ).get(flowId) as CustomFlowRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      steps: parseJson<CustomFlowStep[]>(row.steps, []),
    };
  }

  public getTaskCountsByStatus(): Record<string, number> {
    const db = this.getDb();
    const rows = db.prepare(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status',
    ).all() as Array<{ status: string; count: number }>;
    return Object.fromEntries(rows.map(r => [r.status, r.count]));
  }

  public releaseOrphanedClaims(): number {
    const db = this.getDb();
    // Find tasks claimed by sessions that are no longer running
    const orphaned = db.prepare(`
      SELECT t.id FROM tasks t
      LEFT JOIN sessions s ON t.session_claimed = s.id
      WHERE t.session_claimed IS NOT NULL
        AND t.status IN ('IN_PROGRESS', 'IN_REVIEW')
        AND (s.id IS NULL OR s.loop_status = 'stopped')
    `).all() as Array<{ id: string }>;

    if (orphaned.length === 0) return 0;

    const now = new Date().toISOString();
    const stmt = db.prepare(
      `UPDATE tasks SET session_claimed = NULL, claimed_at = NULL, status = 'CREATED', updated_at = ? WHERE id = ?`,
    );
    for (const row of orphaned) {
      stmt.run(now, row.id);
    }
    this.logger.log(`Released ${orphaned.length} orphaned task claims`);
    return orphaned.length;
  }

  // ============================================================
  // Worker operations
  // ============================================================

  public insertWorker(opts: {
    workerId: string;
    sessionId: string;
    taskId: string;
    workerType: WorkerType;
    label: string;
    workingDirectory: string;
    model: string;
    provider: ProviderType;
    retryNumber: number;
  }): void {
    const db = this.getDb();
    const launcher = this.getLauncherForProvider(opts.provider);
    db.prepare(`
      INSERT INTO workers (id, session_id, task_id, worker_type, label, status, working_directory, model, provider, launcher, auto_close, retry_number, tokens_json, cost_json, progress_json)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      opts.workerId, opts.sessionId, opts.taskId,
      opts.workerType, opts.label, opts.workingDirectory,
      opts.model, opts.provider, launcher, opts.retryNumber,
      JSON.stringify(EMPTY_TOKENS), JSON.stringify(EMPTY_COST), JSON.stringify(EMPTY_PROGRESS),
    );
  }

  public updateWorkerPid(workerId: string, pid: number, logPath: string): void {
    const db = this.getDb();
    db.prepare('UPDATE workers SET pid = ?, log_path = ? WHERE id = ?').run(pid, logPath, workerId);
  }

  public updateWorkerStatus(workerId: string, status: string): void {
    const db = this.getDb();
    // Don't overwrite 'killed' status
    const current = db.prepare('SELECT status FROM workers WHERE id = ?').get(workerId) as { status: string } | undefined;
    if (current && current.status === 'killed') return;
    db.prepare('UPDATE workers SET status = ? WHERE id = ?').run(status, workerId);
  }

  public markWorkerKilled(workerId: string): void {
    const db = this.getDb();
    db.prepare("UPDATE workers SET status = 'killed' WHERE id = ?").run(workerId);
  }

  public getActiveWorkers(sessionId: string): ActiveWorkerInfo[] {
    const db = this.getDb();
    const rows = db.prepare(
      "SELECT * FROM workers WHERE session_id = ? AND status = 'active' ORDER BY spawn_time",
    ).all(sessionId) as WorkerRow[];

    return rows.map(row => ({
      workerId: row.id,
      taskId: row.task_id ?? '',
      workerType: row.worker_type,
      label: row.label,
      pid: row.pid ?? 0,
      provider: (row.provider ?? 'claude') as ProviderType,
      model: row.model ?? '',
      spawnTime: row.spawn_time,
      health: this.getWorkerHealth(row),
    }));
  }

  public getWorkerCounts(sessionId: string): { active: number; completed: number; failed: number } {
    const db = this.getDb();
    const rows = db.prepare(
      'SELECT status, COUNT(*) as count FROM workers WHERE session_id = ? GROUP BY status',
    ).all(sessionId) as Array<{ status: string; count: number }>;

    const counts = { active: 0, completed: 0, failed: 0 };
    for (const row of rows) {
      if (row.status === 'active') counts.active = row.count;
      else if (row.status === 'completed') counts.completed = row.count;
      else counts.failed += row.count; // failed + killed
    }
    return counts;
  }

  public getWorkerForTask(sessionId: string, taskId: string): { workerId: string; status: string } | null {
    const db = this.getDb();
    const row = db.prepare(
      'SELECT id, status FROM workers WHERE session_id = ? AND task_id = ? ORDER BY spawn_time DESC LIMIT 1',
    ).get(sessionId, taskId) as { id: string; status: string } | undefined;
    return row ? { workerId: row.id, status: row.status } : null;
  }

  // ============================================================
  // Event logging
  // ============================================================

  public logEvent(sessionId: string, taskId: string | null, source: string, eventType: string, data: Record<string, unknown> = {}): void {
    const db = this.getDb();
    db.prepare(
      `INSERT INTO events (session_id, task_id, source, event_type, data) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, taskId, source, eventType, JSON.stringify(data));
  }

  // ============================================================
  // Status file check (reads task status from DB for completion detection)
  // ============================================================

  public getTaskStatus(taskId: string): string | null {
    const db = this.getDb();
    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
    return row?.status ?? null;
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getWorkerHealth(row: WorkerRow): HealthStatus {
    if (!row.pid || !isProcessAlive(row.pid)) return 'finished';
    if (row.compaction_count >= 2) return 'compacting';
    const tokens = parseJson<WorkerTokenStats>(row.tokens_json, EMPTY_TOKENS);
    if (tokens.context_percent > 80) return 'high_context';
    const progress = parseJson<WorkerProgress>(row.progress_json, EMPTY_PROGRESS);
    const spawnMs = new Date(row.spawn_time).getTime();
    if (progress.message_count === 0 && Date.now() - spawnMs < STARTUP_GRACE_MS) return 'starting';
    if (Date.now() - progress.last_action_at > 120_000) return 'stuck';
    return 'healthy';
  }

  private getLauncherForProvider(provider: ProviderType): LauncherMode {
    switch (provider) {
      case 'opencode': return 'opencode';
      case 'codex': return 'codex';
      default: return 'print';
    }
  }

  private buildSessionId(): string {
    const now = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `SESSION_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }
}
