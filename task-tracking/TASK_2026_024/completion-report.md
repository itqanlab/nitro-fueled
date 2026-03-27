# Completion Report — TASK_2026_024

## Files Created
- `packages/cli/src/utils/dashboard-helpers.ts` (110 lines) — shared constants, pollForPortFile, checkExistingService, openBrowser, findEntryScript, findWebDistPath, O_EXCL lock helpers
- `package.json` (15 lines) — workspace root with build:dashboard and dashboard scripts

## Files Modified
- `packages/cli/src/commands/dashboard.ts` — rewrote with shared helpers, --no-open flag (was --no-browser), auto-port default (was 4200), service discovery via health check + identity validation, O_EXCL lock prevents TOCTOU double-start
- `packages/cli/src/commands/run.ts` — supervisor integration: auto-starts dashboard service, prints URL in startup log, try/catch so dashboard failure never blocks Supervisor, process.on('exit') only for clean teardown
- `packages/cli/package.json` — added copy-web-assets script, dashboard-assets to files for self-contained published package
- `packages/dashboard-service/src/index.ts` — writes .dashboard-port on startup (actual OS-assigned port), deletes on shutdown, process.once for shutdown handlers
- `packages/dashboard-service/src/server/http.ts` — health endpoint returns service identity field for validation
- `packages/dashboard-service/src/cli-entry.ts` — default port changed from 4200 to 0 (auto-assign)

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | 5/10 (pre-fix) |
| Code Logic | 5/10 (pre-fix) |

## Findings Fixed
- **[BLOCKING] Code duplication** (pollForPortFile, checkExistingService, PORT_FILE_NAME in both CLI files) → extracted to shared `dashboard-helpers.ts`
- **[BLOCKING] findEntryScript lying return type** → now returns `string | null`
- **[BLOCKING] TOCTOU double-start race** → O_EXCL lock file (.dashboard-start.lock); second process waits and reuses port
- **[BLOCKING] startDashboardService not guarded** → wrapped in try/catch; Supervisor starts regardless
- **[BLOCKING] Web assets not embedded in published CLI** → copy-web-assets script + dashboard-assets in files; findWebDistPath checks embedded path first
- **[SERIOUS] Inconsistent constant names** → unified in dashboard-helpers.ts as STARTUP_TIMEOUT_MS
- **[SERIOUS] SIGINT/SIGTERM calling process.exit(0)** → removed; use process.on('exit') only; no conflict with spawnClaude's handlers
- **[SERIOUS] No service identity validation in health check** → /health now returns `service: 'nitro-fueled-dashboard'`; checkExistingService validates it
- **[SERIOUS] process.on vs process.once in shutdown handlers** → changed to process.once
- **[SERIOUS] openBrowser shell string interpolation** → replaced exec with execFile + array args
- **[MINOR] cli-entry.ts default port 4200** → changed to 0

## New Review Lessons Added
- Appended to `.claude/review-lessons/review-general.md` (by style reviewer): re-declaring exported constants locally, inconsistent return types across same-purpose helpers, signal handlers that skip async child cleanup
- Appended to `.claude/review-lessons/backend.md` (by logic reviewer): service identity in health checks, O_EXCL lock for TOCTOU, non-fatal optional startup wrapping

## Integration Checklist
- [x] `packages/cli/src/index.ts` already imports dashboard command — no changes needed
- [x] `dashboard-helpers.ts` exported properly as ESM module
- [x] TypeScript compiles without errors (`tsc --noEmit` passes for both packages)
- [x] `dashboard-assets/` added to CLI `files` for npm publish
- [x] Root workspace `build:dashboard` script builds web → service → copies assets

## Verification Commands
```bash
# Verify shared helpers exist
ls packages/cli/src/utils/dashboard-helpers.ts

# Verify TypeScript compiles
cd packages/cli && node_modules/.bin/tsc --noEmit
cd packages/dashboard-service && node_modules/.bin/tsc --noEmit

# Verify port file name exported from service
grep "PORT_FILE_NAME" packages/dashboard-service/src/index.ts

# Verify health identity field
grep "nitro-fueled-dashboard" packages/dashboard-service/src/server/http.ts
```
