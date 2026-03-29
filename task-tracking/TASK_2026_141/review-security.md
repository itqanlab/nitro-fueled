# Security Review — TASK_2026_141

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 4                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `syncTasksFromFiles` writes raw status values to the DB without enum validation; `applyMigrations` interpolates a table name into SQL without a whitelist guard |
| Path Traversal           | PASS   | `TASK_ID_RE` guards all `entry.name`-based path construction; `update.ts` has an explicit `startsWith(cwdNorm)` boundary check |
| Secret Exposure          | PASS   | No hardcoded credentials or tokens found |
| Injection (shell/prompt) | PASS   | No shell execution; all DB writes use parameterized queries |
| Insecure Defaults        | FAIL   | SQLite DB file created by `BetterSqlite3` without explicit file-permission mode — defaults to world-readable 0o644; large AI-authored handoff.md content stored without size cap |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: `syncTasksFromFiles` writes unvalidated status values into the DB

- **File**: `apps/cli/src/utils/cortex-hydrate.ts:108-124`
- **Problem**: The status field read from the `status` file on disk is passed directly to the parameterized `upsert.run()` call without being validated against `VALID_STATUSES`. The `reconcileStatusFiles` function (line 167) correctly performs this check, but `syncTasksFromFiles` does not. A hand-edited, corrupted, or symlink-redirected `status` file can insert an arbitrary string into the `tasks.status` column. The SQLite CHECK constraint on the column guards against this for new DB rows only on a fresh create (it fires at `INSERT`), but the `ON CONFLICT DO UPDATE` path will raise a constraint violation and cause the entire transaction to abort rather than silently accepting the bad value — meaning the task is skipped with an error. However, the inconsistency between the two code paths creates a maintenance hazard: a future schema relaxation (removing the CHECK constraint) would silently allow dirty values.
- **Impact**: Immediate risk is low because the DB CHECK constraint will reject invalid status values in practice. The residual risk is a future-maintenance gap where relaxing the CHECK constraint elsewhere would silently allow arbitrary strings into the status column, potentially breaking downstream routing logic.
- **Fix**: Add the same `VALID_STATUSES` check already present in `reconcileStatusFiles` immediately after reading the file at line 109. If the value is absent from `VALID_STATUSES`, default to `'CREATED'` and log a warning, mirroring the pattern in `registry.ts:135`.

### Issue 2: `applyMigrations` interpolates the `table` argument into raw SQL

- **File**: `apps/cli/src/utils/cortex-db-init.ts:17`
- **Problem**: `db.prepare(\`PRAGMA table_info(${table})\`)` constructs a SQL statement by directly interpolating the `table` function parameter. `better-sqlite3` does not support parameterized `PRAGMA` statements, so string interpolation is structurally required here, but the function accepts an unconstrained `string`. Any future caller that passes an externally derived or user-controlled table name (e.g., from a config file or CLI argument) could trigger SQL injection via the `table_info` PRAGMA path. The three current call sites (`'tasks'`, `'sessions'`, `'workers'`) are all hardcoded string literals, so the function is safe today. However, the function is exported and the signature provides no visible guard.
- **Impact**: No current exploitability — all call sites are literal strings. Becomes a SQL injection vector if a future caller passes dynamic input without a separate validation step.
- **Fix**: Add a table-name allowlist check at the top of `applyMigrations`: validate that `table` matches `/^[a-z_][a-z0-9_]*$/` and that it is in the set of known tables (`tasks`, `sessions`, `workers`) before constructing the PRAGMA statement. Add an inline comment documenting why the allowlist is required. This removes the invisible dependency on callers being well-behaved.

---

## Minor Issues

### Minor Issue 1: SQLite DB file created without explicit 0o600 permission

- **File**: `apps/cli/src/utils/cortex-db-init.ts:33`
- **Problem**: `new BetterSqlite3(dbPath)` creates the `.nitro/cortex.db` file with default OS permissions (typically 0o644 after umask). The parent directory is correctly created with `mode: 0o700` (line 32), so the directory itself is not listable by other users. But the file inside is world-readable if the umask allows it (e.g., umask 022 yields 0o644). The DB contains session IDs, worker PIDs, working directories, and `iterm_session_id` values — operational metadata that is sensitive on a multi-user system.
- **Reference**: Existing security lesson from TASK_2026_059: "Files written with `writeFileSync` default to world-readable — always pass an explicit `mode` option: `mode: 0o600`."
- **Fix**: After `new BetterSqlite3(dbPath)`, call `fs.chmodSync(dbPath, 0o600)` to enforce the file permission. Note that `better-sqlite3` does not expose an `open` mode option, so `chmodSync` after creation is the correct pattern. This should be done before any pragmas are applied.

### Minor Issue 2: Error messages logged without length cap

- **File**: `apps/cli/src/utils/cortex-hydrate.ts:224-226`, `281-283`, `354-356`
- **Problem**: All three `console.error` catch blocks log `err.message` or `String(err)` without a length cap. Per the existing security lesson from TASK_2026_068, exception messages from file or DB operations can include internal Node.js paths, crafted content from a symlink-redirected read, or structured error bodies. A maliciously crafted `status` file or `task.md` content that triggers a `better-sqlite3` constraint error could produce a long or adversarially shaped message echoed verbatim to stderr.
- **Fix**: Cap the message at 200 characters before logging: `const msg = message.length > 200 ? message.slice(0, 200) + '...' : message`.

### Minor Issue 3: Unbounded handoff.md content stored in the DB

- **File**: `apps/cli/src/utils/cortex-hydrate.ts:270-276`
- **Problem**: `readFileSync(handoffPath, 'utf8')` reads the complete content of `handoff.md` and stores it as the sole element of the `decisions` JSON array. There is no size limit. Handoff files are AI-authored markdown artifacts and can be several kilobytes to tens of kilobytes. Over many tasks, this accumulates large BLOB-equivalent content in the `handoffs` table. When a bulk query materializes many rows, memory usage scales with total handoff content. The existing security lesson from TASK_2026_138 flags this exact pattern: "free-text fields stored in the DB must include `.max()` limits."
- **Fix**: Cap the content before storage — e.g., read only the first 8 KB (or a configurable limit): `rawContent.length > 8192 ? rawContent.slice(0, 8192) + '\n...[truncated]' : rawContent`. Document the cap in a comment.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `syncTasksFromFiles` writes status values from disk to the DB without validating against `VALID_STATUSES` — an inconsistency with `reconcileStatusFiles` that introduces a maintenance hazard and creates a split trust boundary between the two sync code paths. The `applyMigrations` SQL interpolation is a latent injection surface that should be closed with a table-name allowlist before the function signature invites future misuse.
