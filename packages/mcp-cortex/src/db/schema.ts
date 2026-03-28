import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type TaskStatus = 'CREATED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'IN_REVIEW' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
export type TaskType = 'FEATURE' | 'BUG' | 'REFACTOR' | 'DOCS' | 'TEST' | 'CHORE';
export type TaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';
export type WorkerType = 'build' | 'review';
export type WorkerStatus = 'active' | 'completed' | 'failed' | 'killed';
export type LoopStatus = 'running' | 'paused' | 'stopped';

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
  config          TEXT NOT NULL DEFAULT '{}',
  loop_status     TEXT NOT NULL CHECK(loop_status IN ('running','paused','stopped')) DEFAULT 'running',
  task_limit      INTEGER,
  tasks_terminal  INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

const WORKERS_TABLE = `
CREATE TABLE IF NOT EXISTS workers (
  id                TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL REFERENCES sessions(id),
  task_id           TEXT REFERENCES tasks(id),
  worker_type       TEXT NOT NULL CHECK(worker_type IN ('build','review')),
  label             TEXT,
  status            TEXT NOT NULL CHECK(status IN ('active','completed','failed','killed')) DEFAULT 'active',
  spawn_time        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_health       TEXT,
  stuck_count       INTEGER NOT NULL DEFAULT 0,
  compaction_count  INTEGER NOT NULL DEFAULT 0,
  expected_end_state TEXT
)`;

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_claimed ON tasks(session_claimed)',
  'CREATE INDEX IF NOT EXISTS idx_workers_session ON workers(session_id)',
  'CREATE INDEX IF NOT EXISTS idx_workers_task ON workers(task_id)',
];

export function initDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(TASKS_TABLE);
  db.exec(SESSIONS_TABLE);
  db.exec(WORKERS_TABLE);
  for (const idx of INDEXES) {
    db.exec(idx);
  }

  return db;
}
