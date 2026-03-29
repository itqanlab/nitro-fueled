# Task: Supervisor DB migration — query cortex instead of reading files

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | REFACTORING          |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Part 3 of 4 — Supervisor-Worker Communication Overhaul.

Migrate the supervisor's core loop to query nitro-cortex DB instead of reading files for structured data. This combines the event-driven loop optimization (TASK_2026_135 concept) with the DB layer (TASK_2026_138).

**What changes in the supervisor loop:**

1. **Task picking** — Replace "read registry.md + parse + filter" with `query_tasks(status='CREATED')` → returns only matching rows (~200 bytes vs ~5-10KB)

2. **Status checks** — Replace "read N status files" with `query_tasks(task_id=X)` → single query vs N file reads

3. **Dependency resolution** — Query `tasks` table with JOIN on dependencies instead of reading each task.md for Dependencies field

4. **Event logging** — Replace log.md append with `log_event()` → queryable, no file I/O on supervisor side. Render log.md from DB at session end for human audit trail.

5. **Session state** — Replace state.md overwrite with `upsert_session()` (existing cortex tool) → no file management for compaction recovery

6. **Worker handoff** — When spawning Review Worker, include handoff data from `read_handoff(task_id)` in the worker prompt (~1KB structured vs Review Worker re-discovering ~50-100KB)

7. **History** — Replace orchestrator-history.md append with `log_event(event_type='TASK_COMPLETE')` → queryable analytics

**Fallback**: When cortex is unavailable (cortex_available = false), fall back to file-based reads (current behavior). The supervisor already has cortex_available detection from TASK_2026_122.

**Files removed from supervisor hot path:**
- registry.md reads (replaced by query_tasks)
- plan.md repeated reads (read once at startup, cache; query events for REPRIORITIZE)
- state.md overwrites (replaced by upsert_session)
- orchestrator-history.md appends (replaced by log_event)
- Per-loop status file reads (replaced by query_tasks)

**Bidirectional signals (optional, default off):**
- `escalate_to_user` config option, default `false`
- When false: workers fail autonomously, supervisor retries or blocks
- When true: worker can call `log_event(event_type='NEED_INPUT', data={question})`, supervisor surfaces to user
- Signal check happens at phase boundaries in orchestration skill (between PM → Architect → Dev)

## Dependencies

- TASK_2026_134 — SKILL.md split (so changes go into reference files)
- TASK_2026_138 — cortex schema (tables must exist)

## Acceptance Criteria

- [ ] Supervisor queries `query_tasks` instead of reading registry.md in the core loop
- [ ] Supervisor queries `query_tasks` for status instead of reading per-task status files
- [ ] Dependency graph built from `tasks` table query, not file reads
- [ ] Events logged via `log_event` instead of appending to log.md
- [ ] log.md rendered from DB at session end (human-readable audit trail preserved)
- [ ] Session state persisted via cortex instead of state.md overwrites
- [ ] orchestrator-history.md replaced by `query_events` (no more global append-only file)
- [ ] Fallback to file-based reads when cortex_available = false
- [ ] `escalate_to_user` config option added, default false
- [ ] Token savings verified: supervisor loop overhead reduced by ~95% (108KB/hour → ~5KB/hour)

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md` (or references/ after 134)
- nitro-cortex: `libs/nitro-cortex/`
- Token burn analysis from conversation on 2026-03-29

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` (or `references/parallel-mode.md` after 134)
- `.claude/skills/auto-pilot/references/sequential-mode.md` (after 134)

## Parallelism

- Do NOT run in parallel with TASK_2026_133-136 (same auto-pilot files)
- Can run in parallel with TASK_2026_137 (different files — orchestration vs auto-pilot)
