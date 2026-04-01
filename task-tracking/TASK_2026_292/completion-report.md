# Completion Report — TASK_2026_292

## Summary

Added `skill_invocations` table to the cortex DB and two MCP tools for logging and querying skill usage. Workers can emit `SKILL_INVOKED` events via `emit_event` and the cortex server automatically writes them to the table. Direct logging is also available via the `log_skill_invocation` tool.

## What Was Built

- **`skill_invocations` table** in `schema.ts` — schema with `skill_name`, `session_id`, `worker_id`, `task_id`, `invoked_at`, `duration_ms`, `outcome` columns and 4 indexes
- **Migration file** `002_skill_invocations.sql` — reference SQL for manual migrations
- **`analytics.ts`** — new tool file with `handleLogSkillInvocation` (direct insert) and `handleGetSkillUsage` (aggregated counts by skill with period filtering)
- **`subscriptions.ts` update** — `handleEmitEvent` now intercepts `SKILL_INVOKED` label and writes to `skill_invocations` automatically
- **`index.ts` update** — registers `log_skill_invocation` and `get_skill_usage` MCP tools

## Acceptance Criteria

- [x] skill_invocations table created with migration
- [x] log_skill_invocation MCP tool inserts rows correctly
- [x] get_skill_usage returns aggregated counts per skill with period filtering
- [x] SKILL_INVOKED events from emit_event are captured in the table

## Review Results

Reviews skipped per user instruction (interactive session, no reviewers).

## Test Results

TypeScript compilation clean (`tsc --noEmit` passed with zero errors).

## Files Changed

5 files: `schema.ts` (modified), `002_skill_invocations.sql` (new), `analytics.ts` (new), `subscriptions.ts` (modified), `index.ts` (modified)

## Follow-on Tasks

None identified.
