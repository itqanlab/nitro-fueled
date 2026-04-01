# Development Tasks - TASK_2026_339

## Batch 1: CLI serve command - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Implement apps/cli/src/commands/serve.ts

**File**: apps/cli/src/commands/serve.ts
**Status**: COMPLETE

Oclif command that:
- Starts the dashboard-api (cli-entry.js) as a persistent foreground process via `spawn` with `stdio: 'inherit'`
- Accepts `--port` (default 3001) and `--open` flags
- Forwards SIGINT/SIGTERM to child for graceful shutdown
- Passes task-tracking-dir, port, anti-patterns, review-lessons to the entry script
- Polls the .dashboard-port file after startup and opens browser to /api/docs when --open is set
- Validates port range and entry script existence before spawning
