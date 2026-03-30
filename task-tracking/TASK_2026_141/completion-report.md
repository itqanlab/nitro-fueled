# Completion Report — TASK_2026_141

## Files Created
- `apps/cli/src/utils/cortex-db-init.ts` (~236 lines) — inlined DB schema DDL + `initCortexDatabase()`, returns `{ db, migrationsApplied }`
- `apps/cli/src/utils/cortex-sync-tasks.ts` (~189 lines) — `syncTasksFromFiles`, `reconcileStatusFiles`, per-task transactions, status/type/priority validation
- `apps/cli/src/utils/cortex-sync-entities.ts` (~106 lines) — `hydrateSessions`, `hydrateHandoffs`
- `apps/cli/src/utils/cortex-hydrate.ts` (~106 lines) — entry point, `runCortexStep()`, `clearImportedData()`
- `apps/cli/src/commands/db-rebuild.ts` (40 lines) — `db-rebuild` oclif command

## Files Modified
- `apps/cli/src/commands/update.ts` — added Step 5.5 cortex DB check, removed duplicate `node:fs` import, migration count logging

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | 5/10 → fixed (hoisted interfaces, extracted files, merged import) |
| Code Logic | 5.5/10 → fixed (FK delete order, per-task transactions, empty DB hydration, status validation, migration logging) |
| Security | 7/10 → fixed (table name allowlist, DB file 0o600, handoff size cap) |

## Findings Fixed
- **FK delete order** (`dropHydratableTables`): reversed to handoffs → events → tasks; prevents SQLite constraint violation in db:rebuild
- **Per-task transaction**: each task upsert now runs in its own transaction — one bad task.md no longer kills the full batch
- **Empty DB hydration**: `init-or-migrate` mode now hydrates if tasks table is empty even when DB file pre-existed
- **Status validation**: `syncTasksFromFiles` now validates status/type/priority against valid sets before upsert
- **Migration logging**: `applyMigrations` returns count; logged in update.ts Step 5.5 and db-rebuild.ts
- **File extraction**: original 359-line `cortex-hydrate.ts` split into 3 focused files under 200 lines
- **Inline interfaces**: `ColumnInfoRow` and `TaskRow` hoisted to module scope
- **Duplicate import**: merged `node:fs` imports in `update.ts`
- **Table name allowlist**: `applyMigrations` validates table name against `KNOWN_TABLES` before PRAGMA
- **DB file permissions**: `chmodSync(dbPath, 0o600)` after creation

## New Review Lessons Added
- `.claude/review-lessons/backend.md` — 5 new lessons from logic review
- `.claude/review-lessons/security.md` — 2 new patterns (PRAGMA allowlist, status validation consistency)

## Integration Checklist
- [x] Build passes (`pnpm build`) with zero TypeScript errors
- [x] `update.ts` Step 5.5 is guarded by `!flags['dry-run']`
- [x] `db-rebuild.ts` registered as oclif command (auto-discovered)
- [x] DB path matches MCP server: `.nitro/cortex.db`
- [x] Idempotency: `initCortexDatabase` uses `CREATE TABLE IF NOT EXISTS`, upserts use `ON CONFLICT DO UPDATE`
- [x] File-first: no file is ever modified by hydration

## Verification Commands
```bash
# Verify new utility files exist
ls apps/cli/src/utils/cortex-*.ts

# Verify build output
ls apps/cli/dist/utils/cortex-*.js
ls apps/cli/dist/commands/db-rebuild.js

# Check Step 5.5 is in update.ts
grep -n "Step 5.5" apps/cli/src/commands/update.ts

# Verify FK-safe delete order
grep -A 5 "clearImportedData" apps/cli/src/utils/cortex-hydrate.ts

# Verify table allowlist in cortex-db-init.ts
grep -n "KNOWN_TABLES" apps/cli/src/utils/cortex-db-init.ts
```
