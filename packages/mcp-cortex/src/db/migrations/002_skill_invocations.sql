-- Migration 002: Skill Invocations Table
-- Applied automatically by initDatabase() via CREATE TABLE IF NOT EXISTS
-- This file is for reference and manual migration only

-- skill_invocations: tracks every skill invocation emitted via emit_event(SKILL_INVOKED)
-- or directly via the log_skill_invocation MCP tool
CREATE TABLE IF NOT EXISTS skill_invocations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name  TEXT NOT NULL,
  session_id  TEXT,
  worker_id   TEXT,
  task_id     TEXT,
  invoked_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  duration_ms INTEGER,
  outcome     TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill ON skill_invocations(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_invocations_session ON skill_invocations(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_invocations_invoked_at ON skill_invocations(invoked_at);
CREATE INDEX IF NOT EXISTS idx_skill_invocations_task ON skill_invocations(task_id);
