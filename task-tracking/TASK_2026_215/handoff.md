# Handoff — TASK_2026_215

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified, +15 lines) — added custom_flows table, index, custom_flow_id migration
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (modified, +17 lines) — added CustomFlowStep, CustomFlow interfaces; added customFlowId to TaskCandidate
- apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts (modified, +26 lines) — added CustomFlowRow interface, updated TaskRow with custom_flow_id, updated getTaskCandidates query, added getCustomFlow() method
- apps/dashboard-api/src/auto-pilot/prompt-builder.service.ts (modified, +9 lines) — added customFlow to BuildPromptOpts, added CUSTOM FLOW OVERRIDE block injection
- apps/dashboard-api/src/auto-pilot/session-runner.ts (modified, +22 lines) — added custom flow loading and logging in spawnForCandidate

## Commits
- f93d6b8: feat(auto-pilot): add custom flow routing for TASK_2026_215

## Decisions
- Custom flow is resolved before `claimTask()` so that a missing flow (fallback) is detected before the claim, keeping the claim/spawn operation clean
- Review workers do not receive custom flows — they always follow the standard code-style → code-logic → security pipeline; custom flows only affect build/prep/implement phases
- Used `getCustomFlow()` in SupervisorDbService rather than embedding the query in SessionRunner to keep DB access centralized
- DB table `custom_flows` added to cortex schema (mcp-cortex package) so both the MCP server and the dashboard-api see the same table
- `custom_flow_id` on tasks is a plain TEXT column (no FK in the migration) because SQLite ALTER TABLE ADD COLUMN with foreign key references is valid but the FK cannot be enforced after creation; the application-level null check in `getCustomFlow()` handles the "flow deleted" case via the fallback path

## Known Risks
- TASK_2026_214 (Flow Editor CRUD) is still IN_PROGRESS — the `custom_flows` table will exist but be empty until 214 ships the insert/update endpoints. The fallback path handles this gracefully: `customFlowId` will be NULL for all tasks until 214 assigns flows.
- No TypeScript compilation check run — verify `unused import WorkerType` warning doesn't appear (WorkerType was already imported in prompt-builder.service.ts but not used by the new code; CustomFlow is used)
