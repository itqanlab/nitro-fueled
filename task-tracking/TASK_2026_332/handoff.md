# Handoff — TASK_2026_332

## Files Changed
- packages/mcp-cortex/src/supervisor/types.ts (new, 59 lines)
- packages/mcp-cortex/src/supervisor/health.ts (new, 183 lines)
- packages/mcp-cortex/src/supervisor/health.spec.ts (new, 328 lines)

## Commits
- Implementation commit (see git log)

## Decisions
- Pure functions only — no DB calls; caller passes WorkerRecord data in and acts on results
- Strike map owned by caller (supervisor loop) so state persists across health check cycles
- IDLE_THRESHOLD_MS = 120_000 matches existing getHealth() in workers.ts for consistency
- Heartbeat uses progress.last_action_at as proxy (no separate heartbeat column on workers)
- reconcileWorkerExit uses exhaustive switch with `never` guard on default branch

## Known Risks
- If progress_json is stale (worker hasn't updated it), heartbeat may falsely appear healthy
- recoverStaleSession uses last_action_at not a dedicated DB heartbeat column — acceptable until a heartbeat column is added to workers table
