# Task Description — TASK_2026_154

## Objective

Refactor the auto-pilot supervisor documentation so the cortex-backed loop is stateless during monitoring. The supervisor must rebuild its view from MCP DB queries on every tick instead of carrying file-backed state in context.

## Requirements

1. Rewrite the parallel-mode core loop so task state comes from `get_tasks()` and `get_pending_events()`.
2. Remove `state.md` read/write behavior from the live loop on the cortex path. `state.md` becomes a debug artifact only.
3. Remove `log.md` append behavior from the live loop on the cortex path. Use MCP event logging or skip file logging.
4. Ban `registry.md`, task `status` files, and `task.md` from the live loop when the cortex DB is available.
5. Update compaction recovery guidance so recovery is DB re-query (`list_workers()` + `get_tasks()`), not `state.md` recovery.
6. Keep the file-based fallback path documented for `cortex_available = false`.
7. Mirror shipped `.claude` changes into the scaffold copy under `apps/cli/scaffold/.claude/skills/auto-pilot/` where those files exist.

## Acceptance Criteria

- `parallel-mode.md` documents DB-only task-state reads on the cortex path.
- `parallel-mode.md` removes live-loop `state.md` and `log.md` writes on the cortex path.
- `SKILL.md` bans `registry.md`, task `status` files, and `task.md` inside the live supervisor loop.
- `SKILL.md` documents DB-based compaction recovery.
- `session-lifecycle.md` demotes `state.md` and `log.md` to debug/rendered artifacts on the cortex path.
