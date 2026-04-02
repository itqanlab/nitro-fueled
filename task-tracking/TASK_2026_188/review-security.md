# Security Review — TASK_2026_188

## Score: 8/10

## Summary

The orphaned claim recovery implementation is well-structured. All new SQL queries use parameterized placeholders and the new tool handlers introduce no new injection surfaces. Two pre-existing patterns present in the surrounding code (unquoted column names interpolated into SQL, missing status validation before DB write) are confirmed present in the changed handlers and warrant documentation, but neither is exploitable under the current whitelist. No credentials, secrets, or shell execution are involved.

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | New tools accept no external parameters; status/session filters use parameterized queries |
| Path Traversal           | PASS   | No file-system paths derived from user input in new code |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys in any file |
| Injection (shell/prompt) | PASS   | No shell execution; all SQL uses `?` placeholders for values |
| Insecure Defaults        | PASS   | `skip_orphan_recovery` defaults to `false` (safer default — recovery runs by default) |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: Column names from user input interpolated into SQL without quoting

- **File**: `packages/mcp-cortex/src/tools/tasks.ts` lines 171–177 (`handleUpsertTask`, UPDATE path) and lines 236–243 (`handleUpdateTask`)
- **Problem**: `args.fields` is a caller-supplied JSON object. The loop `for (const [key, value] of Object.entries(args.fields))` extracts key names, checks them against `UPSERTABLE_COLUMNS` / `UPDATABLE_COLUMNS`, and then interpolates the key directly into the SQL string as `` `${key} = ?` ``. Because the whitelist only contains safe lowercase identifier strings today, this is not currently exploitable. However, the pattern is architecturally unsafe: if a future change adds a column name containing a SQL metacharacter (e.g., a column aliased or quoted differently), or if the whitelist check is inadvertently loosened, the column name lands unquoted in the query string.
- **Impact**: Under the current whitelist the risk is theoretical. If the whitelist grows to include a column name with unusual characters, or if the whitelist check is bypassed, a caller could inject arbitrary SQL via the column name position.
- **Fix**: Wrap each interpolated column name in double-quotes: `` `"${key}" = ?` ``. SQLite accepts double-quoted identifiers and this eliminates the footgun without changing behavior. Apply to both `handleUpdateTask` (line 243) and `handleUpsertTask` (line 188).

## Minor Issues

- **`handleReleaseTask` — no application-level status validation** (`tasks.ts` line 141): `args.new_status` is passed directly as a bound parameter. SQLite's CHECK constraint will reject invalid values, but the rejection surfaces as an unhandled exception (no try/catch around `.run()`). The `release_task` tool in `index.ts` correctly constrains via `z.enum(...)`, but `handleReleaseTask` itself has no guard, leaving the handler unsafe if called from any other call site. Add a `VALID_STATUSES.has(args.new_status)` check at the top of the handler and return `{ ok: false, reason: 'invalid_status' }` rather than throwing.

- **`writeStatusFile` uses default file mode** (`tasks.ts` line 18): `writeFileSync(join(taskDir, 'status'), status, 'utf-8')` uses the process umask default (typically 0o644). Per existing security lessons (TASK_2026_059), files written by this server should use `{ mode: 0o600 }`. The `status` file content (a task state string) is low-sensitivity, so the risk is minimal, but it diverges from the established pattern used for directory creation in `schema.ts`.

- **Double `stale_for_ms` computation** (`tasks.ts` lines 309–324 in `detectOrphanedClaims`, then lines 346–347 in `handleReleaseOrphanedClaims`): The stale duration is computed at detection time and then recomputed with a second `Date.now()` call during the release loop. The two calls can disagree by milliseconds to tens of milliseconds, producing an event log entry that does not match what was returned by `get_orphaned_claims`. This is not a security issue, but creates an audit-log consistency gap.

- **Unused `args` parameter in tool callbacks** (`index.ts` lines 132, 137): `(args) => handleGetOrphanedClaims(db)` and `(args) => handleReleaseOrphanedClaims(db)` receive `args` but do not use it. This is a style issue with no security impact, but is worth noting in the context of future schema additions to these tools.

## Passed Checks

- All new SQL queries (`detectOrphanedClaims`, `handleReleaseOrphanedClaims` INSERT into events) use `?` placeholders exclusively — no string interpolation of user-controlled values into SQL.
- `handleCreateSession` `skip_orphan_recovery` defaults to `false`, meaning the safer behavior (recovery runs) is the default. An opt-out flag is the correct design here.
- The `release_task` tool registration in `index.ts` correctly applies `z.enum([...])` for `new_status`, so callers going through the MCP layer are properly constrained.
- The `claim_timeout_ms` column is correctly typed as `INTEGER` with a `null` default — no risk of unexpected type coercion.
- Orphan detection cross-references against `loop_status = 'running'` sessions rather than trusting caller-supplied session IDs — the check is server-side and cannot be bypassed by a client.
- `handleCloseStaleSessions` `ttl_minutes` is validated at the Zod layer with `.int().min(1).max(1440)` before reaching the handler — no integer overflow or negative-TTL risk.
- `mkdirSync` in `schema.ts` (line 355) correctly uses `{ mode: 0o700 }` per the established pattern.
- No hardcoded credentials, API keys, or tokens in any of the four files reviewed.
- No shell execution (`exec`, `spawn`, `execSync`) in any of the four files reviewed.
- No `eval()`, `new Function()`, or `vm.runInNewContext()` usage.
