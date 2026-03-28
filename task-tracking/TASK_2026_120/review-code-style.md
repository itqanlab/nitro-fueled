# Code Style Review — TASK_2026_120

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit reviewed:** `f66277a` — `feat(cortex): implement TASK_2026_120 — MCP tools, build fixes, zod 4 compat`

---

## Summary

Overall the code is clean and readable. The primary style violations are `as` type assertions and bare `string` types where string literal unions should be used. Secondary issues include a missing `as const` pattern, inconsistent formatting in one location, and a `TaskType` enum mismatch. No unused imports or dead code found.

**Severity legend:** BLOCKER | MAJOR | MINOR | INFO

---

## Issues by File

### `packages/mcp-cortex/src/index.ts`

#### [BLOCKER] `as` type assertion — line 59

```ts
const parsed = JSON.parse(args.fields) as Record<string, unknown>;
```

**Rule:** No `as` type assertions — if the type system fights you, the type is wrong.
**Fix direction:** `JSON.parse` returns `unknown`. Wrap in a runtime type guard or a small validation helper that returns `Record<string, unknown>` after checking `typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)`. This also catches the unhandled `JSON.parse` throw (which the logic reviewer should flag separately — noted here only as it relates to the assertion).

#### [MINOR] `new_status` parameter uses bare `string` — line 48

```ts
new_status: z.string().describe('New status to set'),
```

**Rule:** String literal unions for status/type/category fields — never bare `string`.
**Fix direction:** Use `z.enum(['CREATED','IN_PROGRESS','IMPLEMENTED','IN_REVIEW','COMPLETE','FAILED','BLOCKED','CANCELLED'])`. The allowed values are already defined in `TaskStatus` in schema.ts.

#### [MINOR] `status`, `type`, `priority` parameters use bare `string` — lines 29–32

```ts
status: z.string().optional().describe('Filter by task status'),
type: z.string().optional().describe('Filter by task type'),
priority: z.string().optional().describe('Filter by priority'),
```

**Rule:** String literal unions for status/type/category fields — never bare `string`.
**Fix direction:** Use `z.enum([...]).optional()` drawing from the exported unions in schema.ts.

#### [INFO] `slots` description says "1-20" but schema does not enforce it — line 67

```ts
slots: z.number().describe('Max number of tasks to return (1-20)'),
```

The description promises `1-20` but the schema is `z.number()`. This is a documentation/contract inconsistency — the description is misleading. The validation was present before (`.int().min(1).max(20)`) and was lost in the migration. Style note: descriptions should only document constraints that are actually enforced.

---

### `packages/mcp-cortex/src/db/schema.ts`

#### [BLOCKER] `TaskType` enum mismatch — line 6

```ts
export type TaskType = 'FEATURE' | 'BUG' | 'REFACTOR' | 'DOCS' | 'TEST' | 'CHORE';
```

**Rule:** Enum/union types must be synchronized across all consumers. The project uses `'BUGFIX'` in task files (e.g., `type: BUGFIX`), not `'BUG'`. The SQLite CHECK constraint on line 16 also uses `'BUG'`, meaning any task with type `BUGFIX` will fail to upsert with a constraint violation.
**Fix direction:** Replace `'BUG'` with `'BUGFIX'` in both the TypeScript union and the CHECK constraint string in `TASKS_TABLE`.

#### [INFO] SQL DDL strings declared at module level without `as const`

The `TASKS_TABLE`, `SESSIONS_TABLE`, `WORKERS_TABLE` constants and `INDEXES` array are module-level `const` — this is fine and correct. No issue.

---

### `packages/mcp-cortex/src/tools/tasks.ts`

#### [BLOCKER] `as` type assertion — line 30

```ts
const rows = db.prepare(`SELECT * FROM tasks ${where} ORDER BY id`).all(...params) as Array<Record<string, unknown>>;
```

**Rule:** No `as` type assertions.
**Fix direction:** `better-sqlite3`'s `.all()` returns `unknown[]`. Cast via a runtime shape check, or type the return as `unknown[]` and narrow via a typed interface that mirrors the tasks table columns (similar to `TaskRow` in wave.ts).

#### [BLOCKER] `as` type assertion — line 37

```ts
const deps = JSON.parse((row['dependencies'] as string) ?? '[]') as string[];
```

Two nested assertions. The outer `as string[]` and the inner `as string` both violate the rule.
**Fix direction:** Define a typed task row interface (like `TaskRow` in wave.ts), use it as the generic for `.all()`, then validate `deps` via `Array.isArray(deps) && deps.every(d => typeof d === 'string')`.

#### [BLOCKER] `as` type assertion — lines 54–55

```ts
).get(args.task_id, args.session_id) as { session_claimed: string | null } | undefined;
...
).get(args.task_id) as { session_claimed: string } | undefined;
```

**Rule:** No `as` type assertions.
**Fix direction:** Use a typed interface for the `SELECT session_claimed` projection and rely on it directly, or use a small runtime check on `typeof row === 'object'`.

#### [MAJOR] `handleGetTasks` parameter types use bare `string` — line 11

```ts
args: { status?: string; type?: string; priority?: string; unblocked?: boolean },
```

**Rule:** String literal unions for status/type/category fields — never bare `string`.
**Fix direction:** Use `TaskStatus`, `TaskType`, `TaskPriority` from schema.ts (already exported).

#### [MAJOR] `handleReleaseTask` and `handleUpdateTask` parameter types use bare `string` for status — lines 76, 92

```ts
args: { task_id: string; new_status: string },
```

**Rule:** String literal unions — never bare `string` for domain fields.
**Fix direction:** `new_status: TaskStatus` from schema.ts.

#### [MINOR] Magic string `'IN_PROGRESS'` inline — line 67

```ts
).run(args.session_id, now, 'IN_PROGRESS', now, args.task_id);
```

The status value `'IN_PROGRESS'` is a hardcoded string literal duplicated across at least two files (tasks.ts and wave.ts context). A shared constant or using the `TaskStatus` type reference would make this robust to future status renames.

---

### `packages/mcp-cortex/src/tools/wave.ts`

#### [MAJOR] `status` field in `TaskRow` uses bare `string` — line 7

```ts
interface TaskRow {
  id: string;
  dependencies: string;
  session_claimed: string | null;
  status: string;
}
```

**Rule:** String literal unions for status fields.
**Fix direction:** `status: TaskStatus` imported from schema.ts.

#### [INFO] Comment says "BEGIN EXCLUSIVE" but `db.transaction()` uses default `BEGIN` — line 12

```
 * Uses BEGIN EXCLUSIVE to prevent race conditions between sessions.
```

The comment is misleading — `better-sqlite3`'s `db.transaction()` defaults to `BEGIN`, not `BEGIN EXCLUSIVE`. The comment overstates the isolation guarantee. This is a documentation accuracy issue (not a style error per se, but misleading inline docs are a style concern).

---

### `packages/mcp-cortex/src/tools/sync.ts`

#### [MAJOR] `ParsedTask` interface uses bare `string` for `type`, `priority`, `status` — lines 9–17

```ts
interface ParsedTask {
  ...
  type: string;
  priority: string;
  status: string;
  ...
}
```

**Rule:** String literal unions for domain fields.
**Fix direction:** `type: TaskType`, `priority: TaskPriority`, `status: TaskStatus` imported from schema.ts.

#### [MINOR] `parseMetadataField` return fallback uses string literals without type safety — lines 74–75

```ts
type: parseMetadataField(content, 'Type') ?? 'CHORE',
priority: parseMetadataField(content, 'Priority') ?? 'P2-Medium',
```

Since `parseMetadataField` returns `string | null`, the fallback values are unchecked strings. Once `ParsedTask.type` is typed as `TaskType`, the compiler will flag this correctly — but the parsed value coming from the file could also be an invalid type. A small validation step (check against the union) is needed to maintain type safety.

#### [INFO] `'CHORE'` default for unknown type is a silent data quality issue

If a task.md has a type that doesn't match any known value (e.g., `'BUGFIX'` before the enum fix), the fallback `'CHORE'` silently misclassifies the task. An error entry would be more appropriate than a silent fallback. (Logic concern noted here for completeness — primary owner is logic reviewer.)

---

### `packages/mcp-cortex/package.json`

No style issues. Dependency versions, name, license, scripts, and engines field are all appropriate.

---

### `packages/mcp-cortex/tsconfig.json`

No style issues. `strict: true` is correctly set. `Node16` module/moduleResolution is correct for an ESM MCP server.

---

### `packages/mcp-cortex/project.json`

#### [MINOR] `projectType` is `"library"` but this is an executable MCP server — line 6

```json
"projectType": "library"
```

An MCP server that exposes a `bin` entry and runs as a process is an `"application"`, not a `"library"`. This is a semantic/convention mismatch in the Nx project definition.

---

## Issue Count by Severity

| Severity | Count |
|----------|-------|
| BLOCKER  | 5     |
| MAJOR    | 5     |
| MINOR    | 5     |
| INFO     | 4     |

---

## Blockers to Resolve Before Merge

1. **`as` assertion in index.ts:59** — `JSON.parse(args.fields) as Record<string, unknown>`
2. **`as` assertion in tasks.ts:30** — `.all(...params) as Array<Record<string, unknown>>`
3. **`as` assertion in tasks.ts:37** — double-nested assertions in dependency filtering
4. **`as` assertions in tasks.ts:54–55** — claim/existing row fetch
5. **`TaskType` enum mismatch in schema.ts:6** — `'BUG'` vs project-standard `'BUGFIX'` (also in CHECK constraint)
