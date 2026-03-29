import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import {
  queryTasks,
  queryTaskContext,
  querySessions,
  querySessionSummary,
  queryWorkers,
  queryTaskTrace,
  queryModelPerformance,
  queryPhaseTiming,
  queryEventsSince,
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
  CortexPhaseTiming,
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
  CortexPhaseTiming,
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
    this.dbPath = join(process.cwd(), '.nitro', 'cortex.db');
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

  public getWorkers(filters?: { sessionId?: string; status?: string }): CortexWorker[] | null {
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
}
