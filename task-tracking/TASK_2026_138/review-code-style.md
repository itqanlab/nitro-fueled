# Code Style Review — TASK_2026_138

## Score: 6/10

## Summary

The new code is functional and broadly follows the codebase's established patterns. However,
there are several style and type-safety issues that are inconsistent with how adjacent files
(`workers.ts`, `sessions.ts`) were written. The biggest concerns are: pervasive `as`-type
assertions where typed interfaces should be used, two parallel but non-identical column
whitelists that diverge silently, missing use of schema-exported union types in `handoffs.ts`,
and a stale version string in the startup log message. None of these are blocking bugs, but
three of them directly violate the project's documented TypeScript rules.

---

## Findings

### [C1] `handoffs.ts` uses bare `string` for `worker_type` instead of the exported `WorkerType` union

**File**: `packages/mcp-cortex/src/tools/handoffs.ts:6,14`

**Issue**: `HandoffFileEntry.action` is typed `string` when the valid values are constrained at
the DB level (`new | modified | deleted`). More critically, `HandoffRecord.worker_type` is
typed `string` even though `WorkerType = 'build' | 'review'` is exported from `db/schema.ts`.
`workers.ts` imports and uses `WorkerType` correctly (line 4). `handoffs.ts` does not import
it at all and falls back to bare `string`. This violates the anti-pattern rule: "String literal
unions for status/type/category fields — never bare `string`."

**Fix**: Import `WorkerType` from `'../db/schema.js'` and type `HandoffRecord.worker_type` as
`WorkerType`. Define a `HandoffAction = 'new' | 'modified' | 'deleted'` union and apply it to
`HandoffFileEntry.action`.

---

### [C2] `as`-assertions used for every DB row cast instead of typed row interfaces

**File**: `packages/mcp-cortex/src/tools/handoffs.ts:69-77`, `events.ts:68`

**Issue**: `handoffs.ts` casts every field out of `row` with individual `as string` / `as
number` assertions (lines 69-77). `events.ts` maps `row.data as string` (line 68). The project
rule is "No `as` type assertions — if the type system fights you, the type is wrong." The
established pattern in `workers.ts` is to define a private `interface WorkerRow` with all
fields typed, then cast the whole `.get()` result once as `WorkerRow | undefined`. Casting
field-by-field with `as` is noisier and still hides nullability issues.

**Fix**: Define a private `interface HandoffRow` (mirroring `WorkerRow` in `workers.ts`) with
all DB column types declared explicitly. Cast `.get()` once as `HandoffRow | undefined`. Do
the same for the event row in `events.ts`.

---

### [C3] Two diverging column whitelists for task upsert vs update

**File**: `packages/mcp-cortex/src/tools/tasks.ts:4-8` (UPDATABLE\_COLUMNS) vs `91-94` (UPSERTABLE\_COLUMNS)

**Issue**: `UPDATABLE_COLUMNS` (line 4-8) includes `session_claimed` and `claimed_at`, which
`UPSERTABLE_COLUMNS` (line 91-94) omits. The upsert UPDATE path explicitly says it uses "same
whitelist as update\_task" (per the handoff), but the code actually references `UPDATABLE_COLUMNS`
correctly. The problem is that two near-identical sets exist in the same file with no comment
explaining the intentional difference. A future maintainer adding a column to one set will not
know whether to add it to both. This is silent divergence waiting to happen.

**Fix**: Add an inline comment above `UPSERTABLE_COLUMNS` explaining why `session_claimed` and
`claimed_at` are excluded (upsert should not allow callers to forge claim state). This makes
the divergence intentional and documented rather than suspicious.

---

### [C4] `handleQueryEvents` limit clause uses string interpolation (SQL injection surface)

**File**: `packages/mcp-cortex/src/tools/events.ts:60,63`

**Issue**: The `LIMIT` value is interpolated directly into the SQL string:
```
const limitClause = ... ? `LIMIT ${Math.min(args.limit, 1000)}` : 'LIMIT 500';
```
While `Math.min()` on a number input makes this safe in practice today, it sets a pattern of
string-interpolated SQL. If `args.limit` is ever allowed to reach this path as `unknown`
(which it could if the Zod schema is loosened), the guard is the only thing standing between
this and injection. All other query builders in this file correctly use parameterized `?`
placeholders. SQLite supports `LIMIT ?` in prepared statements.

**Fix**: Use a parameterized limit: push the computed limit value into `params` and use
`LIMIT ?` in the query string.

---

### [C5] Stale version string in startup log message

**File**: `packages/mcp-cortex/src/index.ts:295`

**Issue**: The `McpServer` is registered as `version: '0.2.0'` (line 33) but the final
startup log says `v0.2.0 — sessions + workers` (line 295). This task added handoffs and
events, making the parenthetical description stale on day one. The version string and its
description will drift further as features are added.

**Fix**: Either remove the feature list from the log message (it is implementation noise), or
update it to `sessions + workers + handoffs + events`. Better long-term: derive the version
from `package.json` rather than hardcoding it in two places.

---

### [C6] `handleUpsertTask` re-aliases `args.fields` as `f` without adding clarity

**File**: `packages/mcp-cortex/src/tools/tasks.ts:129`

**Issue**: Line 129 does `const f = args.fields as Record<string, unknown>`. This is an
unnecessary `as` assertion (the type is already `Record<string, unknown>` from the parameter)
and introduces a single-letter alias `f` that is less readable than `args.fields`. Every
other handler in this file and in `sessions.ts` uses `args.fields` directly.

**Fix**: Remove the alias. Access `args.fields.title`, `args.fields.type`, etc., directly.
The `as` cast is a no-op here and reinforces the bad-assertion habit flagged in C2.

---

### [C7] `handleReadHandoff` returns `JSON.stringify(parsed, null, 2)` but `handleWriteHandoff` returns compact JSON

**File**: `packages/mcp-cortex/src/tools/handoffs.ts:52,79`

**Issue**: `handleWriteHandoff` returns `JSON.stringify({ ok: true, id: ... })` (compact),
while `handleReadHandoff` returns `JSON.stringify(parsed, null, 2)` (pretty-printed). This
matches the pattern used by `handleGetTasks` (pretty) vs `handleClaimTask` (compact), so it is
somewhat consistent with the broader codebase. However, within `handoffs.ts` itself the two
functions appear inconsistent without an obvious reason. The `handleGetSession` in
`sessions.ts` is pretty-printed and so is `handleReadHandoff` — that part is fine. But this
is worth noting because `handleLogEvent` in `events.ts` is compact while `handleQueryEvents`
is pretty, following the same write-compact / read-pretty split. The split is justified but
nowhere documented.

**Fix**: Add a brief comment at the top of each new file (or in `types.ts`) stating the
convention: "Write/mutation responses: compact JSON. Read/query responses: pretty-printed."
This is not a bug, but a clarification that will stop future contributors from second-guessing.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`C3` is the highest-risk maintenance trap. When a new task field is added (likely), a developer
will update `UPDATABLE_COLUMNS` and assume `UPSERTABLE_COLUMNS` is the same set. The silent
exclusion of `session_claimed` / `claimed_at` from upsert will cause a bug if that assumption
is wrong. No comment prevents this.

### 2. What would confuse a new team member?

The `f` alias in `handleUpsertTask` (C6) and the dual whitelists (C3) with no explanation.
Also, `HandoffRecord.worker_type: string` (C1) — a developer looking for where `WorkerType`
is used will not find `handoffs.ts` in the search results, suggesting it is somehow exempt
from the rule.

### 3. What's the hidden complexity cost?

The field-by-field `as` casts in `handleReadHandoff` (C2) mean any new DB column added to
`handoffs` must be manually added to the cast block. With typed interfaces (`HandoffRow`),
TypeScript would surface the omission at compile time. Current approach silently drops new
columns on reads.

### 4. What pattern inconsistencies exist?

- `handoffs.ts` does not import schema types; all other tool files that handle typed columns
  import the relevant unions from `db/schema.ts`.
- `events.ts` parameterizes all filters correctly but interpolates `LIMIT` (C4).
- `HandoffRecord` is exported from `handoffs.ts`; no equivalent row-shape interface is
  exported from `events.ts`, making external callers guess the event shape.

### 5. What would I do differently?

Define `HandoffRow` and `EventRow` private interfaces (matching the `WorkerRow` pattern in
`workers.ts`), use `WorkerType` for `HandoffRecord.worker_type`, parameterize the `LIMIT`
clause, remove the `f` alias, and document the compact-vs-pretty convention. These are all
one-line or two-line changes that bring the new files into full pattern parity.

---

## Pattern Compliance

| Pattern                             | Status | Concern                                             |
|-------------------------------------|--------|-----------------------------------------------------|
| No bare `string` for typed fields   | FAIL   | `HandoffRecord.worker_type` should be `WorkerType`  |
| No `as` type assertions             | FAIL   | Field-by-field casts in `handoffs.ts`, `events.ts`  |
| Parameterized SQL only              | WARN   | `LIMIT` clause uses string interpolation in events  |
| Consistent column whitelist design  | WARN   | Dual whitelists with no explanatory comment         |
| Schema type imports in tool files   | FAIL   | `handoffs.ts` imports no schema types               |
| Write-compact / read-pretty pattern | PASS   | Follows existing convention (undocumented)          |
| ToolResult return type used         | PASS   | All new handlers use `ToolResult` from `types.ts`   |
