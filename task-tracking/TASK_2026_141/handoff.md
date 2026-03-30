# Handoff — TASK_2026_141

## Files Changed
- apps/cli/src/utils/cortex-db-init.ts (new, ~180 lines) — inlined DB schema DDL + `initCortexDatabase()` from mcp-cortex
- apps/cli/src/utils/cortex-hydrate.ts (new, ~310 lines) — `runCortexStep()` with full hydration/reconcile logic
- apps/cli/src/commands/update.ts (modified, +25 lines) — added Step 5.5 cortex DB check
- apps/cli/src/commands/db-rebuild.ts (new, 40 lines) — new `db-rebuild` oclif command

## Commits
- cb95f02: feat(cli): batch 3 - add db:rebuild command for TASK_2026_141
- (implementation commit pending — cortex-db-init.ts, cortex-hydrate.ts, update.ts)

## Decisions
- DB path is `.nitro/cortex.db` (not `.nitro-fueled/cortex.db`) — matches mcp-cortex MCP server path exactly
- Cross-package imports from mcp-cortex were inlined to avoid tsconfig `rootDir: ./src` violation — source references documented in comments
- `FIXING` removed from `VALID_STATUSES` — it is not in the DB CHECK constraint (8 valid statuses: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, FAILED, BLOCKED, CANCELLED)
- `dbWasNew = !existsSync(dbPath)` check before `initCortexDatabase` to distinguish new vs existing DB
- `db-rebuild` oclif command ID (not `db:rebuild`) — colon-topic requires nested subdirectory in oclif conventions
- Handoffs hydration stores raw markdown content as `decisions[0]` with empty arrays for structured fields — avoids fragile markdown parsing

## Known Risks
- The inlined schema in `cortex-db-init.ts` must be kept in sync with `packages/mcp-cortex/src/db/schema.ts` — manual drift is possible
- Sessions and handoffs hydration errors are counted in `skipped` but not surfaced in `HydrationResult.tasks.errors` — operator visibility gap for non-task hydration failures
- `worker_type` hardcoded to `'build'` in handoffs hydration — review worker handoffs would be misclassified (low risk currently)
