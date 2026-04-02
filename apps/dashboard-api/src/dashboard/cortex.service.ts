import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolveCortexDbPath } from '../app/resolve-project-root';
import Database from 'better-sqlite3';
import {
  queryTasks,
  queryTaskContext,
  querySessions,
  querySessionSummary,
  queryWorkers,
  queryTaskTrace,
  queryModelPerformance,
  queryBuilderQuality,
  queryPhaseTiming,
  queryEventsSince,
  queryLauncherMetrics,
  queryRoutingRecommendations,
  querySkillUsage,
} from './cortex-queries';
import type {
  CortexTask,
  CortexTaskContext,
  CortexSession,
  CortexSessionSummary,
  CortexWorker,
  CortexEvent,
  CortexTaskTrace,
  CortexModelPerformance,
  CortexBuilderQuality,
  CortexPhaseTiming,
  CortexLauncherMetrics,
  CortexRoutingRecommendation,
  CortexSkillUsage,
} from './cortex.types';

export type {
  CortexTask,
  CortexTaskContext,
  CortexSession,
  CortexSessionSummary,
  CortexWorker,
  CortexEvent,
  CortexTaskTrace,
  CortexModelPerformance,
  CortexBuilderQuality,
  CortexPhaseTiming,
  CortexSkillUsage,
};

/**
 * CortexService reads data directly from the nitro-cortex SQLite database.
 * All methods return null when the DB file does not exist (graceful degradation).
 * DB path: <cwd>/.nitro/cortex.db
 * SQL queries and mappers are in cortex-queries.ts.
 */
@Injectable()
export class CortexService {
  private readonly logger = new Logger(CortexService.name);
  private readonly dbPath: string;

  public constructor() {
    this.dbPath = resolveCortexDbPath();
    this.logger.log(`Cortex DB path: ${this.dbPath}`);
  }

  /** Returns true when the cortex DB file exists. Used by controllers to distinguish 503 from 404. */
  public isAvailable(): boolean {
    return existsSync(this.dbPath);
  }

  private openDb(): Database.Database | null {
    if (!existsSync(this.dbPath)) return null;
    try {
      return new Database(this.dbPath, { readonly: true, fileMustExist: true });
    } catch (err) {
      this.logger.error(`Failed to open cortex DB: ${String(err)}`);
      return null;
    }
  }

  // ============================================================
  // Tasks
  // ============================================================

  public getTasks(filters?: { status?: string; type?: string }): CortexTask[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryTasks(db, filters);
    } catch (err) {
      this.logger.error(`getTasks failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public getTaskContext(taskId: string): CortexTaskContext | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryTaskContext(db, taskId);
    } catch (err) {
      this.logger.error(`getTaskContext failed for ${taskId}: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  /**
   * Update allowed task fields (model, preferred_provider, worker_mode).
   * Opens the DB in write mode. Returns true on success, false if task not found, null if DB unavailable.
   */
  public updateTask(taskId: string, fields: Partial<Pick<CortexTaskContext, 'model' | 'preferred_provider' | 'worker_mode'>>): boolean | null {
    if (!existsSync(this.dbPath)) return null;
    let db: Database.Database | null = null;
    try {
      db = new Database(this.dbPath, { fileMustExist: true });
      const ALLOWED = new Set(['model', 'preferred_provider', 'worker_mode']);
      const entries = Object.entries(fields).filter(([k]) => ALLOWED.has(k));
      if (entries.length === 0) return true;

      const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
      const values = entries.map(([, v]) => v ?? null);
      const now = new Date().toISOString();
      const result = db.prepare(
        `UPDATE tasks SET ${setClauses}, updated_at = ? WHERE id = ?`,
      ).run(...values, now, taskId);
      return result.changes > 0;
    } catch (err) {
      this.logger.error(`updateTask failed for ${taskId}: ${String(err)}`);
      return null;
    } finally {
      db?.close();
    }
  }

  // ============================================================
  // Sessions
  // ============================================================

  public getSessions(): CortexSession[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return querySessions(db);
    } catch (err) {
      this.logger.error(`getSessions failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public getSessionSummary(sessionId: string): CortexSessionSummary | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return querySessionSummary(db, sessionId);
    } catch (err) {
      this.logger.error(`getSessionSummary failed for ${sessionId}: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Workers
  // ============================================================

  public getWorkers(filters?: { sessionId?: string; status?: string; launcher?: string }): CortexWorker[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryWorkers(db, filters);
    } catch (err) {
      this.logger.error(`getWorkers failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Task Trace
  // ============================================================

  public getTaskTrace(taskId: string): CortexTaskTrace | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryTaskTrace(db, taskId);
    } catch (err) {
      this.logger.error(`getTaskTrace failed for ${taskId}: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Analytics
  // ============================================================

  public getModelPerformance(filters?: { taskType?: string; model?: string }): CortexModelPerformance[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryModelPerformance(db, filters);
    } catch (err) {
      this.logger.error(`getModelPerformance failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  /** Returns avg review scores grouped by the model that built the task (model_that_built). */
  public getBuilderQuality(): CortexBuilderQuality[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryBuilderQuality(db);
    } catch (err) {
      this.logger.error(`getBuilderQuality failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public getPhaseTiming(): CortexPhaseTiming[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryPhaseTiming(db);
    } catch (err) {
      this.logger.error(`getPhaseTiming failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public getSkillUsage(filters?: { period?: string }): CortexSkillUsage[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return querySkillUsage(db, filters);
    } catch (err) {
      this.logger.error(`getSkillUsage failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Events
  // ============================================================

  public getEventsSince(sinceId: number): CortexEvent[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryEventsSince(db, sinceId);
    } catch (err) {
      this.logger.error(`getEventsSince failed (sinceId=${sinceId}): ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Recent Sessions with Cost/Token Aggregates
  // ============================================================

  public getRecentSessionStats(limit = 10): Array<{
    sessionId: string;
    date: string;
    tokens: number;
    cost: number;
  }> | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      const rows = db.prepare(`
        SELECT s.id, s.started_at, w.cost_json, w.tokens_json
        FROM sessions s
        LEFT JOIN workers w ON w.session_id = s.id
        ORDER BY s.started_at DESC
      `).all() as Array<{ id: string; started_at: string; cost_json: string | null; tokens_json: string | null }>;

      const sessionMap = new Map<string, { date: string; tokens: number; cost: number }>();
      for (const row of rows) {
        if (!sessionMap.has(row.id)) {
          sessionMap.set(row.id, { date: row.started_at, tokens: 0, cost: 0 });
        }
        const entry = sessionMap.get(row.id)!;
        if (row.cost_json) {
          try { entry.cost += JSON.parse(row.cost_json).total_usd ?? 0; } catch { /* skip */ }
        }
        if (row.tokens_json) {
          try {
            const t = JSON.parse(row.tokens_json);
            entry.tokens += t.total_combined ?? (t.total_input ?? 0) + (t.total_output ?? 0);
          } catch { /* skip */ }
        }
      }

      return Array.from(sessionMap.entries())
        .slice(0, limit)
        .map(([sessionId, data]) => ({ sessionId, ...data }));
    } catch (err) {
      this.logger.error(`getRecentSessionStats failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Cost & Token Aggregates
  // ============================================================

  public getCostTokenAggregates(): {
    totalCost: number;
    totalTokens: number;
    costByModel: Record<string, number>;
    tokensByModel: Record<string, number>;
  } | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      const rows = db.prepare(
        `SELECT model, cost_json, tokens_json FROM workers WHERE cost_json IS NOT NULL`,
      ).all() as Array<{ model: string | null; cost_json: string; tokens_json: string }>;

      let totalCost = 0;
      let totalTokens = 0;
      const costByModel: Record<string, number> = {};
      const tokensByModel: Record<string, number> = {};

      for (const row of rows) {
        const model = row.model ?? 'unknown';
        try {
          const cost = JSON.parse(row.cost_json);
          const usd = cost.total_usd ?? 0;
          totalCost += usd;
          if (usd > 0) costByModel[model] = (costByModel[model] ?? 0) + usd;
        } catch { /* skip malformed */ }
        try {
          const tokens = JSON.parse(row.tokens_json);
          const combined = tokens.total_combined ?? (tokens.total_input ?? 0) + (tokens.total_output ?? 0);
          totalTokens += combined;
          if (combined > 0) tokensByModel[model] = (tokensByModel[model] ?? 0) + combined;
        } catch { /* skip malformed */ }
      }

      return { totalCost, totalTokens, costByModel, tokensByModel };
    } catch (err) {
      this.logger.error(`getCostTokenAggregates failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Analytics — Launchers & Routing Recommendations
  // ============================================================

  public getLauncherMetrics(): CortexLauncherMetrics[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryLauncherMetrics(db);
    } catch (err) {
      this.logger.error(`getLauncherMetrics failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public getRoutingRecommendations(): CortexRoutingRecommendation[] | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      return queryRoutingRecommendations(db);
    } catch (err) {
      this.logger.error(`getRoutingRecommendations failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Session Lifecycle
  // ============================================================

  public requestSessionDrain(sessionId: string): boolean {
    if (!existsSync(this.dbPath)) return false;
    let db: Database.Database | null = null;
    try {
      db = new Database(this.dbPath, { fileMustExist: true });
      const now = new Date().toISOString();
      const result = db.prepare(
        `UPDATE sessions SET drain_requested = 1, updated_at = ? WHERE id = ?`,
      ).run(now, sessionId);
      return (result as { changes: number }).changes > 0;
    } catch (err) {
      this.logger.error(`requestSessionDrain failed: ${String(err)}`);
      return false;
    } finally {
      db?.close();
    }
  }

  public closeStaleSession(ttlMinutes = 30): { closed_sessions: number } | null {
    if (!existsSync(this.dbPath)) return null;
    let db: Database.Database | null = null;
    try {
      db = new Database(this.dbPath, { fileMustExist: true });
      const cutoffTime = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();
      const staleSessions = db.prepare(
        `SELECT id FROM sessions WHERE loop_status = 'running' AND (last_heartbeat IS NULL OR last_heartbeat < ?)`,
      ).all(cutoffTime) as Array<{ id: string }>;
      let closedCount = 0;
      if (staleSessions.length > 0) {
        const updateMultiple = db.transaction(() => {
          const now = new Date().toISOString();
          const updateStmt = db!.prepare(
            `UPDATE sessions SET loop_status = 'stopped', ended_at = ?, summary = ?, updated_at = ? WHERE id = ?`,
          );
          for (const session of staleSessions) {
            updateStmt.run(now, 'stale: no heartbeat', now, session.id);
          }
          return staleSessions.length;
        });
        closedCount = updateMultiple() as number;
      }
      return { closed_sessions: closedCount };
    } catch (err) {
      this.logger.error(`closeStaleSession failed: ${String(err)}`);
      return null;
    } finally {
      db?.close();
    }
  }
}
