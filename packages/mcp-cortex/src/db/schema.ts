import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type TaskStatus = 'CREATED' | 'IN_PROGRESS' | 'PREPPED' | 'IMPLEMENTING' | 'IMPLEMENTED' | 'IN_REVIEW' | 'FIXING' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
export const CANONICAL_TASK_TYPES = [
  'FEATURE',
  'BUGFIX',
  'REFACTORING',
  'DOCUMENTATION',
  'RESEARCH',
  'DEVOPS',
  'OPS',
  'CREATIVE',
  'CONTENT',
  'SOCIAL',
  'DESIGN',
] as const;
const DB_TASK_TYPES = [
  ...CANONICAL_TASK_TYPES,
  'BUG',
  'REFACTOR',
  'DOCS',
  'TEST',
  'CHORE',
] as const;
export type TaskType = typeof DB_TASK_TYPES[number];
export type TaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';
export type WorkerType = 'build' | 'prep' | 'implement' | 'review' | 'cleanup';
export type WorkerStatus = 'active' | 'completed' | 'failed' | 'killed';
export type LoopStatus = 'running' | 'paused' | 'stopped';
export type HealthStatus = 'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished';
export type LauncherMode = 'print' | 'opencode' | 'codex';
export type ProviderType = 'claude' | 'glm' | 'opencode' | 'codex';

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

function sqlEnum(values: readonly string[]): string {
  return values.map(value => `'${value}'`).join(',');
}

const TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK(type IN (${sqlEnum(DB_TASK_TYPES)})),
  priority         TEXT NOT NULL CHECK(priority IN ('P0-Critical','P1-High','P2-Medium','P3-Low')),
  status           TEXT NOT NULL CHECK(status IN ('CREATED','IN_PROGRESS','PREPPED','IMPLEMENTING','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED')),
  complexity       TEXT,
  model            TEXT,
  dependencies     TEXT NOT NULL DEFAULT '[]',
  description      TEXT,
  acceptance_criteria TEXT,
  file_scope       TEXT NOT NULL DEFAULT '[]',
  session_claimed  TEXT,
  claimed_at       TEXT,
  claim_timeout_ms INTEGER,
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
  worker_type        TEXT NOT NULL CHECK(worker_type IN ('build','prep','implement','review','cleanup')),
  label              TEXT,
  status             TEXT NOT NULL CHECK(status IN ('active','completed','failed','killed')) DEFAULT 'active',
  pid                INTEGER,
  working_directory  TEXT,
  model              TEXT,
  provider           TEXT CHECK(provider IN ('claude','glm','opencode','codex')),
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
)`;

const CUSTOM_FLOWS_TABLE = `
CREATE TABLE IF NOT EXISTS custom_flows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  source_flow_id TEXT,
  phases_json    TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

const HANDOFFS_TABLE = `
CREATE TABLE IF NOT EXISTS handoffs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  worker_type  TEXT NOT NULL CHECK(worker_type IN ('build','prep','implement','review','cleanup')),
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

const PHASES_TABLE = `
CREATE TABLE IF NOT EXISTS phases (
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
)`;

const REVIEWS_TABLE = `
CREATE TABLE IF NOT EXISTS reviews (
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
)`;

const FIX_CYCLES_TABLE = `
CREATE TABLE IF NOT EXISTS fix_cycles (
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
)`;

const AGENTS_TABLE = `
CREATE TABLE IF NOT EXISTS agents (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL UNIQUE,
  description            TEXT,
  capabilities           TEXT NOT NULL DEFAULT '[]',
  prompt_template        TEXT,
  launcher_compatibility TEXT NOT NULL DEFAULT '[]',
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

const WORKFLOWS_TABLE = `
CREATE TABLE IF NOT EXISTS workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  phases      TEXT NOT NULL DEFAULT '[]',
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

const LAUNCHERS_TABLE = `
CREATE TABLE IF NOT EXISTS launchers (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK(type IN ('claude-code','codex','cursor','opencode','other')),
  config     TEXT NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL CHECK(status IN ('active','inactive')) DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`;

const COMPATIBILITY_TABLE = `
CREATE TABLE IF NOT EXISTS compatibility (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  launcher_type TEXT NOT NULL,
  model         TEXT NOT NULL,
  task_type     TEXT NOT NULL,
  workflow_id   TEXT REFERENCES workflows(id),
  outcome       TEXT NOT NULL CHECK(outcome IN ('success','failed','killed')),
  duration_ms   INTEGER,
  cost_estimate REAL,
  review_pass   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
  'CREATE INDEX IF NOT EXISTS idx_custom_flows_name ON custom_flows(name)',
  'CREATE INDEX IF NOT EXISTS idx_custom_flows_source ON custom_flows(source_flow_id)',
  'CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id)',
  'CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)',
  'CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_phases_worker ON phases(worker_run_id)',
  'CREATE INDEX IF NOT EXISTS idx_phases_task ON phases(task_id)',
  'CREATE INDEX IF NOT EXISTS idx_phases_model ON phases(model)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_task ON reviews(task_id)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_model_built ON reviews(model_that_built)',
  'CREATE INDEX IF NOT EXISTS idx_fix_cycles_task ON fix_cycles(task_id)',
  'CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)',
  'CREATE INDEX IF NOT EXISTS idx_workflows_default ON workflows(is_default)',
  'CREATE INDEX IF NOT EXISTS idx_launchers_type ON launchers(type)',
  'CREATE INDEX IF NOT EXISTS idx_launchers_status ON launchers(status)',
  'CREATE INDEX IF NOT EXISTS idx_compatibility_launcher ON compatibility(launcher_type)',
  'CREATE INDEX IF NOT EXISTS idx_compatibility_model ON compatibility(model)',
  'CREATE INDEX IF NOT EXISTS idx_compatibility_task_type ON compatibility(task_type)',
  'CREATE INDEX IF NOT EXISTS idx_compatibility_outcome ON compatibility(outcome)',
];

// Column additions for schema evolution. Each entry is applied once via ALTER TABLE.
// Table-keyed to avoid cross-table column name collisions.
const TASK_MIGRATIONS: Array<{ column: string; ddl: string }> = [
  { column: 'complexity',           ddl: 'ALTER TABLE tasks ADD COLUMN complexity TEXT' },
  { column: 'model',                ddl: 'ALTER TABLE tasks ADD COLUMN model TEXT' },
  { column: 'dependencies',         ddl: "ALTER TABLE tasks ADD COLUMN dependencies TEXT NOT NULL DEFAULT '[]'" },
  { column: 'description',          ddl: 'ALTER TABLE tasks ADD COLUMN description TEXT' },
  { column: 'acceptance_criteria',  ddl: 'ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT' },
  { column: 'file_scope',           ddl: "ALTER TABLE tasks ADD COLUMN file_scope TEXT NOT NULL DEFAULT '[]'" },
  { column: 'session_claimed',      ddl: 'ALTER TABLE tasks ADD COLUMN session_claimed TEXT' },
  { column: 'claimed_at',           ddl: 'ALTER TABLE tasks ADD COLUMN claimed_at TEXT' },
  { column: 'claim_timeout_ms',     ddl: 'ALTER TABLE tasks ADD COLUMN claim_timeout_ms INTEGER' },
  { column: 'custom_flow_id',         ddl: 'ALTER TABLE tasks ADD COLUMN custom_flow_id TEXT' },
  { column: 'preferred_provider',     ddl: 'ALTER TABLE tasks ADD COLUMN preferred_provider TEXT' },
  { column: 'worker_mode',            ddl: "ALTER TABLE tasks ADD COLUMN worker_mode TEXT" },
];

const SESSION_MIGRATIONS: Array<{ column: string; ddl: string }> = [
  { column: 'supervisor_model',          ddl: 'ALTER TABLE sessions ADD COLUMN supervisor_model TEXT' },
  { column: 'supervisor_launcher',       ddl: 'ALTER TABLE sessions ADD COLUMN supervisor_launcher TEXT' },
  { column: 'mode',                      ddl: 'ALTER TABLE sessions ADD COLUMN mode TEXT' },
  { column: 'total_cost',                ddl: 'ALTER TABLE sessions ADD COLUMN total_cost REAL' },
  { column: 'total_input_tokens',        ddl: 'ALTER TABLE sessions ADD COLUMN total_input_tokens INTEGER' },
  { column: 'total_output_tokens',       ddl: 'ALTER TABLE sessions ADD COLUMN total_output_tokens INTEGER' },
  { column: 'last_heartbeat',            ddl: 'ALTER TABLE sessions ADD COLUMN last_heartbeat TEXT' },
  { column: 'drain_requested',            ddl: 'ALTER TABLE sessions ADD COLUMN drain_requested INTEGER NOT NULL DEFAULT 0' },
];

const WORKER_MIGRATIONS: Array<{ column: string; ddl: string }> = [
  { column: 'outcome',                  ddl: 'ALTER TABLE workers ADD COLUMN outcome TEXT' },
  { column: 'retry_number',             ddl: 'ALTER TABLE workers ADD COLUMN retry_number INTEGER NOT NULL DEFAULT 0' },
  { column: 'spawn_to_first_output_ms', ddl: 'ALTER TABLE workers ADD COLUMN spawn_to_first_output_ms INTEGER' },
  { column: 'total_duration_ms',        ddl: 'ALTER TABLE workers ADD COLUMN total_duration_ms INTEGER' },
  { column: 'files_changed_count',      ddl: 'ALTER TABLE workers ADD COLUMN files_changed_count INTEGER' },
  { column: 'files_changed',            ddl: 'ALTER TABLE workers ADD COLUMN files_changed TEXT' },
  { column: 'review_result',            ddl: "ALTER TABLE workers ADD COLUMN review_result TEXT" },
  { column: 'review_findings_count',    ddl: 'ALTER TABLE workers ADD COLUMN review_findings_count INTEGER' },
  { column: 'workflow_phase',           ddl: 'ALTER TABLE workers ADD COLUMN workflow_phase TEXT' },
];

function applyMigrations(db: Database.Database, table: string, migrations: Array<{ column: string; ddl: string }>): void {
  const existingColumns = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(r => r.name),
  );
  for (const { column, ddl } of migrations) {
    if (!existingColumns.has(column)) {
      db.exec(ddl);
    }
  }
}

/**
 * Migrate the tasks table CHECK constraints to include all valid statuses and types.
 * SQLite cannot ALTER CHECK constraints, so we recreate the table preserving data.
 */
function migrateTasksCheckConstraint(db: Database.Database): void {
  // Check if the tasks table exists and has outdated constraints
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get() as { sql: string } | undefined;
  if (!tableInfo) return; // Table doesn't exist yet, CREATE TABLE will handle it

  const needsStatusMigration = !tableInfo.sql.includes("'FIXING'") || !tableInfo.sql.includes("'PREPPED'") || !tableInfo.sql.includes("'IMPLEMENTING'");
  const needsTypeMigration = !tableInfo.sql.includes("'OPS'") || !tableInfo.sql.includes("'DESIGN'");
  if (!needsStatusMigration && !needsTypeMigration) return; // Already up to date

  // Disable foreign keys during table recreation to avoid FK constraint failures
  db.pragma('foreign_keys = OFF');

  db.transaction(() => {
    // Drop leftover temp table from a previous failed migration attempt
    db.exec('DROP TABLE IF EXISTS tasks_new');

    db.exec(`
      CREATE TABLE tasks_new (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        type             TEXT NOT NULL CHECK(type IN (${sqlEnum(DB_TASK_TYPES)})),
        priority         TEXT NOT NULL CHECK(priority IN ('P0-Critical','P1-High','P2-Medium','P3-Low')),
        status           TEXT NOT NULL CHECK(status IN ('CREATED','IN_PROGRESS','PREPPED','IMPLEMENTING','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED')),
        complexity       TEXT,
        model            TEXT,
        dependencies     TEXT NOT NULL DEFAULT '[]',
        description      TEXT,
        acceptance_criteria TEXT,
        file_scope       TEXT NOT NULL DEFAULT '[]',
        session_claimed  TEXT,
        claimed_at       TEXT,
        claim_timeout_ms INTEGER,
        custom_flow_id   TEXT,
        created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    // Copy existing data — use column intersection to handle schema differences
    const existingCols = new Set(
      (db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>).map(r => r.name),
    );
    const newCols = new Set(
      (db.prepare('PRAGMA table_info(tasks_new)').all() as Array<{ name: string }>).map(r => r.name),
    );
    const shared = [...newCols].filter(c => existingCols.has(c));
    const colList = shared.join(', ');

    db.exec(`INSERT INTO tasks_new (${colList}) SELECT ${colList} FROM tasks`);
    db.exec('DROP TABLE tasks');
    db.exec('ALTER TABLE tasks_new RENAME TO tasks');
  })();

  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');
}

/**
 * Migrate the workers table CHECK constraint to include 'codex' as a valid provider.
 * SQLite cannot ALTER CHECK constraints, so we recreate the table preserving data.
 */
function migrateWorkersProviderConstraint(db: Database.Database): void {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workers'").get() as { sql: string } | undefined;
  if (!tableInfo) return;

  if (tableInfo.sql.includes("'codex'") && tableInfo.sql.includes("'prep'")) return; // Already up to date

  db.pragma('foreign_keys = OFF');

  db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS workers_new');

    // Get existing columns to handle schema differences
    const existingCols = (db.prepare('PRAGMA table_info(workers)').all() as Array<{ name: string }>).map(r => r.name);

    db.exec(WORKERS_TABLE.replace('CREATE TABLE IF NOT EXISTS workers', 'CREATE TABLE workers_new'));

    const newCols = new Set(
      (db.prepare('PRAGMA table_info(workers_new)').all() as Array<{ name: string }>).map(r => r.name),
    );
    const shared = existingCols.filter(c => newCols.has(c));
    const colList = shared.join(', ');

    db.exec(`INSERT INTO workers_new (${colList}) SELECT ${colList} FROM workers`);
    db.exec('DROP TABLE workers');
    db.exec('ALTER TABLE workers_new RENAME TO workers');
  })();

  db.pragma('foreign_keys = ON');
}

/**
 * Migrate the handoffs table CHECK constraint to include new worker types (prep, implement, cleanup).
 * SQLite cannot ALTER CHECK constraints, so we recreate the table preserving data.
 */
function migrateHandoffsWorkerTypeConstraint(db: Database.Database): void {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='handoffs'").get() as { sql: string } | undefined;
  if (!tableInfo) return;

  if (tableInfo.sql.includes("'prep'")) return; // Already up to date

  db.pragma('foreign_keys = OFF');

  db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS handoffs_new');

    db.exec(HANDOFFS_TABLE.replace('CREATE TABLE IF NOT EXISTS handoffs', 'CREATE TABLE handoffs_new'));

    const existingCols = (db.prepare('PRAGMA table_info(handoffs)').all() as Array<{ name: string }>).map(r => r.name);
    const newCols = new Set(
      (db.prepare('PRAGMA table_info(handoffs_new)').all() as Array<{ name: string }>).map(r => r.name),
    );
    const shared = existingCols.filter(c => newCols.has(c));
    const colList = shared.join(', ');

    db.exec(`INSERT INTO handoffs_new (${colList}) SELECT ${colList} FROM handoffs`);
    db.exec('DROP TABLE handoffs');
    db.exec('ALTER TABLE handoffs_new RENAME TO handoffs');
  })();

  db.pragma('foreign_keys = ON');
}

/**
 * One-shot data migration: normalize any session_claimed values still in the legacy
 * underscore format (SESSION_YYYY-MM-DD_HH-MM-SS) to the canonical T-format.
 * This repairs rows written before TASK_2026_194 deployed the normalization fix.
 * Safe to run on every startup — the WHERE clause ensures it is a no-op once migrated.
 */
function migrateSessionClaimedFormat(db: Database.Database): void {
  try {
    db.prepare(
      `UPDATE tasks
       SET session_claimed = SUBSTR(session_claimed, 1, 18) || 'T' || SUBSTR(session_claimed, 20)
       WHERE session_claimed LIKE 'SESSION_____-__-____%'
         AND session_claimed NOT LIKE 'SESSION_____-__-__T%'`,
    ).run();
  } catch {
    // Table may not exist yet on a fresh install — safe to ignore
  }
}

/**
 * Seed the default PM->Architect->Dev->QA workflow if not already present.
 * Wrapped in a transaction so partial inserts cannot persist.
 */
function seedDefaultWorkflow(db: Database.Database): void {
  const existing = db.prepare("SELECT id FROM workflows WHERE id = 'default-pm-arch-dev-qa'").get();
  if (existing) return;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO workflows (id, name, description, phases, is_default)
      VALUES (?, ?, ?, ?, 1)
    `).run(
      'default-pm-arch-dev-qa',
      'PM → Architect → Dev → QA',
      'Standard nitro-fueled pipeline: project management, architecture, development, and quality assurance',
      JSON.stringify([
        { name: 'PM', required_capability: 'project-management', next_phase: 'Architect' },
        { name: 'Architect', required_capability: 'architecture', next_phase: 'Dev' },
        { name: 'Dev', required_capability: 'development', next_phase: 'QA' },
        { name: 'QA', required_capability: 'quality-assurance', next_phase: null },
      ]),
    );
  })();
}

export function initDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Migrate CHECK constraints before CREATE TABLE IF NOT EXISTS (which won't update existing tables)
  migrateTasksCheckConstraint(db);
  migrateWorkersProviderConstraint(db);
  migrateHandoffsWorkerTypeConstraint(db);

  db.exec(TASKS_TABLE);
  db.exec(SESSIONS_TABLE);
  db.exec(WORKERS_TABLE);
  db.exec(CUSTOM_FLOWS_TABLE);
  db.exec(HANDOFFS_TABLE);
  db.exec(EVENTS_TABLE);
  db.exec(PHASES_TABLE);
  db.exec(REVIEWS_TABLE);
  db.exec(FIX_CYCLES_TABLE);
  db.exec(AGENTS_TABLE);
  db.exec(WORKFLOWS_TABLE);
  db.exec(LAUNCHERS_TABLE);
  db.exec(COMPATIBILITY_TABLE);
  for (const idx of INDEXES) {
    db.exec(idx);
  }

  applyMigrations(db, 'tasks', TASK_MIGRATIONS);
  applyMigrations(db, 'sessions', SESSION_MIGRATIONS);
  applyMigrations(db, 'workers', WORKER_MIGRATIONS);

  // Repair legacy session_claimed values written before the T-separator normalization fix.
  migrateSessionClaimedFormat(db);

  seedDefaultWorkflow(db);

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
