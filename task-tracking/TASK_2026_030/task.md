# Task: Unify All Timestamps to Local Time with Timezone Offset

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P3-Low      |
| Complexity | Simple      |

## Description

During e2e testing, orchestrator-state.md shows `Session Started: 2026-03-24 18:05:39` while git log shows `2026-03-24 20:05:39 +0200` for the same moment. The 2-hour difference (UTC vs UTC+2) is confusing when debugging.

All timestamps across the system should use the same format: `YYYY-MM-DD HH:MM:SS +-ZZZZ` (local time with timezone offset), matching git's default format.

### Affected locations

1. `orchestrator-state.md` -- Session Started, Last Updated, Session Log timestamps
2. `orchestrator-history.md` -- Session header, Event Log timestamps
3. `.worker-logs/` -- log file names use ISO UTC format (`T18-05-39-178Z`)
4. Worker spawn/kill messages in auto-pilot SKILL.md

## Dependencies

- None

## Acceptance Criteria

- [ ] All orchestrator-state.md timestamps include timezone offset
- [ ] All orchestrator-history.md timestamps include timezone offset
- [ ] Worker log filenames use local time with offset (or at least match orchestrator state)
- [ ] Auto-pilot skill instructions specify the timestamp format to use
- [ ] Timestamps are consistent with git log output when compared side-by-side

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-5, ENH-8
- `.claude/skills/auto-pilot/SKILL.md` -- timestamp generation
- Test project `task-tracking/orchestrator-state.md` -- evidence of mismatch
