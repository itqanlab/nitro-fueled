# Task: Post-Session Analytics and Worker Log Enrichment

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Medium      |

## Description

Current worker logs are minimal (just an exit summary paragraph and exit code). The orchestrator state tracks events but not analytics. After a session completes, there's no single view of what happened, what it cost, and what could be improved.

### Part A -- Worker Log Enrichment

Enhance `.worker-logs/` files to include:
- Timestamp for each phase transition (PM -> Architect -> Dev -> QA)
- Token count at exit (from MCP get_worker_stats)
- Cost at exit
- Files modified list (from git diff)
- Review score (for review workers -- initial score before fixes)
- Duration

### Part B -- Post-Session Analytics

After supervisor stops, generate a `session-analytics.md` in `task-tracking/`:
- Total duration, cost, tokens
- Per-task breakdown (build cost + review cost)
- Failure rate and retry stats
- Review scores before/after fixes
- Lessons generated count
- Worker efficiency metrics (tokens per file changed, cost per task)

This depends on TASK_2026_026 (cost tracking) being done first.

## Dependencies

- TASK_2026_026 -- Supervisor cost tracking (provides the cost data to write)

## Acceptance Criteria

- [ ] Worker logs include phase timestamps, token count, cost, files modified, and duration
- [ ] Review worker logs include initial review score
- [ ] `session-analytics.md` generated at supervisor stop
- [ ] Analytics include total and per-task cost/duration/token breakdown
- [ ] Analytics include failure/retry stats
- [ ] Analytics include review scores summary

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- ENH-5, ENH-6
- `.claude/skills/auto-pilot/SKILL.md` -- supervisor stop logic
- Test project `.worker-logs/` -- current minimal format
