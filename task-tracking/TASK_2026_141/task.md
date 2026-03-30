# Task: CLI update command — DB migration and hydration for existing projects

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | FEATURE              |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

When a project that already has nitro-fueled installed runs `npx nitro-fueled update`, the update command currently copies scaffold files and updates the manifest. It has no awareness of the cortex DB.

After TASK_2026_138 (cortex schema extension) and TASK_2026_140 (file-DB sync), existing projects need a migration path: create the DB if missing, run schema migrations if outdated, and hydrate the DB from existing files on disk.

**New step in the update command (after scaffold file copy, before manifest write):**

1. **Check if cortex DB exists** — look for `.nitro-fueled/cortex.db` (or configured path)
2. **If DB missing → create and hydrate:**
   - Create fresh SQLite DB with full schema (tasks, sessions, workers, handoffs, events)
   - Scan `task-tracking/TASK_*/status` files → INSERT INTO tasks (task_id, status)
   - Scan `task-tracking/TASK_*/task.md` → extract metadata (type, priority, complexity, dependencies, model) → UPDATE tasks
   - Scan `task-tracking/sessions/` → INSERT INTO sessions
   - Scan `task-tracking/TASK_*/handoff.md` → INSERT INTO handoffs (if file exists)
   - Log: "Created nitro-cortex database, hydrated N tasks, M sessions"
3. **If DB exists but schema outdated → run migrations:**
   - Check schema version in DB metadata table
   - Apply pending migrations (add new tables/columns)
   - Log: "Applied N schema migrations"
4. **If DB exists and current → verify sync:**
   - Compare status files on disk vs tasks table
   - Fix any drift (file wins — workers are authoritative)
   - Log: "Database in sync with files" or "Fixed N drift(s)"

**Also add `npx nitro-fueled db:rebuild` command:**
- Drops all data from tasks, handoffs, events tables
- Re-hydrates entirely from files on disk
- Use case: DB corruption, manual recovery, or after bulk file edits
- Does NOT drop sessions/workers tables (those are MCP server state)

**Key guarantees:**
- Idempotent — running update twice produces the same DB state
- File-first — DB is always built FROM files, never overwrites files
- Graceful — if hydration fails for one task, log warning and continue with next
- No data loss — DB can always be rebuilt from files

## Dependencies

- TASK_2026_138 — cortex schema must exist (tables defined)
- TASK_2026_140 — file-DB sync layer (sync utilities to reuse)

## Acceptance Criteria

- [ ] `update` command creates cortex DB if missing
- [ ] `update` command hydrates DB from existing task-tracking files (tasks, sessions, handoffs)
- [ ] `update` command runs schema migrations if DB exists but is outdated
- [ ] `update` command verifies file-DB sync and fixes drift
- [ ] `db:rebuild` command drops and re-hydrates task/handoff/event data from files
- [ ] Hydration is idempotent (running twice = same result)
- [ ] Hydration logs progress: "Hydrated N tasks, M sessions"
- [ ] Graceful failure: if one task.md is malformed, skip it with warning and continue
- [ ] Works on projects with 0 tasks (fresh init + update) and 100+ tasks

## References

- CLI update command: `apps/cli/src/commands/update.ts`
- nitro-cortex: `libs/nitro-cortex/`
- Architecture doc: `docs/supervisor-worker-architecture-v2.md`

## File Scope

- `apps/cli/src/commands/update.ts`
- `apps/cli/src/commands/db-rebuild.ts` (new)
- `apps/cli/src/utils/` (hydration utilities)

## Parallelism

- Can run in parallel with TASK_2026_134-137 (different files)
- Do NOT run in parallel with TASK_2026_138, 140 (depends on cortex schema + sync layer)
