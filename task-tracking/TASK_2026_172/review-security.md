# Security Review — TASK_2026_172

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 10                                   |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | New statuses present in all allowlists and Zod enums |
| Path Traversal           | PASS   | No new file path operations introduced by this task |
| Secret Exposure          | PASS   | No credentials or tokens in any changed file |
| Injection (shell/prompt) | FAIL   | `get_tasks`/`query_tasks` accept status as free `z.string()` — no allowlist enforced at the MCP input layer |
| Insecure Defaults        | FAIL   | Existing `cortex-db-init.ts` CHECK constraint only applies to new databases; FIXING cannot be stored in existing DBs (disclosed in handoff as Known Risk) |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: MCP `get_tasks`/`query_tasks` status filter is unvalidated at the input schema layer

- **File**: `packages/mcp-cortex/src/index.ts:45-63` (inputSchema for `get_tasks` and `query_tasks`)
- **Problem**: Both tools declare `status: z.string().optional()` in their input schemas. The value is passed verbatim to `handleGetTasks` in `packages/mcp-cortex/src/tools/tasks.ts:66-68`, which builds a parameterized `WHERE status = ?` query without first validating that the value is a member of the canonical status enum. The SQL injection surface is safely neutralized by SQLite's parameterized queries (`?` placeholder), so there is no SQL injection risk. However, the absence of an allowlist means:
  1. Any caller can filter on invented status strings (e.g., `status=DELETED`) and receive an empty result set that looks like a legitimate "no tasks with this status" response, which can mislead orchestration logic.
  2. The `release_task` tool (`index.ts:77`) uses `z.enum([...])` with all nine statuses — the more defensive pattern. The `get_tasks` / `query_tasks` tools were not updated to the same level of rigor when FIXING was added.
- **Impact**: No direct data breach or injection — the SQLite driver uses bind parameters. The risk is incorrect orchestration behavior: a supervisor querying `status=FIXING` with a stale or misspelled string gets a silent empty response rather than an error, potentially causing tasks to be double-claimed or skipped.
- **Fix**: Change the `get_tasks` and `query_tasks` input schemas from `z.string().optional()` to `z.enum(['CREATED','IN_PROGRESS','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED']).optional()` — matching the pattern already used in `release_task`. Apply the same tightening to the `type` and `priority` filter parameters while there.

## Minor Issues

### Minor 1: Existing-database migration gap for FIXING status in `cortex-db-init.ts`

- **File**: `apps/cli/src/utils/cortex-db-init.ts:63`
- **Problem**: The `CREATE TABLE IF NOT EXISTS tasks` DDL now includes `FIXING` in the `status` CHECK constraint, but this change has no effect on databases that already exist. The `applyMigrations` helper (lines 20-39) can only add columns, not modify CHECK constraints. Any running instance with a pre-existing cortex DB will reject `UPDATE tasks SET status = 'FIXING'` with a SQLite constraint error.
- **Impact**: Worker transitions to FIXING status silently fail with a DB error on existing deployments, leaving the task stuck in its prior state. This is acknowledged in the handoff as a known risk, but there is no migration guard or runtime error surface to alert operators.
- **Fix**: Add a startup check that attempts `INSERT INTO tasks(id,...,status) VALUES('__probe__',...,'FIXING')` inside a transaction that is immediately rolled back. If the insert is rejected, emit a clear warning: `[nitro-cortex] WARNING: existing DB does not support FIXING status — run ALTER TABLE or delete .nitro/cortex.db to rebuild`. This surfaces the silent failure mode without requiring a destructive migration.

### Minor 2: `get_tasks` SQL injection surface note (defense-in-depth)

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:66-83`
- **Problem**: The `status`, `type`, and `priority` values from `args` are inserted into the WHERE clause via bind parameters (`conditions.push('status = ?'); params.push(args.status)`), which is correct and safe. This is flagged for completeness as a defense-in-depth observation: if the bind-parameter pattern were ever refactored to string interpolation (e.g., during a future ORM migration), the lack of an allowlist at the input layer would immediately open an injection surface. The Serious Issue above (input schema tightening) would close this residual risk.
- **Impact**: None under current implementation — purely a future-refactoring risk.
- **Fix**: Addressed by the fix described in Serious Issue 1.

## Files Reviewed

| File | Verdict |
|------|---------|
| `apps/dashboard/src/app/models/project-queue.model.ts` | PASS — FIXING and CANCELLED added to `QueueTaskStatus` union |
| `apps/dashboard/src/app/models/dashboard.model.ts` | PASS — FIXING and CANCELLED added to `TaskStatusKey` and `TaskStatusBreakdown` |
| `apps/dashboard/src/app/services/api.service.ts` | PASS — `VALID_TASK_STATUSES` allowlist includes both new statuses; `isValidTaskStatus` guard applied before HTTP params are set |
| `apps/dashboard/src/app/views/project/project.component.ts` | PASS — kanban column list, filter dropdown, `statusClassMap`, and `statusLabelMap` all updated |
| `apps/dashboard/src/app/views/dashboard/dashboard.component.ts` | PASS — `statusClassMap` and `totalTasks` computed signal updated |
| `apps/cli/src/utils/cortex-sync-tasks.ts` | PASS — `VALID_STATUSES` set includes FIXING and CANCELLED; used as allowlist before DB writes |
| `apps/cli/src/utils/cortex-db-init.ts` | PASS (with Minor 1) — DDL updated; existing-DB gap documented in handoff |
| `packages/mcp-cortex/src/tools/context.ts` | PASS — `validStatuses` array at line 442 updated with FIXING; used as allowlist before `UPDATE tasks SET status` |
| `packages/mcp-cortex/src/index.ts` | FAIL (Serious 1) — `release_task` correctly uses `z.enum`; `get_tasks`/`query_tasks` still use `z.string()` for status |
| `apps/cli/src/utils/claude-md.ts` | PASS — documentation template only; no security-sensitive logic |

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: The `get_tasks`/`query_tasks` MCP tools accept an unvalidated `status` string at the Zod input layer. SQLite parameterized binding prevents SQL injection, but tightening to `z.enum` (matching `release_task`) closes the residual orchestration-correctness gap and is a low-effort fix. The existing-database migration gap for the FIXING CHECK constraint is a deployment risk disclosed in the handoff; a startup probe would surface it cleanly.
