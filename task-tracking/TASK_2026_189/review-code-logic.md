# Code Logic Review — TASK_2026_189

## Summary

TASK_2026_189 audited all `JSON.parse` calls in `packages/mcp-cortex/src/` and wrapped unguarded ones in try/catch with safe defaults. The two modified files (`wave.ts`, `context.ts`) were correctly hardened. However, the build worker's scope decision left **5 real unguarded `JSON.parse` calls** in production code that were not addressed. The acceptance criteria states "every JSON.parse in packages/mcp-cortex/src/ must be guarded" — this is **not fully met**.

---

## Findings

### [F-001] — Unguarded JSON.parse in handoffs.ts (readHandoff path)

- **Severity**: major
- **File**: `packages/mcp-cortex/src/tools/handoffs.ts:135,141,142,143,154,155,156,157`
- **Issue**: `handleReadHandoff` wraps ALL its `JSON.parse` calls in a single outer try/catch. This is superficially guarded, but the guard is a single catch for the entire block. Lines 135, 141, 142, 143 (prep path) and 154, 155, 156, 157 (standard path) are multiple sequential JSON.parse calls with no individual guards. If `row.risks` is parseable but `row.files_changed` is malformed, the outer catch triggers and returns `json_parse_error` for the entire handoff. The caller gets no partial data and no information about which field failed.

  The acceptance criteria says "Parse failures return safe defaults (empty array/object) and log a warning." The handoffs.ts catch returns an error response, not a safe default. A malformed single column loses the entire handoff record.

- **Suggestion**: Wrap each individual `JSON.parse` per field with its own try/catch and a safe default (empty array), then return the best-effort result, logging which fields failed. This matches the pattern used in `context.ts`.

---

### [F-002] — Unguarded JSON.parse in telemetry.ts (get_session_summary)

- **Severity**: major
- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:381,382`
- **Issue**: `handleGetSessionSummary` contains the loop at line ~379:

  ```typescript
  try {
    const cost = JSON.parse(w.cost_json) as { total_usd?: number };
    const tokens = JSON.parse(w.tokens_json) as { ... };
    ...
  } catch { /* ignore */ }
  ```

  The catch has `/* ignore */` — a silent failure. The build worker explicitly changed context.ts to replace `/* ignore */` catches with `console.error` logging as one of its stated decisions. But this identical silent `/* ignore */` catch in telemetry.ts at line 392 was not touched. This is the exact pattern the task was created to fix, applied inconsistently. It is a clear miss.

- **Suggestion**: Replace `} catch { /* ignore */ }` with `} catch (err) { console.error('[nitro-cortex] get_session_summary: failed to parse cost/tokens for worker', err); }` to match the fix applied in context.ts.

---

### [F-003] — Unguarded JSON.parse in sessions.ts (create_session orphan recovery parse)

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/sessions.ts:29`
- **Issue**: `handleCreateSession` calls `handleReleaseOrphanedClaims` and then parses the return payload:

  ```typescript
  const released = JSON.parse((releaseResult.content[0] as { text: string }).text) as { released: number; tasks: string[] };
  ```

  This is inside a try/catch (line 28–35) so failure is handled — session creation is not blocked. However the catch is empty (no logging). The build worker claimed this as "already guarded." That is correct in terms of not crashing, but the silent empty catch means a JSON parse failure here is invisible. The outer function contract still holds (session is created), but silent failures are a known anti-pattern in this codebase.

- **Suggestion**: Log inside the catch: `console.error('[nitro-cortex] create_session: failed to parse orphan recovery result')`. Low severity since the session always gets created regardless.

---

### [F-004] — Unguarded JSON.parse in tasks.ts (handleGetTasks unblocked path)

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/tasks.ts:107`
- **Issue**: In the `unblocked` filter path:

  ```typescript
  try {
    deps = JSON.parse((row['dependencies'] as string) ?? '[]');
  } catch {
    deps = [];
  }
  ```

  This is guarded — but the catch body is silent. No warning is logged when a task has malformed dependency JSON. The task's dependencies are silently treated as empty, which means a task that should be blocked (waiting on a dependency) will be returned as unblocked. This is a logic correctness concern: a malformed `dependencies` field causes a task to appear unblocked when it may not be.

  The acceptance criteria says "Parse failures return safe defaults and log a warning." The catch here does not log a warning.

- **Suggestion**: Add `console.error('[nitro-cortex] get_tasks: failed to parse dependencies for task, treating as no deps', row['id'])` inside the catch. This matches the fix applied to wave.ts.

---

### [F-005] — Array.isArray() guard scope is correct but asymmetric with tasks.ts unblocked path

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/wave.ts:41` vs `packages/mcp-cortex/src/tools/tasks.ts:107–111`
- **Issue**: The wave.ts fix added:

  ```typescript
  deps = Array.isArray(parsed) ? parsed as string[] : [];
  ```

  The tasks.ts unblocked path uses a different pattern:

  ```typescript
  deps = JSON.parse(...)
  ...
  if (!Array.isArray(deps)) deps = [];
  ```

  Both achieve the same end result — non-array values are treated as empty deps — but the two code paths for the same conceptual operation are inconsistently structured. This is a minor readability/maintenance issue, not a correctness issue.

- **Suggestion**: Not a bug. Document the asymmetry; consider unifying patterns in a future cleanup task.

---

### [F-006] — Build worker claimed telemetry.ts was "already guarded" — this is incorrect

- **Severity**: major (assessment error, not new code bug)
- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:379–392`
- **Issue**: The handoff.md states "Did NOT modify: telemetry.ts." The rationale was that telemetry.ts was "already guarded." The `get_session_summary` function has a `try { ... } catch { /* ignore */ }` around its JSON.parse calls. By the task's own acceptance criteria, a silent `/* ignore */` catch does NOT satisfy "log a warning." The build worker applied this fix in context.ts but missed the identical pattern in telemetry.ts. This is a scope error that means the acceptance criteria is not fully met.

---

### [F-007] — providers.ts JSON.parse in loadConfig: both catches are guarded with logging (PASS)

- **Severity**: none (confirmed correct)
- **File**: `packages/mcp-cortex/src/tools/providers.ts:163,171`
- **Issue**: Both `JSON.parse` calls in `loadConfig` are wrapped in try/catch with `console.error` logging. This correctly satisfies the acceptance criteria.

---

### [F-008] — spawn.ts JSON.parse calls are correctly exempt (PASS)

- **Severity**: none (confirmed correct)
- **File**: `packages/mcp-cortex/src/process/spawn.ts:58,67,134`
- **Issue**: Lines 58 and 67 parse streaming JSONL from worker stdout — they are inside `try { } catch { /* not valid JSON */ }`. The comment is a functional description, not a stub. The empty catch is intentional: non-JSON lines in a JSONL stream are expected noise and should be silently skipped (logging every non-JSON line would be extremely noisy at runtime). Line 134 (`resolveGlmApiKey`) is guarded with `console.error` logging. All three are correctly handled.

---

### [F-009] — task-creation.ts assertUpsertSucceeded: JSON.parse is guarded (PASS)

- **Severity**: none (confirmed correct)
- **File**: `packages/mcp-cortex/src/tools/task-creation.ts:319`
- **Issue**: Wrapped in explicit try/catch that re-throws a typed Error. Correctly guarded.

---

## Verdict

| Criterion | Status |
|-----------|--------|
| All JSON.parse in mcp-cortex src/ wrapped in try/catch | FAIL — handoffs.ts has no per-field guards; telemetry.ts has a silent `/* ignore */` catch |
| Parse failures return safe defaults and log a warning | FAIL — tasks.ts unblocked path catch is silent; telemetry.ts catch is silent; handoffs.ts returns error instead of safe default |
| No unguarded JSON.parse remains in any MCP tool handler | FAIL — telemetry.ts get_session_summary has `/* ignore */` catch which is the exact pattern the task was created to fix |

| Verdict | FAIL |
|---------|------|

**Score**: 5/10 — The two explicitly scoped files (wave.ts, context.ts) were correctly fixed. The logic in those files is sound and complete. However, the scope audit missed two production handlers with the exact failure pattern the task was created to address (silent `/* ignore */` catches in telemetry.ts, no per-field guards in handoffs.ts, silent catch in tasks.ts unblocked path). The acceptance criteria "every JSON.parse must be guarded with a logged warning" is not fully satisfied.

**Top Risk**: `handleGetSessionSummary` in telemetry.ts silently eats parse errors on worker cost/token data, producing wrong cost rollups with no diagnostic trace. This is the identical class of failure that triggered RETRO_2026-03-30_2 and is left unresolved.
