# Task: Supervisor — File-System-First Reconciliation When MCP Returns Empty

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P1-High     |
| Complexity | Simple      |

## Description

When the MCP session-orchestrator server restarts mid-session (or when a new Claude session picks up a previously saved supervisor state), `list_workers` returns an empty list. The current reconciliation logic in Step 1 of the auto-pilot supervisor skill treats any worker "in state but NOT in MCP list" as finished and immediately triggers the completion handler. This is wrong when MCP simply lost its in-memory state — the worker processes may still be running, and calling the completion handler at this point produces incorrect state transitions and potentially duplicate worker spawns.

The fix: when `list_workers` returns empty but `state.md` has active workers, the supervisor must not assume those workers are done. Instead, it should inspect the file system (registry state, task folder artifacts) to infer what actually happened, and only treat a worker as "finished" if there is positive evidence of completion — not just absence from MCP.

### What to change

In `.claude/skills/auto-pilot/SKILL.md`, update the **Step 1: Read State (Recovery Check)** reconciliation rule:

**Current rule:**
> Worker in state but NOT in MCP list: Treat as finished. Trigger the completion handler (Step 7) for that worker's task.

**New rule:**

> **Worker in state but NOT in MCP list:**
>
> Before triggering the completion handler, check the file system for evidence of completion:
>
> | Worker Type   | Evidence of completion |
> |--------------|------------------------|
> | Build Worker  | Registry shows IMPLEMENTED or COMPLETE, OR `tasks.md` exists with all batches COMPLETE |
> | ReviewLead    | `review-context.md` exists with `## Findings Summary` section |
> | TestLead      | `test-report.md` exists in the task folder |
> | FixWorker     | Registry shows COMPLETE |
> | CompletionWorker | Registry shows COMPLETE |
>
> **If evidence of completion is found:** Trigger the completion handler (Step 7) — the worker finished and MCP just lost state.
>
> **If NO evidence of completion is found AND `list_workers` returned a completely empty list (zero workers total):** This likely indicates an MCP restart, not worker completion. Do NOT trigger the completion handler. Instead:
> - Log: `"MCP RESTART SUSPECTED — {N} active workers in state but MCP returned empty. Waiting for file-system evidence before triggering completion."`
> - Leave all active workers in state as-is with status `"unknown"`.
> - On the next monitoring interval, re-call `list_workers`. If workers reappear (MCP recovered), resume normal monitoring. If still empty after 2 consecutive checks AND still no file-system evidence, then treat as failed and trigger Worker Recovery Protocol.
>
> **If NO evidence AND `list_workers` returned a non-empty list (some workers visible, others missing):** The missing worker genuinely finished or crashed. Trigger completion handler as before.

Also add a new field `mcp_empty_count` to `{SESSION_DIR}state.md` (top-level integer, default 0) that tracks consecutive `list_workers` empty-list responses when active workers are expected. Reset to 0 as soon as any worker appears or file-system evidence is found.

## Dependencies

- None (can run concurrently with TASK_2026_059)

## Parallelism

Can run in parallel with TASK_2026_059. Both are independent changes.

## Acceptance Criteria

- [ ] When MCP returns empty but `state.md` has active workers with no file-system evidence of completion, supervisor logs "MCP RESTART SUSPECTED" and does NOT trigger completion handler
- [ ] After 2 consecutive empty MCP responses with no file-system evidence, supervisor triggers Worker Recovery Protocol (not immediate failure — 2-check grace period)
- [ ] When MCP returns empty but file-system evidence IS found (e.g. registry shows IMPLEMENTED), supervisor correctly triggers completion handler
- [ ] When MCP returns non-empty and a specific worker is missing, existing behavior is unchanged (treat as finished immediately)
- [ ] `mcp_empty_count` field appears in `state.md` and resets to 0 when workers reappear
- [ ] No regression: normal compaction recovery (worker missing because MCP was never involved) still works correctly

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` — update Step 1 reconciliation rule and add `mcp_empty_count` to state format
