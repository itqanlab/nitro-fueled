# Task: Session-Scoped State Directories with Unified Event Log

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

Currently `task-tracking/orchestrator-state.md` is a single file overwritten each session. This causes three problems:

1. **Cannot run 2 supervisors concurrently** -- they would clobber each other's state file
2. **Previous session state is lost** -- overwritten on next run, only `orchestrator-history.md` survives as a summary
3. **No unified logging** -- auto-pilot writes session logs, but direct `/orchestrate` writes nothing at the session level. Future orchestration methods have no standard to follow.

### Solution: Session directories + unified event log

Replace the single `orchestrator-state.md` with per-session directories. Add a unified `log.md` that ALL orchestration paths write to in the same format.

```
task-tracking/
  sessions/
    SESSION_2026-03-24_22-00/
      state.md              # Live state for this session (auto-pilot only)
      log.md                # Unified event log — ALL orchestration writes here
      analytics.md          # Post-session analytics (TASK_032)
      worker-logs/          # Worker logs scoped to this session
    SESSION_2026-03-24_18-00/
      state.md
      log.md
      analytics.md
      worker-logs/
  orchestrator-history.md   # Append-only index across ALL sessions (unchanged)
  active-sessions.md        # Lists currently RUNNING session(s) with paths
```

### Unified log format (`log.md`)

Every orchestration path — auto-pilot, direct `/orchestrate`, future methods — appends to `log.md` in the same format:

```markdown
| Timestamp | Source | Event |
|-----------|--------|-------|
| 10:00:05  | auto-pilot | SPAWNED abc-123 for TASK_X (Build: FEATURE) |
| 10:05:00  | orchestrate | PM phase complete for TASK_Y |
| 10:12:00  | auto-pilot | HEALTH CHECK — TASK_X: healthy (46 msgs) |
| 10:15:00  | orchestrate | Architect phase complete for TASK_Y |
| 10:20:00  | auto-pilot | BUILD DONE — TASK_X: IMPLEMENTED |
```

The `Source` column identifies which orchestration method produced the entry. The dashboard, CLI status, and analytics can all query the same file regardless of how work was orchestrated.

### Changes required

**Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`):
1. On startup: create `sessions/SESSION_{timestamp}/` directory
2. Write `state.md` inside the session directory (not at `task-tracking/` root)
3. Append events to `log.md` with source `auto-pilot` (same events as today's session log)
4. Register the session in `active-sessions.md` (path + status + start time)
5. On stop: remove from `active-sessions.md`, finalize state as STOPPED
6. `orchestrator-history.md` continues as append-only cross-session summary (no change)

**Orchestration skill** (`.claude/skills/orchestration/SKILL.md`):
7. On startup: create or reuse a session directory, append to `log.md` with source `orchestrate`
8. Log phase transitions: PM, Architect, Dev batches, Review, QA

**active-sessions.md format**:
```markdown
# Active Sessions

| Session | Source | Started | Tasks | Path |
|---------|--------|---------|-------|------|
| SESSION_2026-03-24_22-00 | auto-pilot | 22:00 | 14 | sessions/SESSION_2026-03-24_22-00/ |
| SESSION_2026-03-24_22-05 | orchestrate | 22:05 | 1 | sessions/SESSION_2026-03-24_22-05/ |
```

### Migration

- Delete `orchestrator-state.md` from root (no longer used)
- Existing `orchestrator-history.md` format unchanged

## Dependencies

- None (but TASK_2026_032 Post-Session Analytics should write `analytics.md` into the session directory once this is done)

## Acceptance Criteria

- [ ] Supervisor creates a `sessions/SESSION_{timestamp}/` directory on startup
- [ ] `state.md` is written inside the session directory, not at task-tracking root
- [ ] `log.md` exists in the session directory with unified event format
- [ ] Auto-pilot appends to `log.md` with source `auto-pilot`
- [ ] Orchestration skill appends to `log.md` with source `orchestrate`
- [ ] `active-sessions.md` lists running sessions and is updated on start/stop
- [ ] Two supervisors can run concurrently without clobbering each other's state
- [ ] Previous sessions are preserved and browsable under `sessions/`
- [ ] `orchestrator-history.md` still works as append-only cross-session index
- [ ] Old `orchestrator-state.md` at root is no longer created

## References

- `.claude/skills/auto-pilot/SKILL.md` -- supervisor startup, state file creation, session log
- `.claude/skills/orchestration/SKILL.md` -- needs phase-level logging added
- `task-tracking/orchestrator-state.md` -- current single-file state (to be replaced)
- `task-tracking/orchestrator-history.md` -- append-only history (unchanged)
- `TASK_2026_032` -- Post-Session Analytics (should target session directory)

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/orchestration/SKILL.md`
- `task-tracking/active-sessions.md`
