import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type TaskStatus = 'CREATED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'IN_REVIEW' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
export type TaskType = 'FEATURE' | 'BUG' | 'REFACTOR' | 'DOCS' | 'TEST' | 'CHORE';
export type TaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';
export type WorkerType = 'build' | 'review';
export type WorkerStatus = 'active' | 'completed' | 'failed' | 'killed';
export type LoopStatus = 'running' | 'paused' | 'stopped';
export type HealthStatus = 'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished';
export type LauncherMode = 'print' | 'iterm' | 'opencode';
export type ProviderType = 'claude' | 'glm' | 'opencode';

export interface WorkerTokenStats {
  total_input: number;
  total_output: number;
  total_cache_creation: number;
  total_cache_read: number;
  total_combined: number;
  context_current_k: number;
  context_percent: number;
  compaction_count: number;
}

export interface WorkerCost {
  input_usd: number;
  output_usd: number;
  cache_usd: number;
  total_usd: number;
}

export interface WorkerProgress {
  message_count: number;
  tool_calls: number;
  files_read: string[];
  files_written: string[];
  last_action: string;
  last_action_at: number;
  elapsed_minutes: number;
}

const TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
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
)`;

const SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
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
)`;

const WORKERS_TABLE = `
CREATE TABLE IF NOT EXISTS workers (
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
  launcher           TEXT CHECK(launcher IN ('print','iterm','opencode')),
  log_path           TEXT,
  auto_close         INTEGER NOT NULL DEFAULT 0,
  iterm_session_id   TEXT,
  expected_end_state TEXT,
  spawn_time         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_health        TEXT,
  stuck_count        INTEGER NOT NULL DEFAULT 0,
  compaction_count   INTEGER NOT NULL DEFAULT 0,
  tokens_json        TEXT NOT NULL DEFAULT '{}',
  cost_json          TEXT NOT NULL DEFAULT '{}',
  progress_json      TEXT NOT NULL DEFAULT '{}'
)`;

const HANDOFFS_TABLE = `
CREATE TABLE IF NOT EXISTS handoffs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  worker_type  TEXT NOT NULL CHECK(worker_type IN ('build','review')),
  files_changed TEXT NOT NULL DEFAULT '[]',
  commits      TEXT NOT NULL DEFAULT '[]',
  decisions    TEXT NOT NULL DEFAULT '[]',
  risks        TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

const EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  task_id      TEXT,
  source       TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  data         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

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
];

// Column additions for schema evolution. Each entry is applied once via ALTER TABLE;
// SQLite silently ignores duplicates when we catch the "duplicate column name" error.
const TASK_MIGRATIONS: Array<{ column: string; ddl: string }> = [
  { column: 'complexity',           ddl: 'ALTER TABLE tasks ADD COLUMN complexity TEXT' },
  { column: 'model',                ddl: 'ALTER TABLE tasks ADD COLUMN model TEXT' },
  { column: 'dependencies',         ddl: "ALTER TABLE tasks ADD COLUMN dependencies TEXT NOT NULL DEFAULT '[]'" },
  { column: 'description',          ddl: 'ALTER TABLE tasks ADD COLUMN description TEXT' },
  { column: 'acceptance_criteria',  ddl: 'ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT' },
  { column: 'file_scope',           ddl: "ALTER TABLE tasks ADD COLUMN file_scope TEXT NOT NULL DEFAULT '[]'" },
  { column: 'session_claimed',      ddl: 'ALTER TABLE tasks ADD COLUMN session_claimed TEXT' },
  { column: 'claimed_at',           ddl: 'ALTER TABLE tasks ADD COLUMN claimed_at TEXT' },
];

export function initDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(TASKS_TABLE);
  db.exec(SESSIONS_TABLE);
  db.exec(WORKERS_TABLE);
  db.exec(HANDOFFS_TABLE);
  db.exec(EVENTS_TABLE);
  for (const idx of INDEXES) {
    db.exec(idx);
  }

  // Apply forward-only column migrations for pre-existing tasks tables
  const existingColumns = new Set(
    (db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>).map(r => r.name),
  );
  for (const { column, ddl } of TASK_MIGRATIONS) {
    if (!existingColumns.has(column)) {
      db.exec(ddl);
    }
  }

  return db;
}

export function emptyTokenStats(): WorkerTokenStats {
  return {
    total_input: 0, total_output: 0,
    total_cache_creation: 0, total_cache_read: 0,
    total_combined: 0, context_current_k: 0,
    context_percent: 0, compaction_count: 0,
  };
}

export function emptyCost(): WorkerCost {
  return { input_usd: 0, output_usd: 0, cache_usd: 0, total_usd: 0 };
}

export function emptyProgress(): WorkerProgress {
  return {
    message_count: 0, tool_calls: 0,
    files_read: [], files_written: [],
    last_action: 'spawned', last_action_at: Date.now(),
    elapsed_minutes: 0,
  };
}
