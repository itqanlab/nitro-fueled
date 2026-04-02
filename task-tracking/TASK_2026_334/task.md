# Task: Complexity-Aware Pipeline Skip — Simple Tasks Skip PM+Architect


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Modify the worker prompt generation to skip PM and Architect phases for Simple-complexity tasks, reducing cost by ~50% for simple changes.

## What to build
- Update worker prompt builder (in SupervisorEngine or spawn logic) to check task complexity
- Simple tasks: skip PM phase (no task-description.md generation) and Architect phase (no plan.md generation)
- Simple tasks go directly to Team-Leader MODE 2 → Developer
- Medium/Complex tasks: unchanged, full PM → Architect → Team-Leader → Developer pipeline
- The worker prompt template should conditionally include/exclude phase instructions based on complexity
- Log which phases were skipped in the phase telemetry

## References
- Current worker prompts: `.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
- Orchestration SKILL.md phase definitions: `.claude/skills/nitro-orchestration/SKILL.md`
- Cost spike evidence: Simple task TASK_2026_052 cost $8.46 with full pipeline (should be <$2)
- Task complexity field: `packages/mcp-cortex/src/db/schema.ts` (tasks table, complexity column)

## Dependencies

- TASK_2026_334 — SupervisorEngine Class (provides the prompt generation context)

## Acceptance Criteria

- [ ] Simple tasks skip PM and Architect phases, going directly to Team-Leader + Developer
- [ ] Medium and Complex tasks still run the full pipeline unchanged
- [ ] Skipped phases are logged in telemetry for cost tracking
- [ ] Worker prompt for Simple tasks is measurably shorter (fewer tokens loaded)

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/engine.ts (modify — prompt generation)
- .claude/skills/nitro-auto-pilot/references/worker-prompts.md (modify — add Simple variant)


## Parallelism

Wave 5 — depends on TASK_2026_334. Can run independently after engine is built.
