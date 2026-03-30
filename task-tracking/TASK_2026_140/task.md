# Task: File-DB sync layer — bidirectional consistency between files and cortex

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

Part 4 of 4 — Supervisor-Worker Communication Overhaul.

After TASK_2026_139, the supervisor queries the DB but files still exist on disk (status files, registry.md, log.md, etc.). Users and external tools read these files. The DB and files must stay in sync — neither can drift.

**Sync rules — DB is primary, files are rendered:**

1. **status file → DB (ingest)**
   - When: worker writes status file (workers don't use DB directly — they write files)
   - How: cortex watches for status file changes OR supervisor syncs on detection
   - Direction: file → DB (worker is the writer, DB is the consumer)

2. **DB → registry.md (render)**
   - When: `nitro-fueled status` command runs, or on-demand
   - How: `SELECT * FROM tasks ORDER BY task_id` → render as markdown table
   - Direction: DB → file (DB is source of truth for task metadata)
   - registry.md becomes a read-only rendered artifact (like today, but from DB not file scan)

3. **DB → log.md (render)**
   - When: session ends, or on explicit `--render-log` flag
   - How: `SELECT * FROM events WHERE session_id = ? ORDER BY created_at` → render as pipe-table
   - Direction: DB → file (events table is source of truth)

4. **task.md → DB (ingest on task creation)**
   - When: `/nitro-create-task` runs
   - How: after writing task.md + status file, call `upsert_task()` with metadata
   - Direction: file → DB (task.md is human-authored, DB mirrors metadata)

5. **handoff.md ↔ handoffs table (dual write)**
   - Build Worker writes handoff.md (file) AND calls `write_handoff()` (DB)
   - Review Worker reads from DB if cortex available, falls back to file
   - Both always written to keep fallback working

**Consistency enforcement:**
- `nitro-fueled status` command: reads all status files from disk, compares with DB, fixes drift
- Startup sync: supervisor reads status files + DB, reconciles differences (file wins for status — workers are authoritative)
- Warning log: if DB and file disagree, log the discrepancy before fixing

**What this ensures:**
- Users can always `cat task-tracking/TASK_X/status` and see truth
- Supervisor can always `query_tasks()` and get truth
- `git log` + files = full audit trail independent of DB
- DB crash = graceful fallback to file-based operation (no data loss)

## Dependencies

- TASK_2026_138 — cortex schema (tables must exist)
- TASK_2026_139 — supervisor DB migration (supervisor uses DB queries)

## Acceptance Criteria

- [ ] Worker status file writes are ingested into DB (file → DB sync)
- [ ] `nitro-fueled status` renders registry.md from DB when cortex available
- [ ] Session log.md rendered from events table at session end
- [ ] `/nitro-create-task` writes to both task.md file and tasks DB table
- [ ] handoff.md and handoffs table are dual-written (file + DB)
- [ ] Startup reconciliation: compare file status vs DB status, resolve conflicts (file wins)
- [ ] Drift detection: log warnings when file and DB disagree
- [ ] Graceful fallback: everything works file-only when cortex unavailable
- [ ] No data loss scenario: DB can be rebuilt entirely from files on disk

## References

- nitro-cortex: `libs/nitro-cortex/`
- Task creator command: `.claude/commands/nitro-create-task.md`
- CLI status command: `apps/cli/src/commands/status/`

## File Scope

- `libs/nitro-cortex/src/tools/` (sync utilities)
- `.claude/commands/nitro-create-task.md` (add DB write)
- `.claude/skills/orchestration/SKILL.md` (dual-write handoff)
- `.claude/skills/auto-pilot/SKILL.md` (startup reconciliation)
- `apps/cli/src/commands/status/` (render from DB)

## Parallelism

- Do NOT run in parallel with TASK_2026_133-139 (overlapping file scope across skills and cortex)
- Must be the last task in this chain
