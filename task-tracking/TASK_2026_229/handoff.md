# Handoff — TASK_2026_229

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified, +7 migration entries)
- packages/mcp-cortex/src/tools/telemetry.ts (modified, +170 lines — 2 new handlers)
- packages/mcp-cortex/src/index.ts (modified, +2 tool registrations)

## Commits
- (see implementation commit below)

## Decisions
- New telemetry columns added via WORKER_MIGRATIONS (additive ALTER TABLE) — safe on existing DBs, all nullable
- `get_worker_telemetry` joins existing JSON columns (tokens_json, cost_json) with new flat columns for a unified response
- `get_session_telemetry` aggregates per-worker telemetry across a session, grouping by phase and model
- `launcher_type` and `model_used` from the task spec map to existing `launcher` and `model` columns (already present); no duplicate columns added
- `token_usage` maps to existing `tokens_json`; `estimated_cost_usd` is derivable from `cost_json.total_usd` — no redundant storage

## Known Risks
- New fields (spawn_to_first_output_ms, total_duration_ms, etc.) start NULL — callers must populate them via update_task or future spawn_worker enhancements
- No automated population of timing fields — requires caller instrumentation to fill in these values
