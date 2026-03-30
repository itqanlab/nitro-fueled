# Implementation Plan — TASK_2026_141
## CLI update command: DB migration and hydration for existing projects

---

## Codebase Investigation Summary

### Libraries and Tools Verified

- **better-sqlite3 `^11.8.2`**: Already a direct dependency of `apps/cli/package.json`. The CLI can open the DB directly without going through the MCP server.
- **`@oclif/core`**: Used for all CLI command classes. New `db:rebuild` command uses the same `BaseCommand` pattern.
- **`initDatabase(dbPath)`**: Exported from `packages/mcp-cortex/src/db/schema.ts:154`. Creates all 5 tables + indexes + column migrations. Idempotent — safe to call on an existing DB.
- **`handleSyncTasksFromFiles(db, projectRoot)`**: Exported from `packages/mcp-cortex/src/tools/sync.ts:85`. Scans `task-tracking/TASK_*/`, parses `task.md` + `status` file, upserts into `tasks` table. Already graceful — skips missing `task.md`, catches per-row errors.
- **`handleReconcileStatusFiles(db, projectRoot)`**: Exported from `packages/mcp-cortex/src/tools/sync.ts:152`. Compares `status` files on disk vs DB rows. File wins. Returns drift counts.

### Critical DB Path Finding

**The mcp-cortex server uses `.nitro/cortex.db`** (verified at `packages/mcp-cortex/src/index.ts:19`).

The task description says `.nitro-fueled/cortex.db`. This is a discrepancy. The CLI must use the same path as the MCP server, otherwise it creates a DB the server never reads.

**Decision**: Use `.nitro/cortex.db` to match `packages/mcp-cortex/src/index.ts`. The hydration util must document this path clearly with a constant.

### Existing Patterns Verified

- **Update command structure** (`apps/cli/src/commands/update.ts`): Steps are numbered in comments (Step 1–7). New cortex step slots in as Step 5.5, after scaffold copy but before manifest write.
- **`readManifest(cwd)`** / **`writeManifest(cwd, manifest)`**: Located in `apps/cli/src/utils/manifest.ts`. Manifest lives at `.nitro-fueled/manifest.json`.
- **CLI utils pattern**: All helpers live in `apps/cli/src/utils/`. The hydration logic belongs in a new `cortex-hydrate.ts` utility file, mirroring how `registry.ts`, `manifest.ts`, etc. are organized.
- **Session folder structure**: `task-tracking/sessions/SESSION_YYYY-MM-DD_HH-MM-SS/log.md` — sessions are directories, not flat files.
- **Handoff file structure**: `task-tracking/TASK_YYYY_NNN/handoff.md` — not all tasks have a handoff. Format is markdown with `## Files Changed`, `## Commits`, `## Decisions`, `## Known Risks` headings. The file is human-written prose, not machine-parseable JSON.

### What the Sync Layer Already Does (Reusable)

`handleSyncTasksFromFiles` already covers:
- Scanning all `TASK_YYYY_NNN` dirs
- Parsing `task.md` (title, type, priority, complexity, model, dependencies, file_scope, description)
- Reading `status` file
- Upsert-on-conflict (idempotent)
- Graceful skip on missing `task.md`

`handleReconcileStatusFiles` already covers:
- File-wins drift detection and correction for the `tasks` table

**These two functions are the core of the hydration flow.** The hydration utility in the CLI should call them directly (after opening the DB) rather than re-implementing the parsing logic.

### What Is NOT Covered by Existing Sync Layer

1. **Sessions hydration** — sessions in `task-tracking/sessions/SESSION_*/` are directory-based, file-only. The DB `sessions` table has `id, source, loop_status, started_at, ended_at, summary`. Only `id`, `source` (inferred as 'file-import'), and `started_at` (parsed from folder name) can be hydrated. `loop_status` defaults to `'stopped'`.
2. **Handoffs hydration** — `handoff.md` is human-written markdown. The `handoffs` table requires structured JSON (files_changed, commits, decisions, risks). Parsing free-form markdown into those arrays is fragile. The task description says "Scan `task-tracking/TASK_*/handoff.md` → INSERT INTO handoffs" — this should produce a minimal record: the raw content stored as a single decision string, with empty arrays for `files_changed`, `commits`, `risks`.

---

## Architecture Design

### Design Philosophy

The hydration logic runs **inside the CLI process**, directly opening the SQLite DB with `better-sqlite3`. This avoids any dependency on the MCP server being running during `update`. The same `initDatabase` function used by the server is reused to ensure schema parity.

All sync/parse logic from `packages/mcp-cortex/src/tools/sync.ts` is imported directly. No code duplication.

### Component Specifications

---

#### Component 1: `cortex-hydrate.ts` (NEW utility)

**File**: `apps/cli/src/utils/cortex-hydrate.ts`
**Purpose**: All DB-touching logic for the update and db:rebuild flows. Imported by both `update.ts` and `db-rebuild.ts`.

**Evidence for pattern**: `apps/cli/src/utils/manifest.ts`, `apps/cli/src/utils/registry.ts` — utility modules with named exports, no class wrappers, `node:fs` imports.

**Exports**:

```typescript
export const CORTEX_DB_PATH_REL = '.nitro/cortex.db';  // matches packages/mcp-cortex/src/index.ts:19

export interface HydrationResult {
  tasks: { imported: number; skipped: number; errors: string[] };
  sessions: { imported: number; skipped: number };
  handoffs: { imported: number; skipped: number };
  drifted: number;
}

/**
 * Opens or creates the cortex DB, runs initDatabase (schema + migrations),
 * then hydrates from files if the DB was just created or on explicit rebuild.
 *
 * @param cwd - project root (process.cwd() from the command)
 * @param mode - 'init-or-migrate': create+hydrate if missing, migrate+reconcile if exists
 *             - 'rebuild': drop tasks/handoffs/events rows, then re-hydrate from files
 * @returns HydrationResult or null if DB path is not accessible
 */
export function runCortexStep(
  cwd: string,
  mode: 'init-or-migrate' | 'rebuild'
): HydrationResult | null
```

**Internal functions** (not exported):

- `resolveDbPath(cwd): string` — returns `resolve(cwd, CORTEX_DB_PATH_REL)`
- `hydrateTasks(db, projectRoot): { imported, skipped, errors }` — thin wrapper around `handleSyncTasksFromFiles` from `packages/mcp-cortex/src/tools/sync.ts`
- `hydrateSessions(db, trackingDir): { imported, skipped }` — scans `task-tracking/sessions/SESSION_*/`, inserts one row per valid directory name matching `SESSION_YYYY-MM-DD_HH-MM-SS` pattern. Uses `INSERT OR IGNORE` (idempotent).
- `hydrateHandoffs(db, trackingDir): { imported, skipped }` — scans `task-tracking/TASK_*/handoff.md`, inserts one handoff row per file. Task must already be in DB (inserted by `hydrateTasks`). Uses `INSERT OR IGNORE` on `(task_id, worker_type)` synthetic uniqueness via checking existing row first. Stores raw file content as a single `decisions[0]` string. `files_changed`, `commits`, `risks` are empty arrays.
- `reconcileDrift(db, projectRoot): number` — thin wrapper around `handleReconcileStatusFiles`, returns `drifted` count.
- `dropHydratableTables(db): void` — called only in 'rebuild' mode. Executes `DELETE FROM tasks`, `DELETE FROM handoffs`, `DELETE FROM events`. Does NOT touch `sessions` or `workers`.

**Import strategy**: `initDatabase` is imported from the built mcp-cortex source. Since this is a monorepo with pnpm workspaces, the import uses a relative path to the package source:

```typescript
import { initDatabase } from '../../../packages/mcp-cortex/src/db/schema.js';
import { handleSyncTasksFromFiles, handleReconcileStatusFiles } from '../../../packages/mcp-cortex/src/tools/sync.js';
```

**Alternative if cross-package import causes tsconfig issues**: Copy the two functions inline. Flag this in implementation — developer should try relative import first and fall back to copy-inline only if TypeScript compilation fails.

---

#### Component 2: Update command step addition

**File**: `apps/cli/src/commands/update.ts` (MODIFY)
**Change**: Insert a new step between "Print results" (Step 5) and "Handle --regen" (Step 6).

The new step is called **Step 5.5: Cortex DB check**.

```typescript
// Step 5.5: Cortex DB check — create/migrate/reconcile
if (!flags['dry-run']) {
  console.log('');
  console.log('Checking cortex database...');
  const cortexResult = runCortexStep(cwd, 'init-or-migrate');
  if (cortexResult !== null) {
    if (cortexResult.tasks.imported > 0 || cortexResult.sessions.imported > 0) {
      console.log(`  Hydrated ${cortexResult.tasks.imported} tasks, ${cortexResult.sessions.imported} sessions`);
    }
    if (cortexResult.handoffs.imported > 0) {
      console.log(`  Hydrated ${cortexResult.handoffs.imported} handoffs`);
    }
    if (cortexResult.drifted > 0) {
      console.log(`  Fixed ${cortexResult.drifted} status drift(s)`);
    }
    if (cortexResult.tasks.errors.length > 0) {
      for (const e of cortexResult.tasks.errors) {
        console.warn(`  Warning: ${e}`);
      }
    }
    if (cortexResult.tasks.imported === 0 && cortexResult.drifted === 0) {
      console.log('  Database in sync with files');
    }
  }
}
```

The `if (!flags['dry-run'])` guard means dry-run skips the DB step entirely, matching how the existing update command handles dry-run (no files are written).

**Import to add**:
```typescript
import { runCortexStep } from '../utils/cortex-hydrate.js';
```

---

#### Component 3: `db-rebuild.ts` (NEW command)

**File**: `apps/cli/src/commands/db-rebuild.ts`
**Evidence for pattern**: `apps/cli/src/commands/update.ts`, `apps/cli/src/commands/status.ts` — oclif command class extending `BaseCommand`.

```typescript
import { BaseCommand } from '../base-command.js';
import { runCortexStep } from '../utils/cortex-hydrate.js';

export default class DbRebuild extends BaseCommand {
  public static override description = 'Drop and re-hydrate cortex DB from task-tracking files';

  public async run(): Promise<void> {
    const cwd = process.cwd();
    console.log('');
    console.log('nitro-fueled db:rebuild');
    console.log('=======================');
    console.log('');
    console.log('Rebuilding cortex database from files...');
    console.log('(sessions and workers tables are preserved)');
    console.log('');

    const result = runCortexStep(cwd, 'rebuild');
    if (result === null) {
      console.error('Error: Could not open cortex database.');
      process.exitCode = 1;
      return;
    }

    console.log(`Imported: ${result.tasks.imported} tasks, ${result.sessions.imported} sessions, ${result.handoffs.imported} handoffs`);
    if (result.tasks.skipped > 0) {
      console.log(`Skipped:  ${result.tasks.skipped} task folders (missing task.md)`);
    }
    if (result.tasks.errors.length > 0) {
      console.log('Warnings:');
      for (const e of result.tasks.errors) {
        console.warn(`  ${e}`);
      }
    }
    console.log('');
    console.log('Rebuild complete.');
  }
}
```

**oclif command registration**: The `db:rebuild` command ID is derived from the filename `db-rebuild.ts` under `commands/`. Oclif maps `db-rebuild` → `db:rebuild` automatically via its colon-from-hyphen convention. No additional config needed.

---

## Integration Architecture

### Data Flow — `update` command (mode: `init-or-migrate`)

```
update.run()
  -> readManifest (fail fast if no manifest)
  -> resolveScaffoldRoot
  -> walkScaffoldFiles
  -> processScaffoldFiles   [Step 4]
  -> printResults           [Step 5]
  -> runCortexStep(cwd, 'init-or-migrate')   [Step 5.5, skipped on dry-run]
      -> resolveDbPath(cwd) => {cwd}/.nitro/cortex.db
      -> initDatabase(dbPath)      [creates DB + tables + column migrations; idempotent]
      -> check: was DB just created? (stat mtime < 2s ago OR check tasks table row count = 0)
      -> if new DB: hydrateTasks + hydrateSessions + hydrateHandoffs
      -> if existing DB: reconcileDrift only
  -> handleRegen            [Step 6]
  -> writeManifest          [Step 7]
```

### Data Flow — `db:rebuild` command (mode: `rebuild`)

```
DbRebuild.run()
  -> runCortexStep(cwd, 'rebuild')
      -> resolveDbPath(cwd)
      -> initDatabase(dbPath)        [creates DB if missing, applies migrations if existing]
      -> dropHydratableTables(db)    [DELETE FROM tasks, handoffs, events]
      -> hydrateTasks + hydrateSessions + hydrateHandoffs
```

### "Was DB just created?" detection

The `init-or-migrate` mode needs to distinguish between a brand-new DB (hydrate fully) and an existing DB (reconcile only).

**Approach**: Before calling `initDatabase`, check if the DB file exists with `existsSync`. Store this as `dbWasNew: boolean`.

```typescript
const dbWasNew = !existsSync(dbPath);
const db = initDatabase(dbPath);
if (dbWasNew) {
  // full hydration
} else {
  // reconcile only
}
```

This is reliable and does not require any schema_version table.

---

## Key Decisions and Tradeoffs

### Decision 1: DB path is `.nitro/cortex.db`, not `.nitro-fueled/cortex.db`

**Evidence**: `packages/mcp-cortex/src/index.ts:19` — `const dbPath = join(projectRoot, '.nitro', 'cortex.db')`

The task description says `.nitro-fueled/cortex.db` but this conflicts with the actual server. Using `.nitro/cortex.db` ensures the CLI hydrates the same DB the MCP server reads from.

### Decision 2: Reuse `handleSyncTasksFromFiles` and `handleReconcileStatusFiles`

These functions already implement task parsing, upsert-on-conflict, graceful error handling, and drift detection. Re-implementing them in the CLI would create duplicate code. The cross-package import keeps logic in one place.

### Decision 3: Handoff hydration stores raw content as single decision entry

`handoff.md` files are free-form markdown written by agents. Parsing them into structured `files_changed` arrays would require fragile regex. Storing the raw content as `decisions[0]` with empty arrays for everything else is:
- Idempotent (same result every run)
- Graceful (never fails on format variance)
- Recoverable (the original file remains on disk)

This matches the task requirement: "Graceful — if hydration fails for one task, log warning and continue with next."

### Decision 4: Sessions hydration is minimal

The `sessions` table has live runtime fields (`loop_status`, workers, etc.) that cannot be reconstructed from files. Hydrating just `id` (from folder name) and `started_at` (parsed from folder name timestamp) is sufficient to give the DB a historical record without fabricating runtime state.

### Decision 5: `db:rebuild` does NOT drop sessions/workers

Per task spec: "Does NOT touch sessions/workers tables." These contain live MCP server runtime state. Only `tasks`, `handoffs`, `events` are cleared and re-hydrated.

### Decision 6: Skip cortex step on dry-run

The existing update command already gates all file writes behind `!flags['dry-run']`. The cortex step follows the same gate — it writes to a DB file, so dry-run skips it entirely. A future enhancement could add dry-run DB preview, but that is out of scope.

---

## Files Affected

### CREATE
- `apps/cli/src/utils/cortex-hydrate.ts` — all hydration logic
- `apps/cli/src/commands/db-rebuild.ts` — new db:rebuild command

### MODIFY
- `apps/cli/src/commands/update.ts` — insert Step 5.5 cortex DB check

---

## Quality Requirements

- **Idempotency**: Running `update` twice must produce the same DB state. Guaranteed by `initDatabase` (idempotent via `CREATE IF NOT EXISTS`), `handleSyncTasksFromFiles` (upsert-on-conflict), and `INSERT OR IGNORE` in sessions/handoffs.
- **Graceful failure**: If any single task.md is malformed, `handleSyncTasksFromFiles` catches the error, adds it to `errors[]`, and continues. The CLI logs warnings but does not abort.
- **No data loss**: DB is always built FROM files. Files are never modified by any hydration step.
- **Zero sessions/workers corruption**: `dropHydratableTables` executes exactly `DELETE FROM tasks`, `DELETE FROM handoffs`, `DELETE FROM events` — no DROP TABLE, no touch on sessions or workers.

---

## Team-Leader Handoff

### Developer Type
**Recommended Developer**: nitro-backend-developer
**Rationale**: Pure Node.js/TypeScript, SQLite, file-system work. No frontend changes.

### Complexity Assessment
**Complexity**: LOW-MEDIUM
**Estimated Effort**: 2-3 hours

### Implementation Batch Breakdown

**Batch 1 — Core utility** (can start immediately):
1. Create `apps/cli/src/utils/cortex-hydrate.ts` with `CORTEX_DB_PATH_REL` constant, `HydrationResult` interface, and all internal functions
2. Export `runCortexStep` function
3. Verify TypeScript compilation: `cd apps/cli && pnpm build`

**Batch 2 — Wire into update command**:
1. Add import of `runCortexStep` to `apps/cli/src/commands/update.ts`
2. Insert Step 5.5 block between printResults call and handleRegen call
3. Verify compilation

**Batch 3 — db:rebuild command**:
1. Create `apps/cli/src/commands/db-rebuild.ts`
2. Verify compilation and that `npx nitro-fueled db:rebuild --help` shows the command

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing (`initDatabase`, `handleSyncTasksFromFiles`, `handleReconcileStatusFiles` all confirmed in `packages/mcp-cortex/src/`)
- [x] `better-sqlite3` confirmed as existing CLI dependency
- [x] DB path discrepancy identified and resolved (`.nitro/cortex.db`)
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
