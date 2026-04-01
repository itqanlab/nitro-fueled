# Handoff — TASK_2026_339

## Files Changed
- apps/cli/src/commands/serve.ts (new, 101 lines)

## Commits
- (see implementation commit)

## Decisions
- Default port 3001 (matches task spec and NestJS dashboard-api convention)
- `--open` opens browser to `/api/docs` (the Swagger UI), not `/`, since serve is API-focused
- Reuses `findEntryScript`, `pollForPortFile`, `openBrowser`, and `dashboardFilePaths` from existing dashboard-helpers to stay DRY
- No lock mechanism unlike `dashboard` command — serve is single-instance foreground only
- `stdio: 'inherit'` so server logs stream directly to the terminal

## Known Risks
- If the entry script writes the port file on a different path than `dashboardFilePaths` returns, `--open` will fall back to the requested port — intentional best-effort
- No duplicate-instance guard (unlike the dashboard lock) — running two `serve` instances on the same port will fail at the OS level
