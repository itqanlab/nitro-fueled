# Task: Fix Auto-Pilot Multi-Session Support — DB Session Registration and Per-Session Concurrency

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | optional    |
| Poll Interval         | default     |
| Health Check Interval | default     |
| Max Retries           | default     |

## Dependencies

None

## Description

The auto-pilot supervisor has a multi-session conflict bug. When multiple auto-pilot sessions or `/orchestrate` sessions run concurrently (e.g., from different terminals), the supervisor fails to spawn workers because it creates a session directory on disk but never registers it in the cortex DB via `create_session()`. This causes `spawn_worker()` to return `session_not_found`.

Additionally, the concurrency slot calculation uses ALL active workers globally (`list_workers(status_filter='active')`) instead of filtering by session (`list_workers(session_id=X)`), which means one auto-pilot session sees another session's workers as consuming its slots.

### Root Causes

1. **Missing `create_session()` call** — The auto-pilot skill creates `task-tracking/sessions/SESSION_*/` on disk (Step 4a) but never calls `create_session()` MCP tool. Workers spawned with an unregistered session_id fail.

2. **Session ID format mismatch** — The auto-pilot generates its own timestamp-based ID (`SESSION_2026-03-30_05-41-42`) while `create_session()` returns a different format (`SESSION_2026-03-30T03-45-43`). These should be unified — use the DB-generated ID everywhere.

3. **Global concurrency instead of per-session** — `list_workers(status_filter='active')` returns ALL active workers across all sessions. The slot calculation should use `list_workers(session_id=X)` to count only this session's workers.

### Required Fixes

**Fix 1: Register session in cortex DB during pre-flight (Step 4a)**
- After creating the session directory, call `create_session(source='auto-pilot', task_count=N, config=JSON)`.
- Use the returned `session_id` as the canonical ID for the entire session.
- Rename the disk directory to match the DB session ID (or create it with the DB ID from the start).

**Fix 2: Unify session ID generation**
- Remove the local timestamp-based ID generation from the auto-pilot skill.
- Use `create_session()` as the single source of truth for session IDs.
- Update `state.md`, `log.md`, and `active-sessions.md` to use the DB-generated ID.

**Fix 3: Per-session concurrency calculation**
- Change the slot calculation in parallel-mode.md Step 4 from:
  `slots = concurrency_limit - list_workers(status='active').length`
  to:
  `slots = concurrency_limit - list_workers(session_id=THIS_SESSION, status='active').length`
- This allows infinite concurrent auto-pilot sessions, each managing its own worker pool.

**Fix 4: `claim_task()` as cross-session guard**
- Document that `claim_task(task_id, session_id)` is the deduplication mechanism.
- If two sessions try to claim the same task, only one wins. The losing session skips that task and picks the next candidate.
- This is already implemented but not documented as the multi-session guard.

## Acceptance Criteria

- [ ] Auto-pilot calls `create_session()` during pre-flight and uses the DB-generated session ID
- [ ] Session directory on disk matches the DB session ID
- [ ] Concurrency slot calculation filters by session_id, not global
- [ ] Two auto-pilot sessions can run concurrently without blocking each other
- [ ] `claim_task()` prevents duplicate task assignment across sessions

## File Scope

- `.claude/skills/auto-pilot/references/parallel-mode.md` (modified — count active workers per session and document `claim_task(task_id, SESSION_ID)` as the cross-session guard)
- `.claude/skills/auto-pilot/references/session-lifecycle.md` (modified — require `create_session()` before disk session artifacts and use DB-issued supervisor session IDs)
- `.claude/skills/auto-pilot/SKILL.md` (modified — reinforce DB-backed session identity as the canonical source for multi-session supervision)
- `.claude/commands/nitro-auto-pilot.md` (modified — use DB-backed supervisor session ID format and create the DB session during initialization)
- `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` (modified — mirror DB session registration and DB-issued session ID usage)
- `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` (modified — mirror per-session slot calculation and claim-task dedupe guidance)
- `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md` (modified — mirror DB session ID format and create-session startup guidance)
- `task-tracking/TASK_2026_165/task-description.md` (new — PM requirements artifact)
- `task-tracking/TASK_2026_165/plan.md` (new — architecture/implementation plan)
- `task-tracking/TASK_2026_165/tasks.md` (new — completed development batch list)

## Parallelism

- Can run in parallel with other tasks
- No file scope overlap with active tasks
