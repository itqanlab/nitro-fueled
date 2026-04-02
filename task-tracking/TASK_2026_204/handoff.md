# Handoff — TASK_2026_204

## Files Changed
- apps/dashboard-api/src/auto-pilot/session-runner.ts (new, ~487 lines)
- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (new, ~131 lines)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (modified, +12 lines — added UpdateConfigRequest)
- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (rewritten — session-centric DTOs)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (rewritten — thin facade over SessionManagerService)
- apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts (rewritten — session-centric REST API)
- apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts (modified — SessionManagerService replaces SupervisorService)
- apps/dashboard-api/src/auto-pilot/supervisor.service.ts (deleted — replaced by session-runner + session-manager)

## Commits
- (pending) refactor(dashboard): multi-session supervisor architecture for TASK_2026_204

## Decisions
- SessionRunner is a plain class (not NestJS injectable) — one instance per session, receives shared services via constructor
- SessionManagerService is the NestJS singleton managing Map<sessionId, SessionRunner>
- Config is mutable per session — updateConfig() merges partial config, takes effect on next tick
- REST API changed from `/api/auto-pilot/*` (action-based singleton) to `/api/sessions/*` (resource-based multi-session)
- WAL mode SQLite handles concurrent DB writes from multiple SessionRunners

## Known Risks
- Multiple SessionRunners writing to SQLite concurrently — WAL mode should handle this but needs real testing under load
- No limit on concurrent sessions — a malicious/buggy client could create unlimited sessions and exhaust resources
- The session-runner.ts is ~487 lines — cohesive but large. Could be split further if review flags it
