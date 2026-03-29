# Security Review — TASK_2026_140

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 2                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | DB rows validated against enum allowlist before use in status.ts; TASK_ID_RE anchored regex properly guards path construction in sync.ts |
| Path Traversal           | PASS   | `entry.name` sourced from `readdirSync` (OS-enumerated, not user input); `TASK_ID_RE` anchored `^...$` prevents bypass; path constructed via `join` with the validated name |
| Secret Exposure          | PASS   | No hardcoded credentials, tokens, or API keys found |
| Injection (shell/prompt) | PASS   | No shell execution in either file; all SQL queries use `?` parameterized placeholders — no string interpolation in SQL |
| Insecure Defaults        | FAIL   | DB opened readonly (good), but `fileStatus` read from disk is written to DB with no enum validation — arbitrary content from a symlink-redirected read lands verbatim in the `status` column |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: Status file symlink allows arbitrary string injection into the `status` column

- **File**: `packages/mcp-cortex/src/tools/sync.ts:171-187`
- **Problem**: `readFileSync(statusPath, 'utf8').trim()` follows symlinks. If an attacker (or a malicious tool running in the project) plants a symlink at `task-tracking/TASK_XXXX_XXX/status` pointing to any file readable by the process (e.g., a file whose content is a long binary blob, a crafted string, or sensitive text), that content is written verbatim into the `status` column via the `updateStatus.run(fileStatus, entry.name)` parameterized query. The parameterized query prevents SQL injection but does not prevent the arbitrary string from landing in the DB and being surfaced in status outputs.
- **Impact**: The `status` column can receive any string up to the SQLite text limit. In `status.ts`, `dbRowsToRegistryRows` validates the status against `TASK_STATUS_VALUES` and falls back to `'CREATED'` for unknown values, so display-layer impact is limited. However, a non-validated status value stored in the DB can break other consumers that do not apply this guard, and binary/long content could degrade DB integrity.
- **Fix**: Validate `fileStatus` against the allowed enum set before calling `updateStatus.run`. Define a `VALID_STATUSES` set (matching the canonical `TaskStatus` union) and skip the update — logging a warning — if `fileStatus` is not a member. Example: `const VALID_STATUSES = new Set(['CREATED','IN_PROGRESS','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED']); if (!VALID_STATUSES.has(fileStatus)) { /* skip */ continue; }`.

## Minor Issues

- **`console.warn` error message not length-capped** — `apps/cli/src/commands/status.ts:336`: `console.warn(`[nitro-fueled] cortex DB unavailable (${msg}), ...`)` echoes `err.message` without capping. Per established project security lesson (TASK_2026_068), error strings sourced from the filesystem or a native module must be capped at 200 characters before terminal output. The `better-sqlite3` message can include the full DB file path and OS error details. Fix: `const msg = raw.length > 200 ? raw.slice(0, 200) + '…' : raw`.

- **`fileStatus` not length-checked before DB write** — `packages/mcp-cortex/src/tools/sync.ts:176`: after `.trim()`, `fileStatus` is unbounded in length before being passed to `updateStatus.run`. A symlink-redirected read of a large file would cause `readFileSync` to load potentially megabytes into memory and then attempt to store the entire string in the DB. This is a resource concern rather than a code execution risk. Fix: add `if (fileStatus.length > 32) { /* skip */ continue; }` — the longest valid status string is 11 characters (`IN_PROGRESS`).

## Notes

- **`TASK_ID_RE` is properly anchored** — `^TASK_\d{4}_\d{3}$` requires full string match. An entry like `TASK_1234_567/../../../etc` would fail the regex test at `entry.name` and be skipped before any path is constructed. No path traversal risk from this regex.
- **`require('better-sqlite3')` with hardcoded literal** — no user input involved in the module specifier. Module resolution hijacking requires prior write access to `node_modules`, which is outside the threat model for a developer CLI tool.
- **Transaction rollback** — `better-sqlite3` transactions auto-rollback on exception. `runReconcile()` is not wrapped in try/catch, so exceptions propagate to the MCP handler, which is the correct boundary to handle them.
- **DB opened `readonly: true`** — the CLI status command cannot write to the DB, which is the correct posture for a read-only display path.
- **Status enum validation in `dbRowsToRegistryRows`** — the display layer in `status.ts` already guards against unknown status values, which partially mitigates the Serious issue above for this specific consumer.

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: Unvalidated `fileStatus` string written to DB — a symlink in the task-tracking directory allows arbitrary content injection into the `status` column. Mitigated in the CLI display layer but not at the write boundary.
