# Task: Supervisor Must Track and Report Cost/Usage Per Session

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P0-Critical |
| Complexity | Medium      |

## Description

The session orchestrator MCP server already calculates per-worker cost (token-calculator.ts, get_worker_stats, get_worker_activity), but the auto-pilot supervisor never reads this data. The orchestrator-state.md and orchestrator-history.md contain zero cost/token information, despite the SKILL.md template specifying `**Total Cost**: ${X.XX}` and a `| Cost |` column.

This is critical for a tool that spawns multiple AI workers -- users need to know what each run costs.

Note: TASK_2026_019 covers fixing print-mode token tracking in the MCP server. This task covers the supervisor side -- reading cost data from MCP and writing it to orchestrator state files.

### What needs to happen

1. When a worker completes (or is killed), supervisor must call `get_worker_stats` to get final cost
2. Write per-worker cost to `orchestrator-state.md` (Active/Completed Workers tables)
3. Write per-worker cost to `orchestrator-history.md` (Workers Spawned table)
4. Calculate and write total session cost at supervisor stop
5. Include cost in worker log files
6. Add cost data to the Session Log events

## Dependencies

- TASK_2026_019 -- Fix Print Mode Token/Cost Tracking (MCP server side)

## Acceptance Criteria

- [ ] Supervisor reads cost from `get_worker_stats` when worker completes or is killed
- [ ] `orchestrator-state.md` Completed Tasks table includes cost per worker
- [ ] `orchestrator-history.md` Workers Spawned table includes Cost column with real values
- [ ] `orchestrator-history.md` includes `**Total Cost**: $X.XX` with real value
- [ ] Worker log files include final token count and cost
- [ ] Total session cost is calculated and displayed at supervisor stop

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-8, ENH-2
- `.claude/skills/auto-pilot/SKILL.md` -- supervisor loop, state file templates
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/token-calculator.ts` -- cost calculation
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts` -- cost data source
- `TASK_2026_019` -- MCP server side fix for print-mode token tracking
