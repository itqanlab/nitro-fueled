# Security Review — TASK_2026_194

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 7                                    |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                                             |
|--------------------------|--------|---------------------------------------------------------------------------------------------------|
| Input Validation         | FAIL   | `normalizeSessionId` silently passes through unrecognized formats — no rejection path              |
| Path Traversal           | PASS   | No new file-system path construction introduced in this changeset                                 |
| Secret Exposure          | PASS   | No credentials, tokens, or secrets introduced                                                     |
| Injection (shell/prompt) | PASS   | All DB queries use parameterized statements; no shell calls added                                 |
| Insecure Defaults        | PASS   | `buildSessionId` produces a canonical, well-structured ID by default; no insecure defaults added  |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: `normalizeSessionId` Has No Rejection Path — Arbitrary Strings Reach DB Queries

- **File**: `packages/mcp-cortex/src/tools/session-id.ts:8-18`
- **Problem**: `normalizeSessionId` tests the input against `CANONICAL_SESSION_ID_RE` and `LEGACY_SESSION_ID_RE`, but when neither matches it returns the original string unchanged (line 17: `return sessionId`). Every caller then passes this unvalidated value directly to a parameterized SQLite query as the session ID. Because all query construction uses bound parameters — not string interpolation — SQL injection is not possible here. However, the lack of a rejection path means semantically invalid session IDs (e.g., empty strings, strings containing nullbytes, or very long strings) silently proceed through the entire stack, returning `session_not_found` at the DB layer rather than a meaningful early-exit validation error. This also means a caller can send a session ID like `SESSION_9999-99-99_99-99-99` that looks plausible but is not a valid date, and the normalizer will apply the legacy-to-canonical transform without ever confirming the date components are in range.
- **Impact**: Semantic confusion and misleading error responses. Combined with the dynamic `SET` clause construction in `handleUpdateSession` (which is protected by an allowlist), the absence of format validation creates a pattern where the only gate is at the SQL execution boundary rather than at the normalization layer where intent can be checked. If any future caller ever builds a path or log entry from the normalizer's output without their own validation, the lack of rejection here becomes a first-class path traversal or injection vector.
- **Fix**: Add an else-branch in `normalizeSessionId` that returns `null` (or throws) for inputs that match neither pattern, and update all call sites to handle the null/error case. Alternatively, export a separate `validateSessionId(id: string): boolean` predicate and call it at each MCP tool boundary before normalization.

## Minor Issues

### Minor Issue 1: Slice-based Legacy Transform Has a Silent Date-Validity Gap

- **File**: `packages/mcp-cortex/src/tools/session-id.ts:14`
- **Problem**: The legacy-to-canonical conversion is `${sessionId.slice(0, 18)}T${sessionId.slice(19)}`. This correctly replaces the underscore at position 18 with `T`. However, the regex that guards this branch (`LEGACY_SESSION_ID_RE`) validates structural shape (`\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}`) but does not validate that the digit components represent a calendar-valid date (e.g., month `99`, day `32`). The transform will produce a syntactically canonical ID that is chronologically nonsensical and could be confused with a legitimate session in logs or tooling.
- **Fix**: This is a defense-in-depth concern rather than an exploitable defect, given that session IDs are not generated from user-supplied date components. Document the known gap in a comment on `LEGACY_SESSION_ID_RE`.

### Minor Issue 2: `handleReleaseOrphanedClaims` Emits Events with Hardcoded `session_id = 'system'` That Bypasses Normalization

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:366`
- **Problem**: The orphan-recovery event INSERT uses the literal string `'system'` as `session_id`. This value will never match a real session row in the DB (FK constraint is presumably absent on `events.session_id`, or the insert would fail) and is not run through `normalizeSessionId`. This is intentional behaviour — `'system'` is a sentinel for internal events — but it is not documented in the code. A reviewer or future developer unfamiliar with this convention may apply normalization to it unnecessarily, or may extend the `handleQueryEvents` filter to accidentally exclude system events.
- **Fix**: Add an inline comment at line 366 explaining that `'system'` is a sentinel value for internally-generated events and is intentionally not a normalized session ID. Consider defining a `SYSTEM_SESSION_ID` constant to make the sentinel intent explicit and searchable.

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: The absence of a rejection path in `normalizeSessionId` means the normalization layer provides no security gate — it only reformats known-good IDs. All DB queries are parameterized so SQL injection is not possible today, but the pattern sets a precedent where future code that constructs paths or logs from the normalizer's output inherits no validation guarantee. The fix is low-effort and high-value: add a null return for unrecognized formats and guard at call sites.
