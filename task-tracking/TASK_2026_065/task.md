# Task: Orchestration Analytics — Per-Run Token and Cost Logging

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P2-Medium |
| Complexity | Simple  |
| Model      | default |
| Testing    | skip    |

## Description

Standalone `/orchestrate` runs produce no token or cost data — everything is lost when the session ends or the MCP server restarts. The only way to know what a worker spent was to catch it live in the Claude Code interface. This makes post-hoc cost analysis and debugging impossible for the majority of runs (which are not managed by the Supervisor).

The fix: at the end of every orchestration run (whether spawned by the Supervisor or run directly via `/orchestrate`), the orchestration skill writes a `session-analytics.md` file to `task-tracking/TASK_YYYY_NNN/`. This file captures tokens, cost, duration, phases, and outcome using the same data available inside the Claude Code session. The Supervisor's Step 7h worker-log writer is updated to read `session-analytics.md` as a fallback when MCP stats are unavailable (e.g., after an MCP restart), instead of logging all metrics as `"unknown"`.

### What to build

1. **`session-analytics.md` write step in orchestration SKILL.md** — add a final step that runs after the Completion phase (or on failure/abort). It writes `task-tracking/TASK_YYYY_NNN/session-analytics.md` with this structure:

```markdown
# Session Analytics — TASK_YYYY_NNN

| Field | Value |
|-------|-------|
| Task | TASK_YYYY_NNN |
| Outcome | IMPLEMENTED | COMPLETE | FAILED | STUCK |
| Start Time | YYYY-MM-DD HH:MM:SS +ZZZZ |
| End Time | YYYY-MM-DD HH:MM:SS +ZZZZ |
| Duration | Nm |
| Phases Completed | PM, Architect, Dev, QA (comma-separated, omit skipped) |
| Files Modified | N |
```

Token and cost fields are written as `unknown` if not derivable from within the session context (they may only be available via MCP). The file is written on every exit path: success, failure, stuck kill, and manual stop.

2. **Supervisor Step 7h fallback** — in `.claude/skills/auto-pilot/SKILL.md`, update Step 7h "Fetch exit stats" to: if `get_worker_stats` fails, check for `task-tracking/TASK_YYYY_NNN/session-analytics.md` and extract Duration and Outcome as fallback values before defaulting to `"unknown"`.

## Dependencies

- None

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_060 — both modify `.claude/skills/auto-pilot/SKILL.md`
🚫 Do NOT run in parallel with TASK_2026_064 — both modify `.claude/skills/auto-pilot/SKILL.md`

Suggested execution wave: after TASK_2026_060 and TASK_2026_064 complete.

## Acceptance Criteria

- [ ] After any `/orchestrate` run (direct or via Supervisor), `task-tracking/TASK_YYYY_NNN/session-analytics.md` exists
- [ ] File contains Outcome, Start Time, End Time, Duration, and Phases Completed
- [ ] File is written on all exit paths: success, failure, and stuck/killed
- [ ] Supervisor Step 7h reads `session-analytics.md` as fallback when `get_worker_stats` fails — Duration and Outcome appear in worker-log instead of `"unknown"`

## References

- `.claude/skills/orchestration/SKILL.md` — add analytics write step
- `.claude/skills/auto-pilot/SKILL.md` — Step 7h fallback logic
- `task-tracking/sessions/SESSION_*/worker-logs/` — existing worker-log format for reference

## File Scope

- `.claude/skills/orchestration/SKILL.md` — add session-analytics.md write step at end of run
- `.claude/skills/auto-pilot/SKILL.md` — update Step 7h to use session-analytics.md as fallback
