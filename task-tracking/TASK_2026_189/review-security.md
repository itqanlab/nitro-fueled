# Security Review — TASK_2026_189

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 2                                    |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                                             |
|--------------------------|--------|---------------------------------------------------------------------------------------------------|
| Input Validation         | PASS   | Both files parse DB-sourced data; no external caller input reaches `JSON.parse` directly          |
| Path Traversal           | PASS   | context.ts uses `assertInsideBase(resolve, sep)` guard for task folder construction               |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys found                                                         |
| Injection (shell/prompt) | PASS   | No shell commands in the changed hunks; spawnSync with array form is used elsewhere in context.ts |
| Insecure Defaults        | FAIL   | wave.ts safe default (empty deps = "no deps") can silently promote tasks; see Serious Issue 1     |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Malformed Dependency String Silently Promotes Task Into Wave

- **File**: `packages/mcp-cortex/src/tools/wave.ts:39-45`
- **Problem**: When `JSON.parse(task.dependencies)` throws (malformed column data) or produces a non-array value, the catch block and the `Array.isArray` guard both fall through to `deps = []`. An empty `deps` array passes the `allDepsComplete` check unconditionally, so the task is scheduled immediately — as if it had no dependencies at all. A task that legitimately depends on one or more uncompleted tasks can therefore be claimed and executed out of order if its `dependencies` column ever contains corrupt, truncated, or legacy-format JSON.
- **Impact**: Out-of-order task execution. In a pipeline where Task B must not run before Task A completes, a one-time DB corruption event (e.g., partial write, encoding issue) causes Task B to be claimed and handed to a worker prematurely. The pipeline proceeds without raising an error, and the damage may only be discovered at the review or merge stage. This matches the `## Known Risks` entry in handoff.md; the risk is real and worth flagging even though it is pre-acknowledged.
- **Fix**: Log the malformed dependency data alongside the error so the corruption is attributable post-hoc:
  ```ts
  console.error(
    `[nitro-cortex] get_next_wave: failed to parse dependencies for ${task.id} ` +
    `(raw=${String(task.dependencies).slice(0, 80)}), treating as no deps`
  );
  ```
  Additionally, consider treating a parse failure as "blocked" (skip the task from the wave) rather than "no deps". That is a behavior-change decision, but it is safer than silent promotion; document whichever choice is made.

---

## Minor Issues

### Minor 1 — `console.error` messages in context.ts do not cap the raw field value before logging

- **File**: `packages/mcp-cortex/src/tools/context.ts:74` and `context.ts:96`
- **Problem**: The error message includes only the `task_id` (which is already sanitized by this point) and a static description, so there is no immediate leakage. However, the `raw` field value (i.e., the malformed JSON string stored in `file_scope` or `dependencies`) is NOT included at all. This is safe from a leakage standpoint, but misses the diagnostic opportunity. A future contributor who adds the raw value to the log may do so without a length cap (see `security.md` — "200-character cap on error strings").
- **Fix**: If the raw value is ever added to the log message, apply `String(task['file_scope']).slice(0, 80)` before including it.

### Minor 2 — `Array.isArray` check in wave.ts is not applied in context.ts parse paths

- **File**: `packages/mcp-cortex/src/tools/context.ts:70-75` (file_scope) and `context.ts:91-97` (dependencies)
- **Problem**: context.ts already has the `if (Array.isArray(parsed)) fileScope = parsed as string[]` pattern for `file_scope` (line 72) and the same for `deps` (line 94). This is correct and consistent with the wave.ts change. No action required for correctness, but note that neither path validates that the array *elements* are strings — a `JSON.parse` of `[1, 2, 3]` produces a number array that is cast directly to `string[]`. Downstream consumers that concatenate or compare elements will coerce numbers silently to strings without error.
- **Fix**: After the `Array.isArray` check, add element-type validation:
  ```ts
  if (Array.isArray(parsed) && parsed.every(e => typeof e === 'string')) {
    fileScope = parsed;
  }
  ```
  This is defense-in-depth; no currently exploitable vector exists.

### Minor 3 — Prototype pollution exposure from `JSON.parse` with no `Object.create(null)` isolation

- **File**: `packages/mcp-cortex/src/tools/wave.ts:40`, `packages/mcp-cortex/src/tools/context.ts:71, 93`
- **Problem**: `JSON.parse` of a string like `{"__proto__": {"isAdmin": true}}` mutates `Object.prototype` in Node.js versions prior to the prototype pollution fix (v16.17.0+). The inputs here come from SQLite columns written by trusted internal code, so the attack surface is narrow. However, if a DB row is ever created by an external caller (e.g., via an MCP tool that accepts raw JSON and stores it to `file_scope` or `dependencies`), a crafted payload could pollute the prototype.
- **Fix**: This is informational given the current trusted-DB data flow. If any MCP tool ever accepts and stores raw JSON strings to these columns from external callers, wrap the parse result in a safe container:
  ```ts
  const parsed = JSON.parse(raw);
  // Only extract specific keys; never spread the parsed object directly
  ```
  Alternatively, use a schema-validating parser (e.g., `zod.array(z.string()).safeParse(JSON.parse(raw))`) at the point of storage.

---

## Verdict

| Verdict    | PASS     |
|------------|----------|
| **Recommendation** | APPROVE |
| **Confidence**     | HIGH    |
| **Top Risk**       | Serious Issue 1: malformed dependency data silently schedules tasks as if they have no dependencies, enabling out-of-order pipeline execution. Pre-acknowledged in handoff.md but the risk is real; adding the raw value to the log (capped) would at minimum make incidents diagnosable without DB inspection. |
