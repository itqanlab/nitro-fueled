# Implementation Plan — TASK_2026_140

## Codebase Investigation Summary

### Libraries and Files Analyzed

- `packages/mcp-cortex/src/tools/sync.ts` — handleSyncTasksFromFiles() already does full
  upsert of all task-tracking/TASK_*/task.md files into DB. Does NOT compare statuses or
  fix drift. All helpers (parseTaskFile, parseSection, etc.) are local to this file.
- `packages/mcp-cortex/src/index.ts` — sync_tasks_from_files registered at line 98. Pattern
  for registering a new no-input tool: `server.registerTool('name', { description: '...' },
  () => handler(db, projectRoot))`. Verified: no Zod inputSchema needed for zero-arg tools.
- `apps/cli/src/commands/status.ts` — run() calls generateRegistry(cwd) then parseRegistry(cwd).
  No cortex path exists yet. DB path detection pattern to follow: check existsSync on
  `.nitro/cortex.db` relative to cwd.
- `.claude/commands/nitro-create-task.md` — Step 5 writes the status file. Step 5b commits.
  No DB write anywhere. The addendum belongs at the END of Step 5 (after the status file
  write, before Step 5b commit).
- `.claude/skills/orchestration/SKILL.md` — Build Worker Handoff section at line 309.
  Writes `task-tracking/TASK_[ID]/handoff.md`. No DB call. Review Worker reads handoff.md
  as first action (line 332, 796).
- `.claude/skills/auto-pilot/SKILL.md` — Bootstrap note at line 194-197 already documents
  that sync_tasks_from_files() should be called once on first run. The nitro-cortex
  availability check (soft) happens at Step 2 via get_tasks(). No periodic reconciliation
  exists today.

### Patterns Identified

- **MCP tool registration pattern** (index.ts:98): zero-input tool uses `() => handler(db, projectRoot)`
- **DB-crash fallback pattern**: wrap MCP call in try/catch, log warning, continue on file path
- **File-wins principle**: status file is authoritative — DB is a mirror, not the source of truth
- **Best-effort DB writes**: agents call upsert after file write; on failure, log warning and continue

---

## Architecture Design

### Design Philosophy

The sync layer is a best-effort mirror. Files are always authoritative. The DB is a
queryable cache. All DB calls are wrapped in try/catch with graceful fallback. No new
TypeScript dependencies are introduced. All new code reuses existing helpers in sync.ts.

### Component Specifications

#### Component 1: reconcile_status_files() in sync.ts

**Purpose**: Walk task-tracking/TASK_*/status files, compare each file's status against
the DB row, update DB where they differ (file wins). Separate from
handleSyncTasksFromFiles() which does a full task.md + status upsert. This function is
lighter: it ONLY syncs the status field from the status file into the DB for tasks
that already have a DB row. Tasks with no DB row are skipped (not inserted — that is
handleSyncTasksFromFiles's job).

**Pattern source**: `packages/mcp-cortex/src/tools/sync.ts` — reuse TASK_ID_RE, readdirSync,
existsSync, readFileSync, and the db.prepare pattern already present in the file.

**Responsibilities**:
- Walk task-tracking/TASK_*/ directories (same loop as handleSyncTasksFromFiles)
- Read each `status` file (same path as parseTaskFile uses: join(taskDir, 'status'))
- For each task, check if a DB row exists (SELECT id, status FROM tasks WHERE id = ?)
- If DB row exists AND status differs: UPDATE tasks SET status = ?, updated_at = ... WHERE id = ?
- Count: drifted (fixed), matched (no change), missing (no DB row, skipped)
- Return JSON result: { ok, drifted, matched, missing }

**Implementation Pattern**:
```typescript
// Pattern: reuse db.prepare + TASK_ID_RE from this same file
export function handleReconcileStatusFiles(
  db: Database.Database,
  projectRoot: string,
): { content: Array<{ type: 'text'; text: string }> } {
  // walk task-tracking/, read status files, compare with DB, UPDATE where differs
  // returns { ok: true, drifted: N, matched: N, missing: N }
}
```

**Files Affected**:
- `packages/mcp-cortex/src/tools/sync.ts` (MODIFY — add handleReconcileStatusFiles export)

#### Component 2: Register reconcile_status_files MCP tool in index.ts

**Purpose**: Expose the new handler as an MCP tool so agents and the CLI can call it.

**Pattern source**: `packages/mcp-cortex/src/index.ts:98` — zero-arg tool registration:
```typescript
server.registerTool('reconcile_status_files', {
  description: '...',
}, () => handleReconcileStatusFiles(db, projectRoot));
```

**Files Affected**:
- `packages/mcp-cortex/src/index.ts` (MODIFY — add import + tool registration)

#### Component 3: DB render path in status.ts (CLI)

**Purpose**: When .nitro/cortex.db exists, call sync_tasks_from_files (via MCP or direct
import) then render from query_tasks(). Fall back to file scan on any error or when DB
absent.

**Decision on approach**: The CLI runs as a separate process from the MCP server. It cannot
call MCP tools directly via JSON-RPC without a running server. The practical path is to
import handleSyncTasksFromFiles and handleGetTasks directly from the package (same approach
used internally) — OR detect the DB file and open it directly via better-sqlite3.

**Evidence**: `packages/mcp-cortex/src/tools/sync.ts` and `tasks.ts` export their handlers
as plain functions that take a `Database.Database` instance. The CLI can instantiate the
DB directly using initDatabase() from `packages/mcp-cortex/src/db/schema.ts`, call
handleSyncTasksFromFiles(), then handleGetTasks() to render from DB.

**Fallback chain**:
1. Check if `.nitro/cortex.db` exists (existsSync)
2. If yes: open DB via initDatabase(), call handleSyncTasksFromFiles(), call handleGetTasks()
   to get rows, map to RegistryRow[], render
3. On any error from steps above: warn to stderr, fall back to generateRegistry() + parseRegistry()
4. If DB absent: proceed directly with file path (no warning needed)

**Files Affected**:
- `apps/cli/src/commands/status.ts` (MODIFY — add DB detection + cortex render path)

Note: This requires adding `@itqanlab/mcp-cortex` (or the relative workspace package) as
a dependency in `apps/cli/package.json`. The developer must verify the exact package
import path within the Nx workspace. If the import creates a circular dependency or build
complication, the fallback is to copy only initDatabase + handleSyncTasksFromFiles +
handleGetTasks inline — but the clean path is the shared import.

#### Component 4: upsert_task addendum in nitro-create-task.md

**Purpose**: After Step 5 writes the status file, attempt a best-effort DB upsert so the
new task is immediately visible via query_tasks() without requiring a manual sync.

**Placement**: End of Step 5, after the status file write line, before Step 5b (commit).

**Instruction to add**:
```
### Step 5c: Best-Effort Cortex Upsert (if cortex available)

If the MCP `upsert_task` tool is available, call it with the new task's metadata
(task_id, title, type, priority, status="CREATED", dependencies). This is best-effort —
if the call fails or the tool is unavailable, log a warning and continue. Do NOT block
task creation on DB availability.
```

**Files Affected**:
- `.claude/commands/nitro-create-task.md` (MODIFY — add Step 5c)

#### Component 5: Dual-write handoff in orchestration/SKILL.md

**Purpose**: After writing handoff.md to disk, the Build Worker should also call
write_handoff() MCP tool so the handoff is queryable from the DB. Dual-write:
file is authoritative, DB is the mirror.

The Review Worker read path: read_handoff() MCP first, fall back to handoff.md file if
MCP fails or DB unavailable.

**Placement**: In the Build Worker Handoff section (around line 332), immediately after
"Include handoff.md in the implementation commit". Add a new paragraph.

**Instruction to add**:
```
**Dual-write (best-effort)**: After writing handoff.md to disk, call `write_handoff()`
MCP tool with the same data. If the tool is unavailable or fails, log a warning and
continue — the file is authoritative. Do not retry.

**Review Worker read path**: Call `read_handoff(task_id)` first. If it returns a record,
use it. If unavailable or returns empty, read `task-tracking/TASK_[ID]/handoff.md` from
disk as fallback.
```

**Files Affected**:
- `.claude/skills/orchestration/SKILL.md` (MODIFY — add dual-write + read fallback to
  Build Worker Handoff section)

#### Component 6: Startup reconciliation in auto-pilot/SKILL.md

**Purpose**: When cortex_available = true, call reconcile_status_files() at session startup
(after sync_tasks_from_files bootstrap) so any status drift from the last session is fixed
before the Supervisor reads the task queue.

**Evidence**: The bootstrap note at SKILL.md line 194-197 already documents the
sync_tasks_from_files() call. The reconcile call should be added immediately after it.

**Placement**: In the nitro-cortex Availability Check section (around line 184), update the
bootstrap note AND add a note in the Session Lifecycle Startup Sequence that when
cortex_available = true, reconcile_status_files() is called right after
sync_tasks_from_files().

**Instruction to add**:
```
> **Startup reconciliation**: After sync_tasks_from_files() on first run, also call
> reconcile_status_files() to fix any status drift from previous sessions (file wins).
> This is best-effort — if it fails, log a warning and proceed.
```

**Files Affected**:
- `.claude/skills/auto-pilot/SKILL.md` (MODIFY — update bootstrap note + startup sequence)

---

## Integration Architecture

### Data Flow

```
Task creation (nitro-create-task)
  -> write task.md + status file  [file: authoritative]
  -> upsert_task() MCP [best-effort, no blocking]

Build Worker completion (orchestration/SKILL.md)
  -> write handoff.md [file: authoritative]
  -> write_handoff() MCP [best-effort]
  -> write status file: IMPLEMENTED [file: authoritative]

Supervisor startup (auto-pilot/SKILL.md)
  -> sync_tasks_from_files() [full import, bootstrap]
  -> reconcile_status_files() [status-only fix, ongoing]

nitro-fueled status (CLI)
  -> if .nitro/cortex.db exists:
       sync_tasks_from_files() + query_tasks() -> render
  -> else: generateRegistry() + parseRegistry() -> render
```

### Dependencies

- No new npm packages required for `packages/mcp-cortex`
- `apps/cli` may need a workspace package reference to `packages/mcp-cortex` for the DB path
  (developer must verify Nx workspace configuration and package.json dependencies)

---

## Batching Strategy for Team-Leader

### Batch 1 — TypeScript Code Changes (packages/mcp-cortex + apps/cli)

These are compiled code changes with type-safety requirements. Batch together so the
developer can verify the build passes as a unit.

| File | Change |
|------|--------|
| `packages/mcp-cortex/src/tools/sync.ts` | Add handleReconcileStatusFiles() export |
| `packages/mcp-cortex/src/index.ts` | Import + register reconcile_status_files tool |
| `apps/cli/src/commands/status.ts` | Add DB detection + cortex render path with fallback |

Acceptance check: `pnpm build` passes with no TypeScript errors. Manual smoke test:
`.nitro/cortex.db` absent -> file path renders correctly. DB present -> DB path renders.

### Batch 2 — Markdown Skill File Changes (.claude/ + task commands)

Pure documentation/instruction changes. No compilation required. Safe to apply in one
commit after Batch 1 is merged.

| File | Change |
|------|--------|
| `.claude/commands/nitro-create-task.md` | Add Step 5c: best-effort cortex upsert |
| `.claude/skills/orchestration/SKILL.md` | Add dual-write + read fallback to handoff section |
| `.claude/skills/auto-pilot/SKILL.md` | Add reconcile_status_files() to startup sequence |

Acceptance check: Instructions are unambiguous, best-effort framing is clear (no blocking
on DB failure), file-wins principle is explicit in every instruction.

---

## Quality Requirements

- **Crash safety**: Every DB call is wrapped in try/catch. On error: console.warn to stderr,
  continue on file path. DB crash must never break `nitro-fueled status` or any agent flow.
- **File wins**: If the DB has status X and the status file has status Y, Y always wins in
  reconcile_status_files(). This is non-negotiable.
- **Idempotency**: reconcile_status_files() and sync_tasks_from_files() are safe to re-run.
  Multiple calls produce the same result.
- **No new dependencies**: packages/mcp-cortex uses only existing better-sqlite3 + node:fs.
  apps/cli DB path uses existing workspace package — no new npm installs.
- **No backward compatibility layers**: this is a direct augmentation of existing tools,
  not a v1/v2 split.

---

## Risk Notes

1. **CLI package import complexity**: apps/cli importing packages/mcp-cortex introduces a
   build-time dependency. The developer must verify the Nx project graph allows this edge
   and that `apps/cli/package.json` lists the workspace package correctly. If it causes
   circular imports or build failures, the fallback is to open the SQLite DB directly
   using better-sqlite3 inline in status.ts (the DB schema is stable as of TASK_2026_138).

2. **MCP server must be running for DB path in CLI**: The CLI DB path does NOT require the
   MCP server to be running — it opens the SQLite file directly. This is intentional and
   correct: the CLI is a read-only consumer of the DB snapshot.

3. **reconcile_status_files vs sync_tasks_from_files overlap**: The two functions have
   overlapping behavior on the status field. The developer must ensure they do NOT conflict:
   sync_tasks_from_files() is the bootstrap (full upsert including title/type/etc);
   reconcile_status_files() is a lightweight status-only fix pass. Running both in sequence
   is correct and safe.

4. **Skill file instruction ordering**: The Step 5c addendum in nitro-create-task.md must
   not change the commit timing. The upsert happens BEFORE the commit (Step 5b) so the DB
   is current when the commit lands, but the commit does not depend on the upsert succeeding.

---

## Team-Leader Handoff

### Developer Type Recommendation

**Batch 1**: nitro-backend-developer (TypeScript, SQLite, Node.js CLI changes)
**Batch 2**: Any agent capable of editing markdown instruction files (nitro-backend-developer
is fine; this is documentation only)

### Complexity Assessment

**Complexity**: MEDIUM
**Estimated Effort**: Batch 1 = 2-3 hours, Batch 2 = 1 hour

### Files Affected Summary

**MODIFY**:
- `packages/mcp-cortex/src/tools/sync.ts`
- `packages/mcp-cortex/src/index.ts`
- `apps/cli/src/commands/status.ts`
- `.claude/commands/nitro-create-task.md`
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/auto-pilot/SKILL.md`

**CREATE**: none
**REWRITE**: none
