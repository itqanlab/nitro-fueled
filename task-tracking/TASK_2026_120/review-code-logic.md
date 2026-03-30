# Code Logic Review — TASK_2026_120

**Reviewer:** nitro-code-logic-reviewer
**Date:** 2026-03-28
**Scope:** packages/mcp-cortex/ (MCP server scaffold + SQLite schema + task tools)

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 3     |
| MEDIUM   | 3     |
| LOW      | 2     |

---

## HIGH Severity Issues

### 1. Unhandled `JSON.parse` exception in `update_task` handler

**File:** `packages/mcp-cortex/src/index.ts:59`

```typescript
const parsed = JSON.parse(args.fields) as Record<string, unknown>;
```

**Problem:** `JSON.parse` throws on malformed JSON input. No try/catch wrapper means a caller passing invalid JSON (`"not valid json"`) will crash the MCP tool handler with an unhandled exception.

**Impact:** Breaks the `update_task` tool on any invalid input, potentially crashing the MCP server connection.

**Fix:** Wrap in try/catch, return `{ ok: false, reason: 'invalid JSON in fields' }` on parse error.

---

### 2. Inconsistent status behavior between `claim_task` and `get_next_wave`

**Files:**
- `packages/mcp-cortex/src/tools/tasks.ts:65-67` (handleClaimTask)
- `packages/mcp-cortex/src/tools/wave.ts:44-48` (handleGetNextWave)

**Problem:** `handleClaimTask` sets `status = 'IN_PROGRESS'` when claiming:
```typescript
db.prepare(
  'UPDATE tasks SET session_claimed = ?, claimed_at = ?, status = ?, updated_at = ? WHERE id = ?',
).run(args.session_id, now, 'IN_PROGRESS', now, args.task_id);
```

But `handleGetNextWave` only sets the claim fields, NOT the status:
```typescript
db.prepare(
  'UPDATE tasks SET session_claimed = ?, claimed_at = ?, updated_at = ? WHERE id = ? AND session_claimed IS NULL',
).run(args.session_id, now, now, taskId);
```

**Impact:** Tasks claimed via `get_next_wave` remain in `CREATED` status while claimed. This breaks:
- Queries filtering by `status = 'IN_PROGRESS'` (won't find wave-claimed tasks)
- Task state machine consistency
- Dashboard/reporting accuracy

**Fix:** Add `status = 'IN_PROGRESS'` to the UPDATE in `handleGetNextWave`.

---

### 3. `TaskType` enum mismatch: `'BUG'` vs project's `'BUGFIX'`

**File:** `packages/mcp-cortex/src/db/schema.ts:6,16`

```typescript
export type TaskType = 'FEATURE' | 'BUG' | 'REFACTOR' | 'DOCS' | 'TEST' | 'CHORE';
// ...
CHECK(type IN ('FEATURE','BUG','REFACTOR','DOCS','TEST','CHORE'))
```

**Problem:** The schema uses `'BUG'` but the project's task files use `Type: BUGFIX` (visible in project conventions). When `sync_tasks_from_files` attempts to import a BUGFIX task, the SQL CHECK constraint fails.

**Impact:** Core use case broken — cannot import existing bugfix tasks from `task-tracking/`. The sync will error with a CHECK constraint violation.

**Fix:** Change `'BUG'` to `'BUGFIX'` in both the TypeScript type and SQL CHECK constraint.

---

## MEDIUM Severity Issues

### 4. `new_status` unvalidated in `handleReleaseTask`

**File:** `packages/mcp-cortex/src/tools/tasks.ts:75-88`

```typescript
export function handleReleaseTask(
  db: Database.Database,
  args: { task_id: string; new_status: string },
): { content: Array<{ type: 'text'; text: string }> } {
  // ...
  db.prepare(
    'UPDATE tasks SET session_claimed = NULL, claimed_at = NULL, status = ?, updated_at = ? WHERE id = ?',
  ).run(args.new_status, now, args.task_id);
```

**Problem:** No validation that `new_status` is a valid `TaskStatus` value. Any string is passed directly to SQL. The CHECK constraint will reject invalid values, but:
1. Error bubbles up as a raw SQLite exception, not a friendly response
2. Caller gets a cryptic error instead of `{ ok: false, reason: 'invalid status' }`

**Impact:** Bad UX, but DB constraint prevents actual corruption.

**Fix:** Validate `new_status` against valid status values before UPDATE. Return early with friendly error message.

---

### 5. Missing bounds validation on `slots` parameter

**File:** `packages/mcp-cortex/src/index.ts:67`

```typescript
slots: z.number().describe('Max number of tasks to return (1-20)'),
```

**Problem:** Schema is `z.number()` without `.int().min(1).max(20)`. The description says "1-20" but no actual constraint enforces it.

Allowed invalid inputs:
- `slots: -1` — returns empty array (harmless but illogical)
- `slots: 0` — returns empty array
- `slots: 0.5` — comparison `wave.length >= 0.5` is always true after first task (surprising behavior)
- `slots: 1000000` — iterates all candidates (performance issue with large task lists)

**Impact:** No crash, but illogical behavior and potential performance issues.

**Fix:** Change to `z.number().int().min(1).max(20)`.

---

### 6. `as` type assertions violate coding standards

**Files:** Multiple locations

- `index.ts:59` — `as Record<string, unknown>`
- `tasks.ts:30` — `as Array<Record<string, unknown>>`
- `tasks.ts:55` — `as { session_claimed: string | null } | undefined`
- `wave.ts:26` — `as TaskRow[]`

**Problem:** Review conventions state "No `as` type assertions — if the type system fights you, the type is wrong."

**Context:** These are at database result boundaries where `better-sqlite3` returns `unknown`. The assertions are arguably acceptable here since:
1. Database schema is controlled by this package
2. Type guards would add runtime overhead for known-safe casts

**Recommendation:** Document exception or use wrapper functions that return typed results.

---

## LOW Severity Issues

### 7. `acceptance_criteria` field not populated by sync

**Files:**
- `packages/mcp-cortex/src/db/schema.ts:22` — column exists
- `packages/mcp-cortex/src/tools/sync.ts:100-101` — not in INSERT

```typescript
// Schema has: acceptance_criteria TEXT
// But INSERT does not include it:
INSERT INTO tasks (id, title, type, priority, status, complexity, model, dependencies, description, file_scope)
```

**Problem:** `acceptance_criteria` is in schema but `handleSyncTasksFromFiles` does not parse or insert it. Column defaults to NULL.

**Impact:** Feature incompleteness — acceptance criteria from task.md files is not imported.

**Fix:** Add `parseSection(content, 'Acceptance Criteria')` call and include in INSERT/UPDATE.

---

### 8. Transaction isolation level differs from spec

**Files:**
- `packages/mcp-cortex/src/tools/tasks.ts:52` — `db.transaction()`
- `packages/mcp-cortex/src/tools/wave.ts:19` — `db.transaction()`

**Problem:** Task spec called for `BEGIN EXCLUSIVE` transaction for atomic claims. `better-sqlite3`'s `db.transaction()` uses `BEGIN IMMEDIATE` by default.

**Context:** For a single-process MCP server, `BEGIN IMMEDIATE` is functionally equivalent. Race conditions would only occur with multiple processes accessing the same database file, which isn't the current architecture.

**Impact:** Negligible in current use case. Would matter if multiple cortex instances share the same DB.

**Recommendation:** Leave as-is unless multi-process access is planned.

---

## Items Verified (No Issues Found)

- `handleGetTasks` correctly filters by whitelist columns (parameterized SQL)
- Dependency resolution in both `get_tasks(unblocked=true)` and `get_next_wave` is logically correct
- Transaction wrapping in `handleSyncTasksFromFiles` ensures atomicity
- Error accumulation in sync allows partial success with error reporting
- Graceful shutdown handlers in index.ts properly close database
- `.nitro/` is correctly added to `.gitignore`
- `packages/*` added to workspaces in root `package.json`

---

## Recommendations Summary

| # | File | Line | Action |
|---|------|------|--------|
| 1 | index.ts | 59 | Wrap JSON.parse in try/catch |
| 2 | wave.ts | 46 | Add `status = 'IN_PROGRESS'` to UPDATE |
| 3 | schema.ts | 6,16 | Change `'BUG'` to `'BUGFIX'` |
| 4 | tasks.ts | 77-82 | Validate `new_status` before UPDATE |
| 5 | index.ts | 67 | Add `.int().min(1).max(20)` to slots schema |
| 6 | sync.ts | 100 | Add `acceptance_criteria` to INSERT |
