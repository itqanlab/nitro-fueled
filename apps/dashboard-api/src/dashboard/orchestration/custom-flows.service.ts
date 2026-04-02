import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveCortexDbPath } from '../../app/resolve-project-root';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type {
  CustomFlowRecord,
  CustomFlowPhaseRecord,
  CreateCustomFlowDto,
  UpdateCustomFlowDto,
} from './types';

interface CustomFlowRow {
  id: string;
  name: string;
  description: string | null;
  source_flow_id: string | null;
  phases_json: string;
  created_at: string;
  updated_at: string;
}

interface TaskFlowRow {
  custom_flow_id: string | null;
}

function rowToRecord(row: CustomFlowRow): CustomFlowRecord {
  let phases: CustomFlowPhaseRecord[] = [];
  try {
    const parsed = JSON.parse(row.phases_json);
    phases = Array.isArray(parsed) ? (parsed as CustomFlowPhaseRecord[]) : [];
  } catch {
    phases = [];
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    source_flow_id: row.source_flow_id,
    phases,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

@Injectable()
export class CustomFlowsService {
  private readonly logger = new Logger(CustomFlowsService.name);
  private readonly dbPath: string;

  public constructor() {
    this.dbPath = resolveCortexDbPath();
  }

  public isAvailable(): boolean {
    return existsSync(this.dbPath);
  }

  private openDb(): Database.Database | null {
    if (!existsSync(this.dbPath)) {
      try {
        mkdirSync(dirname(this.dbPath), { recursive: true, mode: 0o700 });
      } catch {
        // ignore
      }
    }
    try {
      const db = new Database(this.dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      return db;
    } catch (err) {
      this.logger.error(`Failed to open DB: ${String(err)}`);
      return null;
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  public create(dto: CreateCustomFlowDto): CustomFlowRecord | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      const id = randomUUID();
      const now = new Date().toISOString();
      const phasesJson = JSON.stringify(dto.phases ?? []);
      db.prepare(
        `INSERT INTO custom_flows (id, name, description, source_flow_id, phases_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, dto.name, dto.description ?? null, dto.sourceFlowId ?? null, phasesJson, now, now);
      return rowToRecord(
        db.prepare('SELECT * FROM custom_flows WHERE id = ?').get(id) as CustomFlowRow,
      );
    } catch (err) {
      this.logger.error(`create failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public findAll(): CustomFlowRecord[] {
    const db = this.openDb();
    if (!db) return [];
    try {
      const rows = db.prepare('SELECT * FROM custom_flows ORDER BY created_at DESC').all() as CustomFlowRow[];
      return rows.map(rowToRecord);
    } catch (err) {
      this.logger.error(`findAll failed: ${String(err)}`);
      return [];
    } finally {
      db.close();
    }
  }

  public findOne(id: string): CustomFlowRecord | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      const row = db.prepare('SELECT * FROM custom_flows WHERE id = ?').get(id) as CustomFlowRow | undefined;
      return row ? rowToRecord(row) : null;
    } catch (err) {
      this.logger.error(`findOne failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public update(id: string, dto: UpdateCustomFlowDto): CustomFlowRecord | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      const existing = db.prepare('SELECT * FROM custom_flows WHERE id = ?').get(id) as CustomFlowRow | undefined;
      if (!existing) return null;

      const now = new Date().toISOString();
      const name = dto.name ?? existing.name;
      const description = dto.description !== undefined ? dto.description : existing.description;
      const phasesJson = dto.phases !== undefined ? JSON.stringify(dto.phases) : existing.phases_json;

      db.prepare(
        `UPDATE custom_flows SET name = ?, description = ?, phases_json = ?, updated_at = ? WHERE id = ?`,
      ).run(name, description, phasesJson, now, id);

      return rowToRecord(
        db.prepare('SELECT * FROM custom_flows WHERE id = ?').get(id) as CustomFlowRow,
      );
    } catch (err) {
      this.logger.error(`update failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }

  public updatePhases(id: string, phases: CustomFlowPhaseRecord[]): CustomFlowRecord | null {
    return this.update(id, { phases });
  }

  public delete(id: string): boolean {
    const db = this.openDb();
    if (!db) return false;
    try {
      const existing = db.prepare('SELECT id FROM custom_flows WHERE id = ?').get(id);
      if (!existing) return false;
      // Clear FK references on tasks before deleting to avoid dangling custom_flow_id
      db.prepare(`UPDATE tasks SET custom_flow_id = NULL WHERE custom_flow_id = ?`).run(id);
      db.prepare('DELETE FROM custom_flows WHERE id = ?').run(id);
      return true;
    } catch (err) {
      this.logger.error(`delete failed: ${String(err)}`);
      return false;
    } finally {
      db.close();
    }
  }

  // ── Task flow override ────────────────────────────────────────────────────

  public setTaskFlowOverride(taskId: string, flowId: string | null): boolean {
    const db = this.openDb();
    if (!db) return false;
    try {
      const result = db.prepare(
        `UPDATE tasks SET custom_flow_id = ?, updated_at = ? WHERE id = ?`,
      ).run(flowId, new Date().toISOString(), taskId);
      return result.changes > 0;
    } catch (err) {
      this.logger.error(`setTaskFlowOverride failed: ${String(err)}`);
      return false;
    } finally {
      db.close();
    }
  }

  public getTaskFlowOverride(taskId: string): string | null {
    const db = this.openDb();
    if (!db) return null;
    try {
      const row = db.prepare('SELECT custom_flow_id FROM tasks WHERE id = ?').get(taskId) as TaskFlowRow | undefined;
      return row?.custom_flow_id ?? null;
    } catch (err) {
      this.logger.error(`getTaskFlowOverride failed: ${String(err)}`);
      return null;
    } finally {
      db.close();
    }
  }
}
