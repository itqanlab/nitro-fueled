# Context — TASK_2026_140

## Task
File-DB sync layer — bidirectional consistency between files and cortex (Part 4 of 4)

## Strategy
FEATURE — Architect → Team-Leader → Dev → QA

## Codebase State

### packages/mcp-cortex (actual location, task.md says libs/nitro-cortex — same thing)
- `packages/mcp-cortex/src/tools/sync.ts` — handleSyncTasksFromFiles() already exists (bootstrap scan)
- `packages/mcp-cortex/src/tools/tasks.ts` — handleUpsertTask, handleUpdateTask, handleGetTasks, claim/release
- `packages/mcp-cortex/src/tools/events.ts` — handleLogEvent, handleQueryEvents
- `packages/mcp-cortex/src/tools/handoffs.ts` — handleWriteHandoff, handleReadHandoff
- `packages/mcp-cortex/src/index.ts` — all tools registered; sync_tasks_from_files, upsert_task, log_event, write_handoff, read_handoff all present

### CLI
- `apps/cli/src/commands/status.ts` — currently uses generateRegistry() (file scan) and parseRegistry(); no DB integration yet

### Skill files
- `.claude/commands/nitro-create-task.md` — Steps 4+5 write task.md + status file; no DB write currently
- `.claude/skills/orchestration/SKILL.md` — Build Worker Handoff section writes handoff.md; no DB call
- `.claude/skills/auto-pilot/SKILL.md` — startup/loop logic; no file↔DB reconciliation

## What's Already Done (TASK_2026_138)
- DB schema: tasks, sessions, workers, events, handoffs tables with full indexes
- tools: upsert_task, update_task, get_tasks, claim_task, release_task, sync_tasks_from_files
- tools: write_handoff, read_handoff, log_event, query_events
- All tools registered as MCP tools in index.ts

## What TASK_2026_140 Must Add
1. **sync.ts** — add reconcile_status_files() tool: walk task-tracking/TASK_*/status files, compare with DB, fix drift (file wins); called by `nitro-fueled status` and supervisor startup
2. **status.ts (CLI)** — add DB path: when cortex available (db file exists), render registry from query_tasks(); fall back to file scan
3. **nitro-create-task.md** — Step 5 addendum: after writing task.md + status file, call upsert_task() if cortex available (best-effort)
4. **orchestration/SKILL.md** — Build Worker Handoff section: after writing handoff.md, call write_handoff() (dual-write); Review Worker reads from DB first, falls back to file
5. **auto-pilot/SKILL.md** — startup: call sync_tasks_from_files() if cortex available; periodic drift detection in loop

## Dependency Clarification
- TASK_2026_138 (COMPLETE) — cortex schema + tools exist ✓
- TASK_2026_139 (IN_PROGRESS) — skill doc updates; TASK_2026_140 does not depend on those doc edits completing
