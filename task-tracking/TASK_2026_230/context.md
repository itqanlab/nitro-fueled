# Context — TASK_2026_230

## Task
Instrument Worker Lifecycle — Emit Telemetry Events

## Type
FEATURE (Simple)

## Strategy
Minimal: direct developer invocation (clear file scope, well-defined requirements)

## Codebase State

### Telemetry Schema (from TASK_2026_229 — COMPLETE)
The workers table already has all required columns via WORKER_MIGRATIONS:
- `outcome` TEXT
- `retry_number` INTEGER
- `spawn_to_first_output_ms` INTEGER
- `total_duration_ms` INTEGER
- `files_changed_count` INTEGER
- `files_changed` TEXT (JSON array)
- `review_result` TEXT
- `review_findings_count` INTEGER
- `workflow_phase` TEXT

New MCP tools: `get_worker_telemetry`, `get_session_telemetry` (read-only)
New DB tables: `phases`, `reviews`, `fix_cycles`

### Server-Mode Architecture
- `apps/dashboard-api/src/auto-pilot/session-runner.ts` — tick loop, spawns workers, handles completions
- `apps/dashboard-api/src/auto-pilot/worker-manager.service.ts` — spawns child processes, tracks PIDs
- `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts` — direct SQLite writes

### Session-Mode Architecture
- `.claude/skills/nitro-auto-pilot/SKILL.md` — Supervisor skill prompt, uses MCP tools
- MCP write tools available: `log_phase`, `log_review`, `log_fix_cycle`

## Files to Modify
1. `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts` — add 4 new update methods, add workflow_phase to insertWorker
2. `apps/dashboard-api/src/auto-pilot/worker-manager.service.ts` — track spawn time, emit first-output and completion telemetry
3. `apps/dashboard-api/src/auto-pilot/session-runner.ts` — pass workflow_phase at spawn, emit review outcome on completion
4. `.claude/skills/nitro-auto-pilot/SKILL.md` — add telemetry call section
