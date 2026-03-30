# Development Tasks - TASK_2026_141

**Total Tasks**: 5 | **Batches**: 3 | **Status**: 3/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `initDatabase(dbPath)` exports confirmed at `packages/mcp-cortex/src/db/schema.ts:236`: OK
- `handleSyncTasksFromFiles` and `handleReconcileStatusFiles` exports confirmed in `packages/mcp-cortex/src/tools/sync.ts`: OK
- `better-sqlite3 ^11.8.2` confirmed as direct dependency in `apps/cli/package.json`: OK
- DB path `.nitro/cortex.db` confirmed at `packages/mcp-cortex/src/index.ts:19`: OK
- Oclif `commands` directory is `./dist/commands` — filename `db-rebuild.ts` will auto-register as `db:rebuild`: OK
- Step numbering in `update.ts` confirmed: Step 5 = `printResults`, Step 6 = `handleRegen`, Step 7 = `writeManifest` — Step 5.5 inserts cleanly: OK

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| `apps/cli/tsconfig.json` sets `rootDir: ./src` — cross-package relative import `../../../packages/mcp-cortex/src/...` will escape `rootDir` and cause TypeScript compilation error | HIGH | Task 1.1 instructs developer to attempt compile after adding import; on failure, copy the three functions inline into `cortex-hydrate.ts` with a comment referencing their source |
| `packages/mcp-cortex` may not declare `@types/better-sqlite3` as dev dependency visible to CLI tsconfig — type inference for `db` parameter could fail | LOW | Use `import type Database from 'better-sqlite3'` at top of `cortex-hydrate.ts`; the type is already available via CLI's own `@types/better-sqlite3` dev dep |

---

## Batch 1: Core Hydration Utility COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Create `cortex-hydrate.ts` utility COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`
**Spec Reference**: plan.md — Component 1 (cortex-hydrate.ts), Integration Architecture
**Pattern to Follow**: `apps/cli/src/utils/manifest.ts` (named exports, no class, `node:fs` imports)

**Quality Requirements**:
- Export `CORTEX_DB_PATH_REL = '.nitro/cortex.db'` constant
- Export `HydrationResult` interface with `tasks: { imported, skipped, errors[] }`, `sessions: { imported, skipped }`, `handoffs: { imported, skipped }`, `drifted: number`
- Export `runCortexStep(cwd, mode: 'init-or-migrate' | 'rebuild'): HydrationResult | null`
- All internal functions not exported: `resolveDbPath`, `hydrateTasks`, `hydrateSessions`, `hydrateHandoffs`, `reconcileDrift`, `dropHydratableTables`
- `hydrateSessions`: scan `task-tracking/sessions/SESSION_*/`, match `SESSION_YYYY-MM-DD_HH-MM-SS` regex, INSERT OR IGNORE into sessions table with `source='file-import'` and `loop_status='stopped'`
- `hydrateHandoffs`: scan `task-tracking/TASK_*/handoff.md`, INSERT OR IGNORE with raw content stored as `decisions[0]` (JSON stringified array), empty arrays for `files_changed`, `commits`, `risks`
- `dropHydratableTables`: executes exactly `DELETE FROM tasks`, `DELETE FROM handoffs`, `DELETE FROM events` — never touches sessions or workers
- `init-or-migrate` mode: check `existsSync(dbPath)` BEFORE calling `initDatabase` to set `dbWasNew` flag; if new DB run full hydration, if existing run reconcile only
- `rebuild` mode: call `initDatabase`, then `dropHydratableTables`, then full hydration

**Validation Notes**:
- HIGH RISK — cross-package import. Attempt this import first:
  ```typescript
  import { initDatabase } from '../../../packages/mcp-cortex/src/db/schema.js';
  import { handleSyncTasksFromFiles, handleReconcileStatusFiles } from '../../../packages/mcp-cortex/src/tools/sync.js';
  ```
  Then run `cd /Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli && pnpm build` immediately.
  If TypeScript errors with "rootDir" or "outside rootDir", copy the three functions inline from source files and document with a comment: `// Inlined from packages/mcp-cortex/src/db/schema.ts — cross-package import blocked by tsconfig rootDir`
- Use `import type Database from 'better-sqlite3'` for type safety with the db parameter

**Implementation Details**:
- Imports: `node:fs` (existsSync, readdirSync, readFileSync), `node:path` (resolve, join), `better-sqlite3` (default import for Database type only)
- Pattern: check db file existence before `initDatabase` call using `const dbWasNew = !existsSync(dbPath)`
- Session folder regex: `/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/`
- Session `started_at`: parse from folder name — `SESSION_2026-03-29_16-50-03` → `2026-03-29T16:50:03Z`
- Handoff `INSERT OR IGNORE`: check if row exists via `SELECT id FROM handoffs WHERE task_id = ?` before insert; task must already be in tasks table (inserted by hydrateTasks)
- `decisions` column stores JSON: `JSON.stringify([rawHandoffContent])`
- Wrap entire `runCortexStep` in try/catch; return `null` on any DB open failure

---

### Task 1.2: Build verification COMPLETE

**Action**: Run TypeScript build and confirm zero errors.

**Steps**:
1. `cd /Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli && pnpm build`
2. If cross-package import fails, apply inline fallback (see Task 1.1 validation notes) and rebuild
3. Confirm `dist/utils/cortex-hydrate.js` is emitted

**Quality Requirements**:
- Zero TypeScript errors
- `dist/utils/cortex-hydrate.js` must exist after build
- No `// TODO` or `// PLACEHOLDER` comments in source

---

**Batch 1 Verification**:
- `apps/cli/src/utils/cortex-hydrate.ts` exists with real implementation
- Build passes: `cd apps/cli && pnpm build`
- nitro-code-logic-reviewer approved

---

## Batch 2: Wire into Update Command COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 1 | **Dependencies**: Batch 1 must be COMPLETE

### Task 2.1: Insert Step 5.5 into `update.ts` COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/update.ts`
**Spec Reference**: plan.md — Component 2, Integration Architecture (update command data flow)
**Pattern to Follow**: Existing step comments in `update.ts` lines 226-298 — same style, same `!flags['dry-run']` guard pattern

**Quality Requirements**:
- Add import: `import { runCortexStep } from '../utils/cortex-hydrate.js';`
- Insert Step 5.5 block between line 271 (`printResults(...)`) and line 274 (the `if (flags.regen)` block)
- Step 5.5 comment must read: `// Step 5.5: Cortex DB check — create/migrate/reconcile`
- Guard entire block with `if (!flags['dry-run'])`
- Log output exactly per spec: hydrated counts, handoff count, drift fixes, warnings from `tasks.errors`, and "Database in sync with files" when both imported=0 and drifted=0
- Do NOT modify any existing steps — surgical insert only

**Validation Notes**:
- The exact insertion point is after line 271 `printResults(results, manifest, latestVersion, flags['dry-run']);` and before line 273 `// Step 6: Handle --regen`
- The `cwd` variable is already declared at line 219 — reuse it, do not redeclare

**Implementation Details**:
- Import line goes at the top of the file with other utils imports (after line 11 `getPackageVersion` import)
- No new flags needed — reuses existing `flags['dry-run']` from `this.parse(Update)`
- `runCortexStep` is synchronous — no `await` needed

---

**Batch 2 Verification**:
- `update.ts` has the import and Step 5.5 block
- Step numbers remain sequential: 1, 2, 3, 4, 5, 5.5, 6, 7
- Build passes: `cd apps/cli && pnpm build`
- nitro-code-logic-reviewer approved

---

## Batch 3: db:rebuild Command COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: Batch 1 must be COMPLETE (Batch 2 can be parallel)

### Task 3.1: Create `db-rebuild.ts` command COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/db-rebuild.ts`
**Spec Reference**: plan.md — Component 3 (db-rebuild.ts)
**Pattern to Follow**: `apps/cli/src/commands/status.ts` (BaseCommand pattern, imports structure)

**Quality Requirements**:
- Class name: `DbRebuild extends BaseCommand`
- `static override description = 'Drop and re-hydrate cortex DB from task-tracking files'`
- Import: `import { BaseCommand } from '../base-command.js'` and `import { runCortexStep } from '../utils/cortex-hydrate.js'`
- Call `runCortexStep(cwd, 'rebuild')` — on null result, set `process.exitCode = 1` and return
- Output format exactly per spec: header block, "Rebuilding..." message, import counts, optional skipped/warnings lines, "Rebuild complete."
- `default export` (required for oclif command discovery)
- No flags needed for initial implementation

**Validation Notes**:
- Oclif maps `db-rebuild.ts` → `db:rebuild` via colon-from-hyphen convention; no `oclif.json` changes needed
- `cwd = process.cwd()` — no manifest needed for this command (rebuild works regardless of manifest)

**Implementation Details**:
- Imports: `BaseCommand` from base-command, `runCortexStep` and `CORTEX_DB_PATH_REL` (optional, for display) from cortex-hydrate
- No `this.parse()` needed — no flags
- Console output: empty line, title, separator `===`, empty line, status message, result lines, empty line, "Rebuild complete."

---

### Task 3.2: Build and smoke test COMPLETE

**Action**: Build and verify command is registered.

**Steps**:
1. `cd /Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli && pnpm build`
2. Verify `dist/commands/db-rebuild.js` is emitted
3. Run: `node dist/index.js db:rebuild --help` from inside `apps/cli/`
4. Confirm the command description appears without error

**Quality Requirements**:
- Zero TypeScript errors
- `dist/commands/db-rebuild.js` must exist
- `--help` output must show description: "Drop and re-hydrate cortex DB from task-tracking files"

---

**Batch 3 Verification**:
- `apps/cli/src/commands/db-rebuild.ts` exists with real implementation
- Build passes
- `db:rebuild --help` shows command
- nitro-code-logic-reviewer approved
