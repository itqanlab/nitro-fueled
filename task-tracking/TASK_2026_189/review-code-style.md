# Code Style Review — TASK_2026_189

## Summary

Two files modified. The wave.ts change is clean and correct. The context.ts change swaps silent `/* ignore */` comments for `console.error` log lines, which is an improvement, but both files have issues worth documenting. The task's stated acceptance criteria are met — no unguarded `JSON.parse` remains in the two touched files — but the implementation introduces minor style inconsistencies and leaves an undiscussed inconsistency with how the same pattern is handled in tasks.ts.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

**wave.ts:41** — The `Array.isArray()` guard silently treats any non-array JSON value (e.g., a `null`, a number, a plain string `"TASK_2026_007"`) as "no dependencies". A task whose `dependencies` column contains a JSON string that is a single task ID rather than an array (legacy format or migration artifact) will be treated as dependency-free and claimed prematurely. This is documented in the handoff as a known risk, but no ticket was filed and no validation alarm is raised beyond `console.error`. The console.error message text (`"failed to parse dependencies"`) does not fire for the `Array.isArray` path — only for the actual catch path — so the silent coercion leaves no trace when non-array JSON is valid but wrong-shaped.

### 2. What would confuse a new team member?

**context.ts:71 vs context.ts:93** — Both parses use the same pattern but the `file_scope` parse (line 71) uses a `string ?? '[]'` fallback while the `dependencies` parse (line 93) does the same. That consistency is good. However, comparing this to **tasks.ts:107** (same `dependencies` parse, same fallback, but then `if (!Array.isArray(deps)) deps = []` applied outside the try block rather than inside), a new developer will see three slightly different guard idioms for the same operation across the same codebase. wave.ts uses the ternary inside `JSON.parse`, tasks.ts uses the fallback inside JSON.parse but the `Array.isArray` check outside, and context.ts uses the ternary inside without the `Array.isArray` check at all for dependencies. This is a fragmentation problem.

### 3. What's the hidden complexity cost?

**context.ts:71-74** — `file_scope` is parsed and guarded, but there is no `Array.isArray()` check after the parse succeeds. If the DB contains `file_scope = '"some_string"'` (valid JSON, not an array), the cast `fileScope = parsed as string[]` will not throw but will produce a value that behaves incorrectly downstream (string indices instead of paths). The same issue was explicitly fixed for `dependencies` in wave.ts via `Array.isArray()`, but was not carried through to `file_scope` or `dependencies` in context.ts. The inconsistency will only manifest at runtime with malformed data.

### 4. What pattern inconsistencies exist?

Three different guard idioms for the same `dependencies` field now exist across the codebase:

- **wave.ts:40-45** — `try { parsed = JSON.parse(...); deps = Array.isArray(parsed) ? parsed : []; } catch { console.error; deps = []; }` (most complete)
- **tasks.ts:107-111** — `try { deps = JSON.parse(...) } catch { deps = []; } if (!Array.isArray(deps)) deps = [];` (shape check outside try)
- **context.ts:93-97** — `try { parsed = JSON.parse(...); if (Array.isArray(parsed)) deps = parsed; } catch { console.error; }` (no `else` branch — `deps` stays `[]` on non-array, relies on initializer)

All three produce the same result in practice, but no shared helper function exists. This is the third time (tasks.ts, wave.ts, context.ts) this logic has been inlined rather than extracted. A `parseDepsJson(raw: string | null): string[]` helper would make the contract obvious and eliminate drift.

### 5. What would I do differently?

Extract a single `parseJsonArray(raw: string | null, label: string): string[]` helper in a shared utils file (or at the top of each handler file that needs it). This eliminates the three-way inconsistency documented above and gives the console.error a consistent format. The helper's signature makes the contract self-documenting: "this always returns an array, never throws".

---

## Findings

### [CS-001] — `file_scope` parse in context.ts lacks Array.isArray guard

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/context.ts:71-74`
- **Issue**: The `dependencies` parse in the same file (line 93) correctly checks `if (Array.isArray(parsed))` before assigning. The `file_scope` parse at line 71 does not — it assigns `fileScope = parsed as string[]` without verifying the parsed value is actually an array. If the DB column contains valid non-array JSON (e.g., a quoted string), the cast succeeds silently and `fileScope` contains a string iterated as individual characters later. The task description specifically named `file_scope` as a field prone to legacy format issues.
- **Suggestion**: Add `if (Array.isArray(parsed)) fileScope = parsed as string[];` matching the pattern already used at line 93.

### [CS-002] — `Array.isArray` non-array path in wave.ts emits no log warning

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/wave.ts:41`
- **Issue**: The catch block at line 42-45 logs a `console.error` when JSON.parse throws. But the `Array.isArray(parsed) ? parsed : []` branch on line 41 silently returns `[]` when the JSON is valid but not an array (e.g., `null`, `"TASK_2026_007"`). This is a distinct case from parse failure and should also log a warning, since it means the DB contains unexpected data that will cause the task to be picked up with no dependencies.
- **Suggestion**: Extract to a local block:
  ```typescript
  const parsed = JSON.parse(task.dependencies);
  if (Array.isArray(parsed)) {
    deps = parsed as string[];
  } else {
    console.error(`[nitro-cortex] get_next_wave: dependencies for ${task.id} is not an array (got ${typeof parsed}), treating as no deps`);
    deps = [];
  }
  ```

### [CS-003] — Three inlined copies of the same parse-deps-to-array logic

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/wave.ts:39-45`, `packages/mcp-cortex/src/tools/tasks.ts:106-112`, `packages/mcp-cortex/src/tools/context.ts:93-97`
- **Issue**: The same operation — "parse a JSON column that should be a string array, return `[]` on failure" — is inlined three times with three slightly different implementations. This is the third copy, and each copy diverges slightly. The next developer who needs to parse a new JSON-array column will create a fourth variant. The task was a good opportunity to introduce a shared helper.
- **Suggestion**: Define `function parseJsonStringArray(raw: string | null | undefined, fallback: string[] = []): string[]` in a shared location (or at least at the top of each file that uses it). It does not need to be a module export; even a file-local helper per tool file is better than N inlined variants.

### [CS-004] — console.error log prefix in context.ts omits field name in file_scope path

- **Severity**: minor
- **File**: `packages/mcp-cortex/src/tools/context.ts:74`
- **Issue**: The error message at line 74 is `"failed to parse file_scope for {task_id}"`. The dependencies error at line 96 is `"failed to parse dependencies for {task_id}"`. Both are clear. However, because the `file_scope` path has no `Array.isArray` check (see CS-001), when a non-array is parsed successfully, there is no log at all — so the inconsistency in CS-001 is also an observability gap.
- **Suggestion**: Resolve by fixing CS-001 and adding a log in the non-array branch, as described there.

---

## Verdict

| Verdict | PASS |
|---------|------|

The task's acceptance criteria are met: every `JSON.parse` in the two in-scope files is now wrapped in try/catch with safe defaults and a log. The changes are small, targeted, and do not introduce regressions. All findings are minor — none block correctness in the common path. The primary concern (CS-001) is an omission where the same task's fix was applied to one field but not another in the same file, which is the kind of issue most likely to surface with malformed real data. CS-003 is a long-term maintainability concern, not a defect today.

**Recommended follow-up** (not blocking this task):
- Fix CS-001 in a follow-up or in the same PR if the author prefers to keep the task scope tight.
- File a task for extracting a shared `parseJsonStringArray` helper to eliminate the three-way inconsistency before a fourth copy is added.
