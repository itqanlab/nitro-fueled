# Task: Review Worker: Holistic Parent Review After Subtask Completion


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

When all subtasks of a parent task reach IMPLEMENTED, trigger a holistic review of the parent task. The review worker reviews the combined changes from all subtasks -- not individual subtask reviews.

Current behavior: After a task reaches IMPLEMENTED, the Supervisor spawns a review worker for that task.
New behavior: 
- For tasks WITHOUT subtasks: behavior unchanged (review the task directly)
- For tasks WITH subtasks: when the last subtask reaches IMPLEMENTED (detected via get_parent_status_rollup), the Supervisor advances the parent to IMPLEMENTED and spawns a review worker for the PARENT task
- The review worker sees all file changes from all subtasks combined and reviews them holistically for coherence, integration issues, and acceptance criteria satisfaction
- Individual subtasks do NOT get separate review workers -- only the parent gets reviewed

The review worker prompt already reviews against acceptance criteria from task.md. Since the parent task.md has the original acceptance criteria (not the subtask-level ones), the review naturally validates the complete feature.

This requires the Supervisor to:
1. Detect when all subtasks of a parent are IMPLEMENTED
2. Advance parent status to IMPLEMENTED
3. Spawn review worker for parent (not subtasks)
4. Skip review spawning for individual subtasks

## Dependencies

- TASK_2026_265 -- provides subtask-aware scheduling and parent status rollup logic

## Acceptance Criteria

- [ ] Review worker is spawned for parent task (not individual subtasks) when all subtasks reach IMPLEMENTED
- [ ] Individual subtasks do not trigger separate review workers
- [ ] Review worker sees combined file changes from all subtasks and validates parent acceptance criteria

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/session-runner.ts (modified -- review trigger logic for subtask parents)
- .claude/skills/auto-pilot/SKILL.md (modified -- review phase subtask rules)


## Parallelism

Cannot run in parallel with TASK_2026_265 or TASK_2026_266 (depends on scheduling, overlaps session-runner.ts). Sequential after model routing.
