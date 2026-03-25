# Task: Session-Scoped State Directories (Multi-Supervisor Support)

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

Currently `task-tracking/orchestrator-state.md` is a single file overwritten each session. This causes two problems:

1. **Cannot run 2 supervisors concurrently** -- they would clobber each other's state file
2. **Previous session state is lost** -- overwritten on next run, only `orchestrator-history.md` survives as a summary

### Solution: Session directories

Replace the single `orchestrator-state.md` with per-session directories:

```
task-tracking/
  sessions/
    SESSION_2026-03-24_22-00/
      state.md              # Live state for this session
      analytics.md          # Post-session analytics (TASK_032)
      worker-logs/          # Worker logs scoped to this session
    SESSION_2026-03-24_18-00/
      state.md              # Archived, read-only
      analytics.md
      worker-logs/
  orchestrator-history.md   # Append-only index across ALL sessions (unchanged)
  active-sessions.md        # Lists currently RUNNING session(s) with paths
```

### Changes required

**Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`):
1. On startup: create `sessions/SESSION_{timestamp}/` directory
2. Write `state.md` inside the session directory (not at `task-tracking/` root)
3. Register the session in `active-sessions.md` (path + status + start time)
4. Move worker logs to `sessions/SESSION_X/worker-logs/` instead of `.worker-logs/`
5. On stop: remove from `active-sessions.md`, finalize state as STOPPED
6. `orchestrator-history.md` continues as append-only cross-session summary (no change)

**Orchestration skill** (`.claude/skills/orchestration/SKILL.md`):
7. Worker log output path should use the session's `worker-logs/` directory

**CLI status command** (`packages/cli/`):
8. `npx nitro-fueled status` should read `active-sessions.md` to show live sessions
9. Should be able to browse `sessions/` for historical session state

**active-sessions.md format**:
```markdown
# Active Sessions

| Session | Started | Tasks | Concurrency | Path |
|---------|---------|-------|-------------|------|
| SESSION_2026-03-24_22-00 | 22:00 | 14 | 1 | sessions/SESSION_2026-03-24_22-00/ |
```

### Migration

- Delete `orchestrator-state.md` from root (no longer used)
- `.worker-logs/` at project root is deprecated; new logs go to session directories
- Existing `orchestrator-history.md` format unchanged

## Dependencies

- None (but TASK_2026_032 Post-Session Analytics should write `analytics.md` into the session directory once this is done)

## Acceptance Criteria

- [ ] Supervisor creates a `sessions/SESSION_{timestamp}/` directory on startup
- [ ] `state.md` is written inside the session directory, not at task-tracking root
- [ ] Worker logs are written to `sessions/SESSION_X/worker-logs/`
- [ ] `active-sessions.md` lists running sessions and is updated on start/stop
- [ ] Two supervisors can run concurrently without clobbering each other's state
- [ ] Previous sessions are preserved and browsable under `sessions/`
- [ ] `orchestrator-history.md` still works as append-only cross-session index
- [ ] `npx nitro-fueled status` reads active-sessions.md for live session info
- [ ] Old `orchestrator-state.md` at root is no longer created

## References

- `.claude/skills/auto-pilot/SKILL.md` -- supervisor startup, state file creation
- `.claude/skills/orchestration/SKILL.md` -- worker log output paths
- `task-tracking/orchestrator-state.md` -- current single-file state (to be replaced)
- `task-tracking/orchestrator-history.md` -- append-only history (unchanged)
- `TASK_2026_032` -- Post-Session Analytics (should target session directory)
