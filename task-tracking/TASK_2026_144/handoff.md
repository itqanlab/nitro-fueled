# Handoff — TASK_2026_144

## Files Changed
- apps/dashboard-service/ (deleted — entire legacy Node.js service directory)
- apps/dashboard-web/ (deleted — entire legacy React/Vite client directory)
- package.json (modified — removed build:dashboard script referencing deleted apps)
- apps/cli/src/utils/dashboard-helpers.ts (modified — removed local monorepo dev paths for dashboard-service and dashboard-web)
- apps/cli/src/commands/dashboard.ts (modified — updated error/warning messages to remove dashboard-service references)
- apps/cli/src/commands/run.ts (modified — updated log message to remove dashboard-service reference)

## Commits
- (to be filled after commit)

## Decisions
- Left migration-history comments in `apps/dashboard-api/src/dashboard/` unchanged — these are documentation of code origin, not functional references
- Kept published npm package paths in `dashboard-helpers.ts` (`@nitro-fueled/dashboard-service` and `@nitro-fueled/dashboard-web`) since they may be used in published CLI consumers; the functions gracefully return null/undefined when paths don't exist
- Removed only the local monorepo dev paths (`../../../dashboard-service/dist/...`, `../../../dashboard-web/dist`) that pointed directly into the now-deleted directories

## Known Risks
- The `dashboard` CLI command will not work after this removal until TASK_2026_145 (Dashboard API cortex migration) is complete — the new NestJS-based dashboard-api is not yet wired to the CLI dashboard command
- `package-lock.json` still references deleted apps — will auto-resolve on next `npm install`
