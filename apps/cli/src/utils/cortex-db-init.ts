// Inlined from packages/mcp-cortex/src/db/schema.ts — cross-package import blocked by tsconfig rootDir
// Source: packages/mcp-cortex/src/db/schema.ts:initDatabase
// Keep this file in sync with packages/mcp-cortex/src/db/schema.ts whenever the schema changes.

import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Column names returned by PRAGMA table_info(). */
interface ColumnInfoRow { name: string }

/**
 * Known table names — used as an allowlist in applyMigrations to prevent
 * SQL injection via PRAGMA table_info() string interpolation.
 */
const KNOWN_TABLES = ['tasks', 'sessions', 'workers', 'handoffs', 'events', 'phases', 'reviews', 'fix_cycles'] as const;
type KnownTable = typeof KNOWN_TABLES[number];

function applyMigrations(
  db: Database.Database,
  table: KnownTable,
  migrations: Array<{ column: string; ddl: string }>,
): number {
  // KNOWN_TABLES allowlist prevents SQL injection via PRAGMA string interpolation
  if (!(KNOWN_TABLES as readonly string[]).includes(table)) {
    throw new Error(`applyMigrations: unknown table "${table}"`);
  }
  const existingColumns = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfoRow[]).map((r) => r.name),
  );
  let applied = 0;
  for (const { column, ddl } of migrations) {
    if (!existingColumns.has(column)) {
      db.exec(ddl);
      applied++;
    }
  }
  return applied;
}

/**
 * Opens (or creates) the cortex SQLite DB at dbPath. Applies all schema
 * table definitions, indexes, and column migrations. Idempotent — safe
 * to call on an existing DB. Mirrors packages/mcp-cortex/src/db/schema.ts.
 *
 * @returns An object containing the open DB handle and the count of schema
 *          migrations applied, so callers can log "Applied N migrations".
 */
export function initCortexDatabase(dbPath: string): { db: Database.Database; migrationsApplied: number } {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new BetterSqlite3(dbPath);
  // Restrict DB file to owner read/write (0o600) — matches the directory permission intent.
  chmodSync(dbPath, 0o600);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    type             TEXT NOT NULL CHECK(type IN ('FEATURE','BUG','REFACTOR','DOCS','TEST','CHORE')),
    priority         TEXT NOT NULL CHECK(priority IN ('P0-Critical','P1-High','P2-Medium','P3-Low')),
    status           TEXT NOT NULL CHECK(status IN ('CREATED','IN_PROGRESS','IMPLEMENTED','IN_REVIEW','COMPLETE','FAILED','BLOCKED','CANCELLED')),
    complexity       TEXT,
    model            TEXT,
    dependencies     TEXT NOT NULL DEFAULT '[]',
    description      TEXT,
    acceptance_criteria TEXT,
    file_scope       TEXT NOT NULL DEFAULT '[]',
    session_claimed  TEXT,
    claimed_at       TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    source          TEXT,
    started_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ended_at        TEXT,
    config          TEXT NOT NULL DEFAULT '{}',
    loop_status     TEXT NOT NULL CHECK(loop_status IN ('running','paused','stopped')) DEFAULT 'running',
    task_limit      INTEGER,
    tasks_terminal  INTEGER NOT NULL DEFAULT 0,
    summary         TEXT,
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS workers (
    id                 TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL REFERENCES sessions(id),
    task_id            TEXT REFERENCES tasks(id),
    worker_type        TEXT NOT NULL CHECK(worker_type IN ('build','review')),
    label              TEXT,
    status             TEXT NOT NULL CHECK(status IN ('active','completed','failed','killed')) DEFAULT 'active',
    pid                INTEGER,
    working_directory  TEXT,
    model              TEXT,
    provider           TEXT CHECK(provider IN ('claude','glm','opencode')),
    launcher           TEXT CHECK(launcher IN ('print','opencode','codex')),
    log_path           TEXT,
    auto_close         INTEGER NOT NULL DEFAULT 0,
    expected_end_state TEXT,
    spawn_time         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_health        TEXT,
    stuck_count        INTEGER NOT NULL DEFAULT 0,
    compaction_count   INTEGER NOT NULL DEFAULT 0,
    tokens_json        TEXT NOT NULL DEFAULT '{}',
    cost_json          TEXT NOT NULL DEFAULT '{}',
    progress_json      TEXT NOT NULL DEFAULT '{}'
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS handoffs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      TEXT NOT NULL REFERENCES tasks(id),
    worker_type  TEXT NOT NULL CHECK(worker_type IN ('build','review')),
    files_changed TEXT NOT NULL DEFAULT '[]',
    commits      TEXT NOT NULL DEFAULT '[]',
    decisions    TEXT NOT NULL DEFAULT '[]',
    risks        TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL,
    task_id      TEXT,
    source       TEXT NOT NULL,
    event_type   TEXT NOT NULL,
    data         TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  // CHECK constraints copied verbatim from packages/mcp-cortex/src/db/schema.ts
  db.exec(`CREATE TABLE IF NOT EXISTS phases (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_run_id    TEXT NOT NULL,
    task_id          TEXT REFERENCES tasks(id),
    phase            TEXT NOT NULL CHECK(phase IN ('PM','Architect','Dev','Review','Fix','Completion','other')),
    model            TEXT,
    start_time       TEXT,
    end_time         TEXT,
    duration_minutes REAL,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    outcome          TEXT CHECK(outcome IN ('COMPLETE','FAILED','SKIPPED','STUCK') OR outcome IS NULL),
    metadata         TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  // CHECK constraints copied verbatim from packages/mcp-cortex/src/db/schema.ts
  db.exec(`CREATE TABLE IF NOT EXISTS reviews (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id               TEXT NOT NULL REFERENCES tasks(id),
    phase_id              INTEGER REFERENCES phases(id),
    review_type           TEXT NOT NULL CHECK(review_type IN ('code-style','code-logic','security','visual','other')),
    score                 REAL NOT NULL,
    findings_count        INTEGER NOT NULL DEFAULT 0,
    critical_count        INTEGER NOT NULL DEFAULT 0,
    serious_count         INTEGER NOT NULL DEFAULT 0,
    minor_count           INTEGER NOT NULL DEFAULT 0,
    model_that_built      TEXT,
    model_that_reviewed   TEXT,
    launcher_that_built   TEXT,
    launcher_that_reviewed TEXT,
    created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS fix_cycles (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id            TEXT NOT NULL REFERENCES tasks(id),
    phase_id           INTEGER REFERENCES phases(id),
    fixes_applied      INTEGER NOT NULL DEFAULT 0,
    fixes_skipped      INTEGER NOT NULL DEFAULT 0,
    required_manual    INTEGER NOT NULL DEFAULT 0,
    model_that_fixed   TEXT,
    launcher_that_fixed TEXT,
    duration_minutes   REAL,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_claimed ON tasks(session_claimed)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)',
    'CREATE INDEX IF NOT EXISTS idx_workers_session ON workers(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_workers_task ON workers(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(loop_status)',
    'CREATE INDEX IF NOT EXISTS idx_handoffs_task ON handoffs(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)',
    'CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_phases_worker ON phases(worker_run_id)',
    'CREATE INDEX IF NOT EXISTS idx_phases_task ON phases(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_phases_model ON phases(model)',
    'CREATE INDEX IF NOT EXISTS idx_reviews_task ON reviews(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_reviews_model_built ON reviews(model_that_built)',
    'CREATE INDEX IF NOT EXISTS idx_fix_cycles_task ON fix_cycles(task_id)',
  ] as const;
  for (const idx of INDEXES) {
    db.exec(idx);
  }

  let migrationsApplied = 0;

  migrationsApplied += applyMigrations(db, 'tasks', [
    { column: 'complexity',          ddl: 'ALTER TABLE tasks ADD COLUMN complexity TEXT' },
    { column: 'model',               ddl: 'ALTER TABLE tasks ADD COLUMN model TEXT' },
    { column: 'dependencies',        ddl: "ALTER TABLE tasks ADD COLUMN dependencies TEXT NOT NULL DEFAULT '[]'" },
    { column: 'description',         ddl: 'ALTER TABLE tasks ADD COLUMN description TEXT' },
    { column: 'acceptance_criteria', ddl: 'ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT' },
    { column: 'file_scope',          ddl: "ALTER TABLE tasks ADD COLUMN file_scope TEXT NOT NULL DEFAULT '[]'" },
    { column: 'session_claimed',     ddl: 'ALTER TABLE tasks ADD COLUMN session_claimed TEXT' },
    { column: 'claimed_at',          ddl: 'ALTER TABLE tasks ADD COLUMN claimed_at TEXT' },
  ]);

  migrationsApplied += applyMigrations(db, 'sessions', [
    { column: 'supervisor_model',     ddl: 'ALTER TABLE sessions ADD COLUMN supervisor_model TEXT' },
    { column: 'supervisor_launcher',  ddl: 'ALTER TABLE sessions ADD COLUMN supervisor_launcher TEXT' },
    { column: 'mode',                 ddl: 'ALTER TABLE sessions ADD COLUMN mode TEXT' },
    { column: 'total_cost',           ddl: 'ALTER TABLE sessions ADD COLUMN total_cost REAL' },
    { column: 'total_input_tokens',   ddl: 'ALTER TABLE sessions ADD COLUMN total_input_tokens INTEGER' },
    { column: 'total_output_tokens',  ddl: 'ALTER TABLE sessions ADD COLUMN total_output_tokens INTEGER' },
  ]);

  migrationsApplied += applyMigrations(db, 'workers', [
    { column: 'outcome',      ddl: 'ALTER TABLE workers ADD COLUMN outcome TEXT' },
    { column: 'retry_number', ddl: 'ALTER TABLE workers ADD COLUMN retry_number INTEGER NOT NULL DEFAULT 0' },
  ]);

  return { db, migrationsApplied };
}
