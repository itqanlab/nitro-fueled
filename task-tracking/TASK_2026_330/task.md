# Task: Model Router Module — Adaptive Provider/Model Selection


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P0-Critical |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Build a pure TypeScript module at `packages/mcp-cortex/src/supervisor/router.ts` that selects the best provider/model/launcher for a given task+worker combination.

## What to build
- `routeModel(task: TaskMeta, workerType: WorkerType, providers: Provider[], history: CompatRecord[]): ModelSelection` — main routing function
- Scoring algorithm: weight historical success_rate (40%), cost_efficiency (30%), avg_duration (30%) from compatibility table
- Default routing when no history exists (from current parallel-mode.md defaults):
  - Prep Worker: claude/claude-sonnet-4-6
  - Implement Worker: glm/glm-5 (retry claude on failure)
  - Build Worker (single): claude/claude-sonnet-4-6
  - Review+Fix Worker: claude/claude-sonnet-4-6
- Respect task.preferred_tier override (light/balanced/heavy)
- Respect task.model override (specific model forces that model)
- Provider availability check (skip unavailable providers)

## References
- Current routing logic: `.claude/skills/nitro-auto-pilot/references/parallel-mode.md` Step 5
- Compatibility table: `packages/mcp-cortex/src/db/schema.ts` (compatibility table)
- Provider tool: `packages/mcp-cortex/src/tools/providers.ts` (get_available_providers)

## Dependencies

- None

## Acceptance Criteria

- [ ] routeModel returns correct default when no compatibility history exists
- [ ] routeModel uses weighted scoring from compatibility data when history is available
- [ ] Task-level overrides (preferred_tier, model) take precedence over adaptive routing
- [ ] Unavailable providers are excluded from selection
- [ ] Unit tests cover: no history, with history, tier override, model override, provider unavailable

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/router.ts (new)
- packages/mcp-cortex/src/supervisor/router.spec.ts (new)


## Parallelism

Wave 1 — can run in parallel with TASK_2026_330, 332, 333. No shared files.
