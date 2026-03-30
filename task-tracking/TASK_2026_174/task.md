# Task: GLM-5 Reliability Investigation — Health Check Tuning

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | RESEARCH    |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |

## Description

Investigate the GLM-5 worker reliability problem identified in RETRO_2026-03-30. Current data: 70% success rate (6 killed out of 20 spawns), 8 of 9 SPAWN FALLBACK events caused by glm-5 getting stuck or producing zero activity. The supervisor's fallback to claude/sonnet resolves most cases, but at the cost of wasted time and compute.

Research questions:
1. What are the specific failure modes? (stuck at planning, edit loops, zero activity, prompt too long)
2. Is there a correlation between task complexity/type and glm-5 failures?
3. Should the health check interval be shorter for glm-5 workers (detect stuck faster)?
4. Should glm-5 be restricted to certain task types (Simple complexity only)?
5. What prompt adjustments could improve reliability?

## Dependencies

- None

## Acceptance Criteria

- [ ] Analysis of all glm-5 failure events from session logs (2026-03-27 through 2026-03-30)
- [ ] Failure mode taxonomy with counts per mode
- [ ] Correlation analysis: task type/complexity vs failure rate
- [ ] Concrete recommendations: health check interval, task type restrictions, prompt changes
- [ ] If implementation warranted, create follow-on tasks for configuration changes

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Worker Health section
- Session logs: `task-tracking/sessions/SESSION_2026-03-28_*` and `SESSION_2026-03-30_*`
- Memory: `project_glm_reliability.md` — known 3 failure patterns

## File Scope

- `task-tracking/TASK_2026_174/task-description.md`
- `task-tracking/TASK_2026_174/plan.md`
- `task-tracking/TASK_2026_174/tasks.md`
- `task-tracking/TASK_2026_174/investigation.md`
- `task-tracking/TASK_2026_174/follow-on-tasks.md`
- `task-tracking/TASK_2026_174/handoff.md`
- `task-tracking/TASK_2026_174/session-analytics.md`

## Parallelism

✅ Can run in parallel — research task, no file modifications
