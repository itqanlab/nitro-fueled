# Handoff — TASK_2026_119

## Files Changed
- .claude/commands/nitro-burn.md (new, 136 lines)
- apps/cli/scaffold/.claude/commands/nitro-burn.md (new, 136 lines — scaffold sync)

## Commits
- eb19a13: feat(commands): add /nitro-burn token and cost analytics command

## Decisions
- Command is read-only (no file modifications) — burn reports are display-only
- Token/cost data sourced from MCP `list_workers` as primary, with fallback chain to `orchestrator-history.md` for cost and `session-analytics.md` for timing — this handles both MCP-active and MCP-offline scenarios gracefully
- `session-analytics.md` files do NOT contain token/cost data (per orchestration SKILL.md design); the command acknowledges this with a Cost Note explaining the data source requirement
- Three CLI flags: no args (all), `--since` (date filter), `--task` (single task) — mirrors the retrospective command's scope pattern for consistency
- Outcome enum values use exact casing from status state machine: COMPLETE, IMPLEMENTED, FAILED, STUCK

## Known Risks
- Cost data will show `—` for all tasks until nitro-cortex MCP is running during task execution — this is by design and documented in the Cost Note output
- `orchestrator-history.md` currently stores `unknown` for all Cost values — the command handles this gracefully but users may see all-`—` cost columns without MCP
