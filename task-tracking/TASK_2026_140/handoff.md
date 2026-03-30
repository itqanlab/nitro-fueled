# Handoff — TASK_2026_140

## Files Changed
- packages/mcp-cortex/src/tools/sync.ts (modified, +51 lines — added handleReconcileStatusFiles export)
- packages/mcp-cortex/src/index.ts (modified, +6 lines — imported + registered reconcile_status_files MCP tool)
- apps/cli/src/commands/status.ts (modified, +53 lines — added DB detection path + dbRowsToRegistryRows helper)
- apps/cli/package.json (modified, +3 lines — added better-sqlite3 + @types/better-sqlite3 dependencies)
- .claude/commands/nitro-create-task.md (modified, +24 lines — inserted Step 5c best-effort upsert_task)
- .claude/skills/orchestration/SKILL.md (modified, +17 lines — dual-write + Review Worker read path in handoff section)
- .claude/skills/auto-pilot/SKILL.md (modified, +11 lines — reconcile_status_files in bootstrap note + startup sequence)

## Commits
- (pending implementation commit)

## Decisions
- CLI opens SQLite directly via better-sqlite3 (fallback approach) rather than importing packages/mcp-cortex — avoids Nx build edge complexity, DB schema is stable post-TASK_2026_138
- reconcile_status_files() is status-only (no INSERT), distinct from sync_tasks_from_files() which is the full bootstrap upsert; both are safe to run in sequence
- Dynamic import avoided in CLI in favour of require() pattern due to Node16 module resolution + esModuleInterop interaction with CJS better-sqlite3 default export
- All DB calls are best-effort: try/catch with console.warn, never blocking file-based operation

## Known Risks
- apps/cli/package.json now depends on better-sqlite3 — if the Nx build later enforces strict workspace dependency declarations, package.json may need to reference the mcp-cortex workspace package instead of a direct npm dep
- Pre-existing TypeScript errors in subscriptions.ts (mcp-cortex) and init.ts (cli) are unrelated; this task introduces zero new errors
- reconcile_status_files() skips tasks with no DB row — if cortex DB is fresh, a full sync_tasks_from_files() call must precede it for reconcile to have rows to compare
