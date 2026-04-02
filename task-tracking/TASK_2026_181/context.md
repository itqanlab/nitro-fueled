# Context — TASK_2026_181

## User Request
Replace all stale `session-orchestrator` references with `nitro-cortex` in scaffold files under `apps/cli/scaffold/.claude/`.

## Strategy
BUGFIX (Simple) — auto-approve all checkpoints.

## Agent Sequence
Build Worker -> Dev (nitro-systems-developer)

## Key Constraints
- Preserve backward-compat fallback in `apps/cli/src/utils/mcp-config.ts`
- Only scaffold files in scope
- 17 occurrences across 5 files
