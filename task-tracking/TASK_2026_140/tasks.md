# Development Tasks - TASK_2026_140

**Total Tasks**: 6 | **Batches**: 2 | **Status**: 0/2 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `handleSyncTasksFromFiles` and `handleGetTasks` are exported plain functions taking a `Database.Database` instance — VERIFIED (sync.ts:85, tasks.ts:10)
- `TASK_ID_RE`, `readdirSync`, `existsSync`, `readFileSync`, `db.prepare` all present in sync.ts — VERIFIED (sync.ts:1-5)
- Zero-arg tool registration pattern `() => handler(db, projectRoot)` already used at index.ts:101 — VERIFIED
- `initDatabase` is exported from `packages/mcp-cortex/src/db/schema.ts` — assumed valid (follows the import at index.ts:7)
- Build Worker Handoff section in orchestration/SKILL.md — VERIFIED at line 309-334
- Bootstrap note in auto-pilot/SKILL.md — VERIFIED at line 194-197
- Status file path pattern `join(taskDir, 'status')` already used in sync.ts:parseTaskFile — VERIFIED (sync.ts:67-69)

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `apps/cli` has no dependency on `@itqanlab/nitro-cortex` in package.json | HIGH | Task 1.3: developer must add workspace package dep OR open SQLite inline with better-sqlite3. Fallback: inline open. |
| `RegistryRow` interface in registry.ts lacks `priority` field; DB rows have extra columns | LOW | Task 1.3: map only the 5 fields RegistryRow needs (id, status, type, description, created). Use 'Unknown' as fallback for created. |
| reconcile_status_files and sync_tasks_from_files both touch status field — ordering matters | MED | Document in Task 1.1: reconcile only updates rows that already exist in DB (no insert). Running both in sequence is safe. |

---

## Batch 1: TypeScript Code Changes - COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: None

### Task 1.1: Add handleReconcileStatusFiles to sync.ts - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sync.ts`
**Spec Reference**: plan.md lines 47-79
**Pattern to Follow**: `packages/mcp-cortex/src/tools/sync.ts` — reuse TASK_ID_RE, readdirSync, existsSync, readFileSync, db.prepare

**Quality Requirements**:
- File-wins: if DB has status X and status file has status Y, Y always wins
- Idempotent: safe to re-run multiple times, same result
- Only updates rows that already exist in DB — never inserts (that is handleSyncTasksFromFiles's job)
- Wraps everything in db.transaction() consistent with handleSyncTasksFromFiles pattern
- Returns `{ ok: true, drifted: N, matched: N, missing: N }` as JSON text content

**Validation Notes**:
- RISK: reconcile must NOT conflict with handleSyncTasksFromFiles. The two functions are safe in sequence because reconcile only does UPDATE (no INSERT) and only on the status field.
- Status file path: `join(taskDir, 'status')` — same as parseTaskFile at line 67-69

**Implementation Details**:
- Add after the existing `handleSyncTasksFromFiles` export (at end of file)
- Signature: `export function handleReconcileStatusFiles(db: Database.Database, projectRoot: string): { content: Array<{ type: 'text'; text: string }> }`
- Logic:
  1. Compute `trackingDir = join(projectRoot, 'task-tracking')`
  2. Guard: if `!existsSync(trackingDir)` return `{ ok: false, reason: 'task-tracking directory not found' }`
  3. `readdirSync(trackingDir, { withFileTypes: true })` — filter by `isDirectory() && TASK_ID_RE.test(name)`
  4. For each matching entry:
     - `statusPath = join(trackingDir, entry.name, 'status')`
     - If `!existsSync(statusPath)`: increment `missing` counter, continue
     - `fileStatus = readFileSync(statusPath, 'utf8').trim()`
     - `row = db.prepare('SELECT id, status FROM tasks WHERE id = ?').get(entry.name)` as `{ id: string; status: string } | undefined`
     - If `!row`: increment `missing` counter, continue (task not in DB — skip)
     - If `row.status === fileStatus`: increment `matched`, continue
     - Else: `db.prepare('UPDATE tasks SET status = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?').run(fileStatus, entry.name)`, increment `drifted`
  5. Wrap the loop in `db.transaction()`
  6. Return `{ content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, drifted, matched, missing }) }] }`

---

### Task 1.2: Register reconcile_status_files MCP tool in index.ts - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/index.ts`
**Spec Reference**: plan.md lines 81-93
**Pattern to Follow**: `packages/mcp-cortex/src/index.ts:99-101` — zero-arg tool registration

**Quality Requirements**:
- No inputSchema (zero-arg tool — same as sync_tasks_from_files at line 99-101)
- Import handleReconcileStatusFiles alongside handleSyncTasksFromFiles (same import line)
- Registration placed immediately after the sync_tasks_from_files registration (line 101)

**Validation Notes**:
- Zero-arg tools do NOT use `z` Zod inputSchema — confirmed from existing pattern at line 99-101

**Implementation Details**:
- Modify the import at index.ts line 10:
  `import { handleSyncTasksFromFiles, handleReconcileStatusFiles } from './tools/sync.js';`
- Add registration block immediately after the sync_tasks_from_files block (after line 101):
  ```typescript
  server.registerTool('reconcile_status_files', {
    description: 'Compare status files on disk against DB rows. Updates DB where file status differs (file wins). Only updates existing rows — does not insert. Returns { ok, drifted, matched, missing }.',
  }, () => handleReconcileStatusFiles(db, projectRoot));
  ```

---

### Task 1.3: Add DB render path to status.ts - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/status.ts`
**Spec Reference**: plan.md lines 95-125
**Pattern to Follow**: existing `existsSync` usage in status.ts:38-41

**Quality Requirements**:
- Crash safety: entire DB path wrapped in try/catch; on any error `console.warn` to stderr and fall through to existing file path
- DB absent: proceed directly to `generateRegistry() + parseRegistry()` with no warning
- DB present + success: skip `generateRegistry()` call (DB path renders from DB, not file scan)
- Mapping: DB rows have columns `id, title, type, priority, status, ...` — map to `RegistryRow` using only the 5 fields the interface requires
- `created` field: DB rows have `created_at` (ISO timestamp) — extract date portion with `.split('T')[0]` or use `'Unknown'` as fallback
- `description` field: DB rows have `title` column (the task title) — use `title` as description for the display

**Validation Notes**:
- RISK (HIGH): `apps/cli/package.json` has no `@itqanlab/nitro-cortex` dependency. Primary approach: add `"@itqanlab/nitro-cortex": "*"` (workspace) to `apps/cli/package.json` dependencies. If Nx workspace config does not support this cleanly, fallback: import `better-sqlite3` directly inline (it IS a dep of mcp-cortex but not cli — in that case open DB directly without any import from mcp-cortex).
- `RegistryRow` interface: `{ id: string; status: TaskStatus; type: string; description: string; created: string }` — no priority field needed

**Implementation Details**:

Step A — Add package dependency (primary approach):
- Add to `apps/cli/package.json` dependencies: `"@itqanlab/nitro-cortex": "*"`
- Add new imports at top of status.ts:
  ```typescript
  import { join } from 'node:path';
  import { initDatabase } from '@itqanlab/nitro-cortex/db/schema.js';
  import { handleSyncTasksFromFiles } from '@itqanlab/nitro-cortex/tools/sync.js';
  import { handleGetTasks } from '@itqanlab/nitro-cortex/tools/tasks.js';
  ```
  NOTE: If sub-path imports don't work in the Nx build, use the fallback below.

Step A (fallback — open SQLite inline without mcp-cortex import):
- Add to `apps/cli/package.json` dependencies: `"better-sqlite3": "*"` and devDependencies: `"@types/better-sqlite3": "*"`
- Import at top: `import Database from 'better-sqlite3';`
- Open DB directly: `const db = new Database(dbPath);`
- Then call handleSyncTasksFromFiles / handleGetTasks as dynamic imports or duplicate logic inline.
- SIMPLEST fallback: use better-sqlite3 directly and write a minimal inline query:
  `const rows = db.prepare('SELECT * FROM tasks ORDER BY id').all() as Array<Record<string, unknown>>;`
  (No need for handleGetTasks at all — just run the SELECT directly)

Step B — Modify the `run()` method of the `Status` class (lines 291-316):

Replace:
```typescript
public async run(): Promise<void> {
  const { flags } = await this.parse(Status);
  const cwd = process.cwd();
  generateRegistry(cwd);
  const rows = parseRegistry(cwd);
```

With:
```typescript
public async run(): Promise<void> {
  const { flags } = await this.parse(Status);
  const cwd = process.cwd();

  const dbPath = resolve(cwd, '.nitro', 'cortex.db');
  let rows: RegistryRow[] = [];
  let usedDb = false;

  if (existsSync(dbPath)) {
    try {
      // Primary: render from DB (DB is queryable cache, file is authoritative)
      // [DB import and usage — see Implementation Details Step A above]
      // After successful DB render, set usedDb = true
      // On any error: fall through to file path below
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[nitro-fueled] cortex DB unavailable (${msg}), falling back to file scan`);
    }
  }

  if (!usedDb) {
    generateRegistry(cwd);
    rows = parseRegistry(cwd);
  }
```

Step C — DB row to RegistryRow mapping helper (add as a module-level function):
```typescript
function dbRowsToRegistryRows(dbRows: Array<Record<string, unknown>>): RegistryRow[] {
  const result: RegistryRow[] = [];
  for (const row of dbRows) {
    const id = String(row['id'] ?? '');
    const rawStatus = String(row['status'] ?? 'CREATED');
    const status = (VALID_STATUSES.includes(rawStatus as TaskStatus) ? rawStatus : 'CREATED') as TaskStatus;
    const type = String(row['type'] ?? '');
    const description = String(row['title'] ?? row['description'] ?? '');
    const createdAt = String(row['created_at'] ?? '');
    const created = createdAt.includes('T') ? createdAt.split('T')[0]! : (createdAt || 'Unknown');
    if (id.length > 0) {
      result.push({ id, status, type, description, created });
    }
  }
  return result;
}
```

Note: `VALID_STATUSES` is already defined in registry.ts and imported via the existing import. If not accessible here, define it locally or import it explicitly.

---

**Batch 1 Verification**:
- All 3 files exist and are modified
- `pnpm build` (or `npx nx build mcp-cortex` + `npx nx build cli`) passes with no TypeScript errors
- Manual check: `reconcile_status_files` is registered as MCP tool in index.ts
- Manual check: `handleReconcileStatusFiles` exported from sync.ts
- nitro-code-logic-reviewer approved

---

## Batch 2: Markdown Skill File Changes - COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 3 | **Dependencies**: Batch 1 (must be COMPLETE before this batch starts)

### Task 2.1: Add Step 5c to nitro-create-task.md - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/nitro-create-task.md`
**Spec Reference**: plan.md lines 127-145
**Pattern to Follow**: existing Step 5 and Step 5b structure at lines 119-141

**Quality Requirements**:
- Best-effort framing: call MUST NOT block task creation
- Explicit: if upsert_task fails or is unavailable, log warning and continue
- Placement: after Step 5 (status file write), BEFORE Step 5b (commit) — so DB is current when the commit lands, but the commit does not depend on upsert succeeding
- Instruction must be actionable: agent knows exactly what fields to pass

**Validation Notes**:
- RISK: Step 5c must not change the commit timing. The upsert happens before Step 5b's commit but the commit is not conditional on upsert success.

**Implementation Details**:

Insert a new `### Step 5c` block between the end of Step 5 and `### Step 5b: Commit Task Creation`.

The current Step 5 ends at line 128 (the `> The registry is no longer appended...` note block ends at line 129). The `### Step 5b` heading is at line 131.

Add the following block immediately before `### Step 5b: Commit Task Creation`:

```markdown
### Step 5c: Best-Effort Cortex Upsert (if cortex available)

If the MCP `upsert_task` tool is available in the current session, call it immediately after writing the status file:

```
upsert_task(
  task_id: "TASK_YYYY_NNN",
  fields: JSON.stringify({
    title: "<title from Step 3>",
    type: "<type from Step 3>",
    priority: "<priority from Step 3>",
    status: "CREATED",
    complexity: "<complexity from Step 3>",
    dependencies: JSON.stringify([<array of dep task IDs, or empty>]),
    description: "<one-line description from Step 3>"
  })
)
```

This is **best-effort** — if `upsert_task` is unavailable (tool not in list) or returns an error, log a warning and continue:
> `[warn] cortex upsert failed for TASK_YYYY_NNN — proceeding without DB sync`

Do NOT retry. Do NOT block Step 5b. The status file on disk is always the authoritative record.
```

---

### Task 2.2: Add dual-write to orchestration/SKILL.md - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md`
**Spec Reference**: plan.md lines 147-167
**Pattern to Follow**: Build Worker Handoff section at SKILL.md lines 309-334

**Quality Requirements**:
- Best-effort framing: write_handoff() failure must never block the implementation commit
- File-wins explicit: handoff.md is authoritative; DB is the mirror
- Review Worker read path must specify fallback order: DB first, file second
- Both the Build Worker write instruction AND the Review Worker read instruction must be in the same section

**Validation Notes**:
- ASSUMPTION: `write_handoff()` MCP tool accepts the same fields as the handoff.md template (task_id, worker_type, files_changed, commits, decisions, risks). The tool signature was verified in index.ts:121-135 — confirmed.
- Review Worker currently reads handoff.md at line 332/796. The new instruction adds a DB-first path with file fallback.

**Implementation Details**:

The current Build Worker Handoff section ends with:
> "The Review Worker reads this file as its **first action** to scope the review." (line 332)

Append a new paragraph block immediately after that line (before the `> **Review Worker note**: Treat...` blockquote):

```markdown

**Dual-write (best-effort)**: After writing `handoff.md` to disk, call the `write_handoff()` MCP tool with the same data:

```
write_handoff(
  task_id: "TASK_[ID]",
  worker_type: "build",
  files_changed: [{ path: "...", action: "new|modified|deleted", lines: N }, ...],
  commits: ["<sha>: <message>", ...],
  decisions: ["<decision text>", ...],
  risks: ["<risk text>", ...]
)
```

If `write_handoff()` is unavailable or returns an error: log a warning and continue — the file is authoritative. Do not retry. Do not block the implementation commit.

**Review Worker read path**: Call `read_handoff(task_id: "TASK_[ID]")` first. If it returns a non-empty record, use that data. If the tool is unavailable, the call fails, or the result is empty — read `task-tracking/TASK_[ID]/handoff.md` from disk as fallback.
```

---

### Task 2.3: Add startup reconciliation to auto-pilot/SKILL.md - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 169-196
**Pattern to Follow**: Bootstrap note at SKILL.md lines 194-197

**Quality Requirements**:
- Must be added in two places: (1) the bootstrap note at line 194-197, (2) the Startup Sequence section (around line 213-220)
- Best-effort: if reconcile_status_files() fails, log warning and proceed
- File-wins principle must be explicit (file wins in reconcile)
- Must follow immediately after sync_tasks_from_files() in the sequence

**Validation Notes**:
- The bootstrap note at line 194-197 says sync_tasks_from_files() should be called "once" on first run. reconcile_status_files() is a separate lighter call that runs EVERY startup when cortex_available = true (not just first run).

**Implementation Details**:

Change 1 — Extend the bootstrap note (lines 194-197). The current text is:
```
> **Bootstrap note**: On first run against a new project, call `sync_tasks_from_files()`
> once to import existing task-tracking files into the nitro-cortex DB before calling
> `get_tasks()`. This only needs to run once (safe to re-run — upsert). After the initial
> sync, all subsequent state changes go through the MCP tools and the DB stays current.
```

Replace with:
```
> **Bootstrap note**: On first run against a new project, call `sync_tasks_from_files()`
> once to import existing task-tracking files into the nitro-cortex DB before calling
> `get_tasks()`. This only needs to run once (safe to re-run — upsert). After the initial
> sync, all subsequent state changes go through the MCP tools and the DB stays current.
>
> **Startup reconciliation**: On every startup when `cortex_available = true`, also call
> `reconcile_status_files()` immediately after `sync_tasks_from_files()`. This fixes any
> status drift from the previous session (file wins). This is best-effort — if it fails
> or the tool is unavailable, log a warning and proceed. Do not abort startup.
```

Change 2 — Add a reconcile step to the Startup Sequence (around line 213-220). In the `### Startup Sequence` section, after the step that describes Step 1 "Read State", add a note that when `cortex_available = true` the startup sequence includes:
- `sync_tasks_from_files()` (bootstrap/first run)
- `reconcile_status_files()` (status drift fix — every startup)

Locate the `### Startup Sequence` block (line 213) and append after the existing step list:

```markdown

> **When `cortex_available = true`**: After Step 5 (Read State), and before entering the Core Loop, call:
> 1. `sync_tasks_from_files()` — full task metadata import (bootstrap; safe to re-run)
> 2. `reconcile_status_files()` — status-only drift fix (runs every startup; file wins)
>
> Both calls are best-effort. On failure: `console.warn` and continue. Do not abort.
```

---

**Batch 2 Verification**:
- All 3 files exist and are modified
- Step 5c is present in nitro-create-task.md between Step 5 and Step 5b
- dual-write paragraph is present in orchestration/SKILL.md Build Worker Handoff section
- startup reconciliation text is present in BOTH the bootstrap note AND the Startup Sequence in auto-pilot/SKILL.md
- Best-effort framing present in all three instructions (no blocking on DB failure)
- File-wins principle explicit in Task 2.3 additions
- nitro-code-logic-reviewer approved
