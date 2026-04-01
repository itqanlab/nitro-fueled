# Handoff — TASK_2026_334

## Files Changed
- packages/mcp-cortex/src/supervisor/engine.ts (new, 122 lines)
- packages/mcp-cortex/src/supervisor/engine.spec.ts (new, 101 lines)
- .claude/skills/nitro-auto-pilot/references/worker-prompts.md (modified, +87 lines — Simple variant added)

## Commits
- (see implementation commit)

## Decisions
- `engine.ts` created as a standalone module with the prompt builder functions — the full SupervisorEngine class (event loop) will be added by TASK_2026_338 to the same file
- `getBuildPipelineConfig` is the single source of truth for phase skipping logic; both `buildOrchestrationInstructions` and `buildPhaseTelemetry` delegate to it
- `Skipped-Phases` header added to commit footer for Simple workers so cost analytics can query it without parsing free-form text
- worker-prompts.md now has a dedicated "Simple Build Worker Prompt" section with a selection matrix table, clearly scoped to `complexity = Simple`
- The `buildWorkerPrompt` function renders a complete prompt string; placeholder `{agent-value}` is left for the Supervisor to fill (it depends on task type, not complexity)

## Known Risks
- The `engine.ts` module is a stub — the SupervisorEngine class (TASK_2026_338) will modify this file. If TASK_2026_338 rewrites engine.ts from scratch it needs to preserve the exported functions
- Simple tasks without tasks.md will need Team-Leader MODE 1 to generate it from task.md — the task.md must have sufficient detail (File Scope + Acceptance Criteria) for MODE 1 to work without a full plan.md
