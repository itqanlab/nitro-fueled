# Task: Supervisor: Per-Subtask Model Routing


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Route each subtask to the optimal model based on its individual complexity. This is where the cost savings happen -- a Complex parent task decomposed into 3 Simple subtasks and 1 Medium subtask uses Haiku for the Simple parts and Sonnet for the Medium part, instead of Opus for the entire task.

Routing rules:
- Simple subtask -> claude-haiku-4-5-20251001 (cheapest, fast)
- Medium subtask -> claude-sonnet-4-6 (balanced)
- Complex subtask -> claude-opus-4-6 (should be rare -- subtasks should not be Complex)
- If subtask has an explicit `model` field set, use that (override)
- If subtask has no complexity set, inherit from parent task

This integrates with the existing provider routing system (Two-Phase Provider Resolver). The subtask's model preference feeds into the resolver as the task-level model hint, same as top-level tasks.

The Supervisor already has model routing for top-level tasks. This task extends that to work with subtask-level granularity by reading the subtask's own complexity/model fields when spawning its worker.

## Dependencies

- TASK_2026_265 -- provides subtask-aware scheduling (this task adds model routing to that scheduling)

## Acceptance Criteria

- [ ] Subtask workers are spawned with models matching their individual complexity (Simple->Haiku, Medium->Sonnet, Complex->Opus)
- [ ] Explicit model field on subtask overrides complexity-based routing
- [ ] Subtasks without complexity inherit parent task's complexity for model routing

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/session-runner.ts (modified -- model selection for subtask workers)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (modified -- subtask model resolution)


## Parallelism

Cannot run in parallel with TASK_2026_265 (depends on it, same files). Sequential after subtask scheduling.
