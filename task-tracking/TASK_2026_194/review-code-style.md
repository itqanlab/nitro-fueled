# Code Style Review — TASK_2026_194

## Score: 7/10

| Metric          | Value          |
|-----------------|----------------|
| Overall Score   | 7/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 0              |
| Serious Issues  | 3              |
| Minor Issues    | 4              |
| Files Reviewed  | 10             |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`normalizeSessionId` silently passes through any string that matches neither regex. If a caller passes a malformed or completely invalid session ID (e.g. a UUID or an empty string), the function returns it unchanged rather than rejecting it. Every tool that calls `normalizeSessionId` then issues a DB query against a value that will never match — returning `session_not_found` without any diagnostic that the ID format was wrong. In 6 months a caller using a UUID-format worker session reference will get a confusing `session_not_found` with no hint the ID type is wrong. (`packages/mcp-cortex/src/tools/session-id.ts:8`)

### 2. What would confuse a new team member?

In `handleReleaseOrphanedClaims` (tasks.ts:346–347), a local `staleForMs` is computed from `Date.now() - claimedAt` but `detectOrphanedClaims` already computed and stored `stale_for_ms` on each orphaned task object (tasks.ts:322). The caller recomputes the same value a second time. A new developer reading this will not know which value is authoritative and may wonder whether there is intentional semantic difference (snapshot-at-detection vs snapshot-at-release time). This is a hidden maintenance trap.

### 3. What's the hidden complexity cost?

`normalizeSessionId` uses a hardcoded string index `slice(0, 18)` and `slice(19)` to inject the `T` separator (session-id.ts:14). The magic indices are derived from the fact that the legacy prefix up to the date separator is exactly 18 characters (`SESSION_YYYY-MM-DD`). There is no comment explaining this, and no constant naming the offset. If the ID format ever changes, these silent constants will produce a corrupted ID rather than a detectable error.

### 4. What pattern inconsistencies exist?

The `session-id.ts` module exports `buildSessionId` and `normalizeSessionId` but has no module-level JSDoc and the regex constants `CANONICAL_SESSION_ID_RE` / `LEGACY_SESSION_ID_RE` are unexported. Two other files (`sessions.spec.ts` and `workers.spec.ts`) use the pattern `sessionId.replace('T', '_')` directly in tests rather than importing a helper. This creates a third implicit knowledge source for the legacy format. Anywhere the canonical or legacy format needs to be referenced from tests should go through the same module — otherwise format changes silently leave tests behind.

### 5. What would I do differently?

- Export a `LEGACY_SESSION_ID_RE` from `session-id.ts` and use it in tests instead of `replace('T', '_')`.
- Name the magic index `18` as a constant (`const DATE_PREFIX_LENGTH = 18`) with a comment.
- Use `task.stale_for_ms` in `handleReleaseOrphanedClaims` instead of recomputing it — or remove it from the orphan struct if it is only needed at release time.
- Add a `// pass-through: unknown format` comment on the final `return sessionId` in `normalizeSessionId` so the intent is explicit.

---

## Serious Issues

### Issue 1: `staleForMs` recomputation duplicates data already on the orphan object

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:346–347`
- **Problem**: `detectOrphanedClaims` already stores `stale_for_ms: now - claimedAt` in the returned orphan structs (line 322). `handleReleaseOrphanedClaims` then ignores that field and recomputes `staleForMs = Date.now() - claimedAt` on line 347. The two computations use different `now` captures (the detection snapshot vs. the release snapshot), meaning the logged `stale_for_ms` in the event row will be slightly larger than what was calculated during detection. This is not a bug per se, but it is inconsistent: the orphan struct claims to carry `stale_for_ms` but callers do not use it.
- **Tradeoff**: If recomputing at release time is intentional (to reflect time since claim, not time since detection), that intent is undocumented. If it is accidental duplication, it wastes cognitive load and introduces a subtle divergence in the logged value.
- **Recommendation**: Either use `task.stale_for_ms` directly and remove the local recomputation, or add a comment explaining why the release-time snapshot is preferred for event logging.

### Issue 2: Magic indices in `normalizeSessionId` with no named constant or comment

- **File**: `packages/mcp-cortex/src/tools/session-id.ts:14`
- **Problem**: `sessionId.slice(0, 18)` and `sessionId.slice(19)` encode structural knowledge about the session ID format as bare integer literals. The value `18` is the index of the `_` separator in `SESSION_YYYY-MM-DD_HH-MM-SS`. There is no constant, no comment, and no assertion that the input satisfies the LEGACY regex before using these indices (the `if` on line 13 provides a check, but the relationship between the regex match and the slice indices is implicit).
- **Tradeoff**: A format change to either the legacy or canonical scheme will silently produce a garbled output with no runtime error.
- **Recommendation**: At minimum add an inline comment (`// position 18 = underscore between date and time parts`) or extract a named constant. Ideally, use a regex capture group replacement instead of positional slicing: `sessionId.replace(/^(SESSION_\d{4}-\d{2}-\d{2})_/, '$1T')`.

### Issue 3: Test files duplicate the legacy-format knowledge rather than importing from `session-id.ts`

- **File**: `packages/mcp-cortex/src/tools/sessions.spec.ts:111`, `workers.spec.ts:130`, `tasks.spec.ts:66`
- **Problem**: All three test files construct legacy session IDs via `sessionId.replace('T', '_')`. The canonical and legacy formats are defined in `session-id.ts`, but nothing from that module is imported by the specs. If the separator character or position changes, the tests will silently test the wrong transformation.
- **Tradeoff**: The current usage is readable, but it creates a third implicit definition of the legacy format.
- **Recommendation**: Export a `toLegacySessionId` test helper from `session-id.ts` (or a test utility file) and use it in all specs to keep the format definition in one place.

---

## Minor Issues

- **`session-id.ts` lacks a module-level comment** — the file is small but its two exports have meaningfully different contracts (`buildSessionId` always produces canonical; `normalizeSessionId` is idempotent on canonical, transforms legacy, and passes through unknown). A one-line JSDoc per function would make this clear without padding. (`session-id.ts:4,8`)

- **`handleReleaseOrphanedClaims` inserts an event row with `session_id = 'system'`** — the literal string `'system'` is not a valid session ID in the canonical format and will fail any future FK or format validation. This predates TASK_2026_194 but the task touched this function and is a good moment to track it. (`tasks.ts:366`)

- **`workers.ts:88` redundant path resolution call** — `resolve(args.working_directory)` is assigned to `resolvedDir` on line 87, then `resolve(args.working_directory)` is called again on line 88 inside the `if (!resolve(...).startsWith('/'))` check. The guard should use `resolvedDir` rather than re-resolving. This is pre-existing code touched by the commit (import was added). (`workers.ts:87–88`)

- **`tasks.spec.ts` test IDs use range `TASK_2026_900–901` and `TASK_2030_000–209`** — using realistic-looking task IDs (`TASK_2026_900`) risks colliding with real task IDs if the DB is shared or if the numbering space is exhausted. Prefer `TASK_TEST_xxx` or UUIDs for test data. (`tasks.spec.ts:62,80,103`)

---

## File-by-File Analysis

### `session-id.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

The single-responsibility design is correct: one file, two exports, no side effects. Import-free. The regex constants are well-named and easy to verify against real ID examples. The main concern is the magic index approach in `normalizeSessionId` — using positional slicing is fragile compared to a regex-substitution approach. The pass-through for unknown formats is safe but silently swallows garbage input.

### `sessions.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

`normalizeSessionId` is consistently applied at the top of every function that accepts a `session_id` argument. The import is in the correct position (after the framework type imports, before the intra-package import from `tasks.js`). Import ordering is clean.

### `tasks.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

The normalization call in `handleClaimTask` is correctly placed before the transaction. The fix to the `claimed_by` nullability in the type cast (`string | null`) is a legitimate type-safety improvement included in the diff. However, the `staleForMs` duplication in `handleReleaseOrphanedClaims` (Serious Issue 1) and the `'system'` literal session ID (Minor) are both worth addressing.

### `wave.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Normalization applied correctly before the transaction. Single call site, clean diff. The `TaskRow` interface is appropriately scoped to the file.

### `workers.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Normalization applied correctly in `handleSpawnWorker` and `handleListWorkers`. The redundant `resolve()` call (Minor Issue) is pre-existing but was touched indirectly by this PR.

### `events.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Normalization is applied in both `handleLogEvent` and `handleQueryEvents`. The optional-chaining pattern for `session_id` (`args.session_id ? normalizeSessionId(args.session_id) : undefined`) is consistent with the rest of the codebase.

### `telemetry.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Single call site in `handleGetSessionSummary`, correctly placed before the DB query. No issues introduced.

### `sessions.spec.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious (shared), 0 minor

Legacy ID tests are meaningful and cover the right behaviors (get, update, heartbeat). The `replace('T', '_')` construct is repeated three times; see Serious Issue 3.

### `tasks.spec.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious (shared), 1 minor

Good coverage for both normalization paths and the limit cap. The use of realistic-looking task IDs in test data (`TASK_2026_900`) and the `replace('T', '_')` format knowledge duplication are the two concerns.

### `workers.spec.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious (shared), 0 minor

Legacy session ID coverage added for `handleSpawnWorker` and `handleListWorkers`. The DB row insert helper `insertWorkerRow` correctly uses `emptyTokenStats()/emptyCost()/emptyProgress()` — good pattern. Same `replace('T', '_')` duplication as the other spec files.

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                        |
|----------------------------------|--------|----------------------------------------------------------------|
| Single-source format definition  | PARTIAL| Legacy format knowledge duplicated across three spec files     |
| Type safety                      | PASS   | No `any` introduced; nullability fixed in `handleClaimTask`    |
| Normalization at tool boundaries | PASS   | All session-accepting functions normalize before DB access     |
| Magic constants named/commented  | FAIL   | Slice indices 18/19 in `normalizeSessionId` unnamed            |
| No duplicate computation         | FAIL   | `staleForMs` recomputed in `handleReleaseOrphanedClaims`       |
| Test data isolation              | MINOR  | Test tasks use realistic IDs that could collide in practice    |

---

## Technical Debt Assessment

**Introduced**:
- Three spec files now each carry implicit knowledge of the legacy ID format (the `replace('T', '_')` construct). If `session-id.ts` changes, these will not automatically fail — they will silently test a different transformation.
- The magic slice indices in `normalizeSessionId` are a latent fragility point.

**Mitigated**:
- Legacy session IDs passed to all six tool modules now resolve correctly without requiring callers to upgrade their stored IDs. This removes a class of silent lookup failures.
- The `session_claimed` null-safety bug in the task-claim response (`string` cast changed to `string | null`) is a legitimate improvement.

**Net Impact**: Small positive. The normalization boundary is well-designed and the single-helper pattern is correct. The debt introduced is minor and contained to test style and one internal naming issue.

---

## Verdict

**Recommendation**: REVISE (before next promotion)
**Confidence**: HIGH
**Key Concern**: The duplicated `staleForMs` computation in `handleReleaseOrphanedClaims` and the magic indices in `normalizeSessionId` are the two items most likely to cause confusion in future maintenance. Neither is blocking for correctness, but both should be addressed in the same PR or a fast-follow.

---

## What Excellence Would Look Like

A 10/10 implementation would:
1. Use a regex capture-group replace in `normalizeSessionId` instead of positional slicing, eliminating the magic-index fragility.
2. Export `toLegacySessionId` (or a test utility) from `session-id.ts` so all three spec files share the format definition rather than repeating `replace('T', '_')`.
3. Remove the local `staleForMs` recomputation in `handleReleaseOrphanedClaims` in favour of `task.stale_for_ms`, with a comment explaining that the value is captured at detection time.
4. Add brief JSDoc to both exported functions in `session-id.ts` documenting the pass-through behaviour for unrecognised formats.
