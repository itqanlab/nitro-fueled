# Security Review — TASK_2026_138

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 4                                    |
| Files Reviewed   | 5                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | Free-text fields have no length limits; unbounded strings accepted by Zod |
| Path Traversal           | PASS   | No user-supplied path construction in these files; DB path from `process.cwd()` is design intent |
| Secret Exposure          | PASS   | No hardcoded secrets, tokens, or credentials found |
| Injection (shell/prompt) | PASS   | All SQL uses parameterized statements; dynamic SET clauses use a column whitelist; LIMIT interpolated via `Math.min` (numeric, not string) |
| Insecure Defaults        | FAIL   | `mkdirSync` called without explicit mode; DB directory created world-readable |

## Critical Issues

No critical issues found.

## Serious Issues

### [S1] Unguarded `JSON.parse` calls crash the MCP server on malformed DB data

- **File**: `packages/mcp-cortex/src/tools/events.ts:66-69`
- **Problem**: The `.map()` in `handleQueryEvents` calls `JSON.parse(row.data as string)` with no `try/catch`. If any `data` column value in the events table contains malformed JSON (written by a worker crash, a partial flush, or a direct DB edit), the entire `query_events` call throws an uncaught exception that propagates to the MCP caller as an unhandled error, potentially crashing the server loop.
- **Impact**: A single bad row in the events table makes the entire table unqueryable. An attacker or buggy worker with write access to the DB can permanently disable event queries.
- **Fix**: Wrap the `JSON.parse` in a `try/catch` per row; on parse failure, substitute `{ _parse_error: true, raw: row.data }` and continue rather than throwing. Apply the same guard to the four `JSON.parse` calls in `handoffs.ts:72-75`.

### [S2] Unguarded `JSON.parse` on dependencies column crashes `get_tasks` with `unblocked=true`

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:39`
- **Problem**: `JSON.parse((row['dependencies'] as string) ?? '[]')` runs inside a `.filter()` with no `try/catch`. If the `dependencies` column for any task holds malformed JSON (schema drift, partial write, or direct edit), the entire `handleGetTasks` call throws and the MCP tool returns an unhandled error. The result is also assumed to be `string[]` without a runtime check, so a non-array value (`"dependencies": "none"`) would cause `deps.every(...)` to throw a `TypeError`.
- **Impact**: A single task with a malformed `dependencies` field permanently disables the unblocked-task query used by the Supervisor to dispatch work, stalling the entire pipeline.
- **Fix**: Wrap the `JSON.parse` in `try/catch`; default to `[]` on failure. After parsing, add a runtime check: `if (!Array.isArray(deps)) deps = [];`.

### [S3] Free-text MCP input fields have no length limit — memory and log exhaustion vector

- **File**: `packages/mcp-cortex/src/index.ts:139-143` (log_event), `packages/mcp-cortex/src/tools/events.ts:8-11`
- **Problem**: `source`, `event_type`, `session_id`, and `task_id` fields in `log_event` and `query_events` are declared as `z.string()` with no `.max()` constraint. A caller can pass arbitrarily large strings (e.g., a 10 MB string as `source`). These values are stored in the DB, returned in query responses as JSON, and could cause substantial memory pressure during `query_events` when many such rows are fetched. The same applies to `decisions` and `risks` array elements in `write_handoff` (no per-element length limit).
- **Impact**: A worker or a compromised MCP caller can insert large payloads that cause memory exhaustion on `query_events` (which fetches up to 1000 rows) and bloat the SQLite DB with no storage limit.
- **Fix**: Add `.max()` limits at the Zod layer: identifier fields (`session_id`, `task_id`, `source`, `event_type`) should be `.max(200)`. String array elements in `write_handoff` (`commits`, `decisions`, `risks`) should be `.max(2000)` each. This mirrors the pattern already applied to `watch_condition` path/value fields in `subscribe_worker`.

## Minor Issues

### [M1] `mkdirSync` creates the DB directory without an explicit mode

- **File**: `packages/mcp-cortex/src/db/schema.ts:141`
- **Problem**: `mkdirSync(dirname(dbPath), { recursive: true })` uses the default mode (0o755 after umask), making the `.nitro/` directory world-listable. Any local user can confirm the DB file exists.
- **Fix**: Pass `{ recursive: true, mode: 0o700 }` so only the owning user can list the directory. This matches the established pattern documented in `review-lessons/security.md` (TASK_2026_059 and TASK_2026_068).

### [M2] `release_task` accepts any string as `new_status` without enum validation

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:78-89`, `packages/mcp-cortex/src/index.ts:55-61`
- **Problem**: `new_status` is declared as `z.string()` in `index.ts:59`. The value is written directly to the `status` column via a parameterized query. SQLite's `CHECK(status IN (...))` constraint will reject invalid values and bubble a DB error — but there is no application-layer validation or human-readable error message. The `claim_task` handler hardcodes `'IN_PROGRESS'` correctly; `release_task` should do the same via an enum.
- **Fix**: Change to `z.enum(['CREATED','IN_PROGRESS','IMPLEMENTED','IN_REVIEW','COMPLETE','FAILED','BLOCKED','CANCELLED'])` in the Zod schema so invalid values are rejected with a clear Zod error before hitting the DB.

### [M3] `handoffs.ts` does not validate `worker_type` at the application layer for the INSERT path

- **File**: `packages/mcp-cortex/src/tools/handoffs.ts:46`
- **Problem**: `worker_type` is validated as `z.enum(['build', 'review'])` in `index.ts:113` which is correct. However, `handleWriteHandoff` in `handoffs.ts` receives `worker_type: string` in its argument type definition (line 26) with no internal guard. If `handleWriteHandoff` is called directly (bypassing the MCP layer, e.g., in tests or future internal callers), an invalid `worker_type` bypasses validation and hits the SQLite `CHECK` constraint. Defense-in-depth suggests the function itself should validate.
- **Fix**: Add an early guard inside `handleWriteHandoff`: `if (!['build', 'review'].includes(args.worker_type)) return error response`. Minor because the Zod layer in `index.ts` currently covers the only call site.

### [M4] `handleQueryEvents` LIMIT clause interpolation is safe but not obviously so

- **File**: `packages/mcp-cortex/src/tools/events.ts:60`
- **Problem**: `LIMIT ${Math.min(args.limit, 1000)}` interpolates a number into the SQL string. This is safe because `Math.min` of two numbers is always a number, and JavaScript will coerce it to a numeric literal in the template string. However, this pattern looks like a SQL injection risk on first read and breaks the consistency of using `better-sqlite3`'s parameterized API for all other dynamic values.
- **Fix**: To maintain code consistency and eliminate any future maintenance risk, use `db.prepare(...).all(...params).slice(0, limit)` after fetching, or pass the limit as a parameter (`LIMIT ?`) and include `Math.min(args.limit ?? 500, 1000)` as a bind parameter. Minor because the current implementation is demonstrably safe.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Unguarded `JSON.parse` calls in `events.ts` and `tasks.ts` — a single malformed DB row in either the `events.data` or `tasks.dependencies` column crashes the affected query tool entirely, making the pipeline unrecoverable without manual DB repair. Fix S1 and S2 before shipping.
