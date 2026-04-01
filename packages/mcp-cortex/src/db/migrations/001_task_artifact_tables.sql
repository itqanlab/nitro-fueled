-- Migration 001: Task Artifact Tables
-- Applied automatically by initDatabase() via CREATE TABLE IF NOT EXISTS
-- This file is for reference and manual migration only

-- task_reviews: stores code review verdicts and findings per task
CREATE TABLE IF NOT EXISTS task_reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  review_type  TEXT NOT NULL CHECK(review_type IN ('style','logic','security','visual','other')),
  verdict      TEXT NOT NULL CHECK(verdict IN ('PASS','FAIL')),
  findings     TEXT NOT NULL DEFAULT '',
  reviewer     TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_test_reports: stores test run results per task
CREATE TABLE IF NOT EXISTS task_test_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  status     TEXT NOT NULL CHECK(status IN ('PASS','FAIL','SKIPPED')),
  summary    TEXT NOT NULL DEFAULT '',
  details    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_completion_reports: stores completion phase summary per task
CREATE TABLE IF NOT EXISTS task_completion_reports (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id             TEXT NOT NULL REFERENCES tasks(id),
  summary             TEXT NOT NULL DEFAULT '',
  review_results      TEXT NOT NULL DEFAULT '',
  test_results        TEXT NOT NULL DEFAULT '',
  follow_on_tasks     TEXT NOT NULL DEFAULT '',
  files_changed_count INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_plans: stores implementation plan content per task
CREATE TABLE IF NOT EXISTS task_plans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  content    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_descriptions: stores PM requirements content per task
CREATE TABLE IF NOT EXISTS task_descriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  content    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_contexts: stores PM context content per task
CREATE TABLE IF NOT EXISTS task_contexts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  content    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_subtasks: stores decomposed subtask entries per task
CREATE TABLE IF NOT EXISTS task_subtasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  batch_number INTEGER NOT NULL DEFAULT 1,
  subtask_name TEXT NOT NULL,
  status       TEXT NOT NULL CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETE','FAILED','BLOCKED','CANCELLED')) DEFAULT 'PENDING',
  assigned_to  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes for artifact tables
CREATE INDEX IF NOT EXISTS idx_task_reviews_task ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_test_reports_task ON task_test_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_reports_task ON task_completion_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_task_plans_task ON task_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_task_descriptions_task ON task_descriptions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_contexts_task ON task_contexts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id);
