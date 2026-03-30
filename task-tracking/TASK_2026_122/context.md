# Context — TASK_2026_122

## Task
nitro-cortex — Skill Integration (Part 3 of 3)

## User Intent
Migrate auto-pilot and orchestration skills to use `nitro-cortex` MCP tools instead of reading/writing markdown files. This is the payoff phase — agents query exactly what they need instead of loading large files into context.

## Strategy
REFACTORING → Architect → Team-Leader → Dev → Review → Fix → Complete

## Codebase State
- `packages/mcp-cortex/` — fully built (TASK_2026_120, TASK_2026_121 COMPLETE)
- MCP tools available: `get_tasks`, `claim_task`, `release_task`, `update_task`, `get_next_wave`, `sync_tasks_from_files`, `create_session`, `get_session`, `update_session`, `list_sessions`, `end_session`, `spawn_worker`, `list_workers`, `get_worker_stats`, `get_worker_activity`, `kill_worker`, `subscribe_worker`, `get_pending_events`
- `apps/cli/src/utils/mcp-configure.ts` — currently configures session-orchestrator only
- `apps/cli/src/utils/mcp-setup-guide.ts` — buildMcpConfigEntry() builds session-orchestrator entry
- `apps/cli/scaffold/.claude/settings.json` — does NOT exist yet

## Files to Change
1. `.claude/skills/auto-pilot/SKILL.md` — replace Steps 2-7 file-based state with nitro-cortex calls
2. `.claude/skills/orchestration/SKILL.md` — workers use update_task() for status transitions
3. `apps/cli/src/commands/init.ts` / `apps/cli/src/utils/mcp-configure.ts` — add nitro-cortex support
4. `apps/cli/scaffold/.claude/settings.json` — create with nitro-cortex config

## Dependencies Status
- TASK_2026_121: COMPLETE ✓
- TASK_2026_107: CREATED (touches same skill files — potential merge conflict, noted)
- TASK_2026_112: CREATED (touches auto-pilot SKILL.md — potential merge conflict, noted)

## Session
SESSION_2026-03-29_12-11-38
