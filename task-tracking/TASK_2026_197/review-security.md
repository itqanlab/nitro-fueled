# Security Review — TASK_2026_197

## Score: 8/10

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 5                                    |

Files reviewed:
- `packages/mcp-cortex/src/tools/tasks.ts`
- `packages/mcp-cortex/src/index.ts`
- `packages/mcp-cortex/src/tools/tasks.spec.ts`
- `.claude/skills/auto-pilot/references/cortex-integration.md`
- `.claude/skills/auto-pilot/references/parallel-mode.md`

Scaffold copies (`apps/cli/scaffold/.claude/skills/auto-pilot/references/cortex-integration.md` and `parallel-mode.md`) are listed in `handoff.md` but not in the task's File Scope. Not reviewed — out of scope, not flagged.

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `handleGetTasks` does not validate `args.status` against the `VALID_STATUSES` whitelist at the handler level; relies entirely on Zod layer in `index.ts` |
| Path Traversal           | PASS   | No fs operations accept user-controlled paths in the changed code |
| Secret Exposure          | PASS   | No credentials, API keys, or tokens found in any in-scope file |
| Injection (shell/prompt) | PASS   | SQL uses parameterized placeholders throughout; `LIMIT` value goes into `params` array, not interpolated; no shell execution; no prompt injection vectors in markdown files |
| Insecure Defaults        | FAIL   | The `unblocked=true` path issues an unbounded `SELECT id FROM tasks WHERE status = 'COMPLETE'` regardless of the `limit` parameter |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Unbounded COMPLETE-Tasks Query Bypasses the `limit` Guard When `unblocked=true`

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:91`
- **Problem**: When `args.unblocked` is `true`, `handleGetTasks` fires a second, fully unbounded query — `SELECT id FROM tasks WHERE status = 'COMPLETE'` — to build the dependency resolution set. This query has no `LIMIT` clause and is not constrained by the `limit` parameter introduced in this task. A supervisor calling `get_tasks(unblocked: true)` with a codebase containing hundreds or thousands of `COMPLETE` tasks will pull every row into memory on every monitoring tick, even though the primary result set was correctly bounded.
- **Impact**: The overflow risk that this task was designed to prevent (large payload, context budget exhaustion) is still present on the `unblocked=true` path. A project with N complete tasks always returns N IDs regardless of `limit`. In the worst case this is a denial-of-service vector against the supervisor's memory budget: a sufficiently large complete-task set causes the same context spike the limit was intended to cap.
- **Fix**: The dependency resolution only needs the IDs of complete tasks. Either (a) keep the unbounded query but note in the JSDoc that `unblocked=true` is not safe for large complete-task sets and should not be called in the monitoring loop, or preferably (b) constrain the complete-task query by fetching only the IDs of tasks that appear in the `dependencies` arrays of the already-fetched candidate rows, so the secondary query is scoped to the actual dependency set rather than the entire complete-task table.

---

## Minor Issues

### Minor 1: `args.status` Not Validated Against `VALID_STATUSES` at Handler Level

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:70-73`
- **Problem**: `handleGetTasks` inserts `args.status` directly as a bound parameter without checking it against `VALID_STATUSES`. The Zod schema in `index.ts` (lines 45-46, 57-58) enforces an enum at the MCP tool boundary, so callers going through the registered tool cannot supply an invalid value. However, `handleGetTasks` is an exported function: any internal caller or test can pass an arbitrary string as `status`. The value itself cannot cause SQL injection (it is a placeholder), but it can silently return zero rows for a misspelled or stale enum value with no error signal.
- **Fix**: Add a guard at the top of `handleGetTasks`: if `args.status !== undefined && !VALID_STATUSES.has(args.status)`, return an error payload rather than issuing a query that will always return zero rows.

### Minor 2: Hardcoded `LIMIT` String Literal vs Parameterized Placeholder — Pattern Consistency

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:85-87`
- **Problem**: The `limitClause` is built by toggling between an empty string and the literal `' LIMIT ?'`. The actual limit value is then pushed into `queryParams`. This is correct and safe. However, the existing `review-general.md` lesson (`SQL / Database` section) specifically calls out: "LIMIT clauses must use parameterized placeholders, not string interpolation." This implementation uses a placeholder correctly. This note is a confirmation, not a finding — the implementation is compliant with the documented rule.
- **Context**: No action required. Flagged only to confirm the prior lesson was applied.

---

## Summary

The core change — bounding `get_tasks` results with a validated, parameterized `LIMIT` clause — is implemented correctly. SQL injection is not present: the limit value is passed as a bound parameter, not interpolated. The Zod schema and the `Math.min/Math.max/Math.trunc` guard in the handler provide two independent layers of enforcement.

The one serious issue is that the `unblocked=true` code path fires a second unbounded query for all `COMPLETE` tasks, which is precisely the overflow scenario this task aimed to prevent. This path is not covered by the new `limit` guard and remains a DoS vector for large projects.

The status-validation gap is a defense-in-depth concern: no injection is possible, but silent zero-row returns on invalid status values make debugging harder.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `unblocked=true` path issues an unbounded `SELECT id FROM tasks WHERE status = 'COMPLETE'` query, bypassing the `limit` guard that is the primary deliverable of this task.
