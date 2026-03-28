# Security Review — TASK_2026_120

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit reviewed:** `f66277a` — `feat(cortex): implement TASK_2026_120 — MCP tools, build fixes, zod 4 compat`

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 2     |
| MEDIUM   | 3     |
| LOW      | 3     |
| INFO     | 2     |

**Overall assessment:** The implementation uses parameterized queries throughout (no SQL injection surface), enables FK constraints, uses WAL mode, and correctly gitignores the database file. However, two high-severity issues compromise the integrity guarantees the system was designed to provide: an unhandled `JSON.parse` that can crash a tool handler, and a column whitelist that inadvertently allows `session_claimed` to be written via `update_task`, bypassing the atomic claim protocol.

---

## HIGH

### H-1 — `update_task` bypasses atomic claim protocol

**File:** `packages/mcp-cortex/src/tools/tasks.ts:3-7`

`UPDATABLE_COLUMNS` includes `session_claimed` and `claimed_at`:

```ts
const UPDATABLE_COLUMNS = new Set([
  'title', 'type', 'priority', 'status', 'complexity', 'model',
  'dependencies', 'description', 'acceptance_criteria', 'file_scope',
  'session_claimed', 'claimed_at',   // ← HIGH risk
]);
```

Any MCP client can call `update_task(task_id, fields: '{"session_claimed": "attacker-session"}')` and directly overwrite the claim on a task owned by another session — with no transaction protection, no concurrency guard, and no audit trail. This fully bypasses `claim_task`'s `SELECT … AND session_claimed IS NULL` guard and the atomicity guarantee that is central to the task coordination design.

**Impact:** Supervisor sessions can steal tasks from each other; claimed tasks can be orphaned; race conditions in multi-worker scenarios can result in two sessions executing the same task.

**Fix:** Remove `session_claimed` and `claimed_at` from `UPDATABLE_COLUMNS`. Claim state must only be mutated through `claim_task` and `release_task`.

---

### H-2 — Unhandled `JSON.parse` in `update_task` handler crashes tool invocation

**File:** `packages/mcp-cortex/src/index.ts:59`

```ts
}, (args) => {
  const parsed = JSON.parse(args.fields) as Record<string, unknown>;  // ← throws on malformed JSON
  return handleUpdateTask(db, { task_id: args.task_id, fields: parsed });
});
```

`JSON.parse` throws `SyntaxError` for any malformed input. There is no `try/catch`. An MCP tool handler that throws synchronously will propagate an unhandled exception. Depending on SDK error handling, this can crash the request, leave the MCP server in a degraded state, or surface an opaque internal error rather than a structured `{ok: false}` response.

A misconfigured agent or a fuzzing client can trigger this with a single call (e.g., `fields: "not-json"`).

**Impact:** DoS on the `update_task` tool; crash path exposes internal stack trace in SDK error output.

**Fix:** Wrap `JSON.parse` in a try/catch and return `{ok: false, reason: 'fields must be valid JSON'}` on parse failure.

---

## MEDIUM

### M-1 — `handleReleaseTask` accepts arbitrary `new_status` string without validation

**File:** `packages/mcp-cortex/src/tools/tasks.ts:78-88`

```ts
const info = db.prepare(
  'UPDATE tasks SET session_claimed = NULL, claimed_at = NULL, status = ?, updated_at = ? WHERE id = ?',
).run(args.new_status, now, args.task_id);
```

`args.new_status` is a raw `z.string()` at the MCP schema level — any string value is accepted. The SQLite `CHECK(status IN (...))` constraint is the only guard. When an invalid status value is passed, SQLite throws `CHECK constraint failed: tasks`, which propagates as an unhandled exception rather than a structured `{ok: false}` response.

**Impact:** Callers receive an opaque DB-level error. Stack traces in the error message can expose internal schema details. Repeated bad calls may leave tasks in a partially released state if the exception interrupts the handler after claim fields are written but before status is set (unlikely given single-statement run, but error wrapping is still required).

**Fix:** Validate `new_status` against the `TaskStatus` union before calling `db.prepare().run()`. Return `{ok: false, reason: 'invalid status'}` on validation failure.

---

### M-2 — `get_next_wave` claims `BEGIN` (deferred), not `BEGIN EXCLUSIVE` as spec requires

**File:** `packages/mcp-cortex/src/tools/wave.ts:19`

The function docstring (line 13) explicitly states: "Uses BEGIN EXCLUSIVE to prevent race conditions between sessions." However, `db.transaction()` in `better-sqlite3` defaults to `BEGIN` (deferred transaction), not `BEGIN EXCLUSIVE`.

Under concurrent load with multiple supervisor sessions calling `get_next_wave` simultaneously:
1. Session A begins a deferred transaction and reads `session_claimed IS NULL` candidates.
2. Session B begins a deferred transaction and reads the same candidates (deferred transactions do not block reads).
3. Session A's `UPDATE … WHERE session_claimed IS NULL` succeeds and claims the tasks.
4. Session B's `UPDATE … WHERE session_claimed IS NULL` finds 0 rows (correct — no double-claim), but silently returns fewer claimed tasks than `slots` requested, with no indication to the caller that contention occurred.

**Impact:** The race condition does not produce double-claiming (the WHERE clause is a correct guard), but it breaks the cardinality guarantee: a session requesting `slots=4` may receive 0–4 tasks without knowing contention occurred. The comment asserting `BEGIN EXCLUSIVE` is actively misleading — a future developer could rely on this incorrect claim.

**Fix:** Use `db.transaction(() => { ... }).exclusive()` (better-sqlite3's exclusive transaction API), or document accurately that the guard is row-level (no double-claim guaranteed, but exact count under contention is not).

---

### M-3 — No bounds validation on `slots` parameter

**File:** `packages/mcp-cortex/src/index.ts:65-69`, `packages/mcp-cortex/src/tools/wave.ts:31`

```ts
slots: z.number().describe('Max number of tasks to return (1-20)'),
```

The description says `1-20` but the schema imposes no constraints (`z.number()` only). The original removed schema had `.int().min(1).max(20)`. Passing:
- `slots: 0` → returns empty wave; session loop may spin indefinitely
- `slots: -1` → `wave.length >= -1` is always true; returns 0 tasks; no error
- `slots: 999999` → iterates all CREATED tasks; no practical cap; wasteful query
- `slots: 1.5` → accepted as a float; `wave.length >= 1.5` behaves oddly

**Impact:** Resource exhaustion (large `slots`), silent empty result (zero/negative `slots`), non-integer values causing subtle loop behavior.

**Fix:** Restore `.int().min(1).max(20)` on the `slots` schema.

---

## LOW

### L-1 — `as` type assertions violate project conventions and mask runtime type errors

**Files:**
- `packages/mcp-cortex/src/index.ts:59` — `as Record<string, unknown>`
- `packages/mcp-cortex/src/tools/tasks.ts:30` — `as Array<Record<string, unknown>>`
- `packages/mcp-cortex/src/tools/tasks.ts:55` — `as { session_claimed: string | null }`

CLAUDE.md convention: **No `as` type assertions — if the type system fights you, the type is wrong.** These casts are also incorrect safety-wise: the `as` assertion does not validate the shape at runtime. If `better-sqlite3` returns an unexpected column shape (e.g., after a schema migration), the cast silently proceeds and produces incorrect behavior downstream rather than surfacing a type error.

**Fix:** Use proper generics or runtime type guards (`instanceof`, property checks) instead of `as` assertions.

---

### L-2 — `JSON.parse(task.dependencies)` without try/catch in two locations

**Files:**
- `packages/mcp-cortex/src/tools/tasks.ts:37`
- `packages/mcp-cortex/src/tools/wave.ts:33`

Both files call `JSON.parse(task.dependencies)` on values read from the DB without try/catch. If the stored `dependencies` value is malformed JSON (e.g., from a failed sync, manual DB edit, or future schema migration), both handlers will throw an unhandled exception inside the `db.transaction()` or result loop.

**Impact:** Malformed data in a single row can crash the `get_tasks` or `get_next_wave` handler entirely, making those tools unavailable until the DB row is repaired.

**Fix:** Wrap both `JSON.parse` calls in try/catch; treat a parse failure as an empty dependency list with an error logged to `console.error`.

---

### L-3 — No file size limit in `sync.ts` file reader

**File:** `packages/mcp-cortex/src/tools/sync.ts:66`

```ts
const content = readFileSync(taskPath, 'utf8');
```

`readFileSync` has no size cap. In the task-tracking directory, `task.md` files are authored content and sizes are expected to be small. However, there is no guard preventing a very large file from being loaded into memory and stored in the DB. The entire `description` and `file_scope` sections are captured and stored.

**Impact:** Low severity in practice (controlled directory, no external input), but a crafted or corrupted task.md of sufficient size could cause memory pressure during sync. More of a defense-in-depth concern.

**Fix:** Add a size check (`fs.statSync(taskPath).size > MAX_TASK_FILE_SIZE`) and skip + error-log oversized files.

---

## INFO

### I-1 — `TaskType` enum includes `'BUG'` but project uses `'BUGFIX'`

**File:** `packages/mcp-cortex/src/db/schema.ts:6`

```ts
export type TaskType = 'FEATURE' | 'BUG' | 'REFACTOR' | 'DOCS' | 'TEST' | 'CHORE';
```

The SQLite CHECK constraint mirrors this: `CHECK(type IN ('FEATURE','BUG','REFACTOR','DOCS','TEST','CHORE'))`. The actual task tracking system uses `'BUGFIX'` in task.md files. The `sync.ts` importer will fail to upsert any existing `BUGFIX`-typed task (SQLite CHECK violation) and record it as an import error. Not a direct security issue, but a data integrity flaw that will silently exclude bug tasks from the DB.

---

### I-2 — Database path derived from `process.cwd()` at startup

**File:** `packages/mcp-cortex/src/index.ts:12-13`

```ts
const projectRoot = process.cwd();
const dbPath = join(projectRoot, '.nitro', 'cortex.db');
```

If the MCP server is started from an unexpected working directory (e.g., `/` or a home directory), the DB will be created outside the project root. There is no validation that `process.cwd()` is a valid nitro-fueled workspace. This is a configuration/deployment concern rather than a direct security issue, but a misconfigured MCP entry point could silently create a DB in the wrong location.

No fix required; noting for operational awareness.

---

## Files with No Security Issues

- `packages/mcp-cortex/package.json` — Dependencies are pinned to recent, non-EOL versions. No known CVEs in `better-sqlite3 ^11.8.2`, `@modelcontextprotocol/sdk ^1.28.0`, or `zod ^4.3.6`.
- `packages/mcp-cortex/tsconfig.json` — No security surface.
- `packages/mcp-cortex/project.json` — No security surface.
- `.gitignore` — `.nitro/` is correctly excluded; DB file will not be committed.
- `package.json` (root) — Workspace addition is additive only; no security impact.

---

## Positive Security Practices

- All SQL uses parameterized queries (`?` placeholders) throughout — no SQL injection surface.
- `UPDATABLE_COLUMNS` whitelist in `handleUpdateTask` correctly blocks arbitrary column injection (caveat: see H-1 for claim columns).
- `PRAGMA foreign_keys = ON` enforces referential integrity.
- WAL journal mode reduces DB corruption risk.
- SQLite CHECK constraints on all enum columns provide a DB-level safety net.
- `console.error` used for all diagnostics (correct for MCP stdio servers — avoids contaminating the MCP protocol stream on stdout).
- `.nitro/cortex.db` excluded from git.
