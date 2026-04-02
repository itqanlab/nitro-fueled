# Task: Supervisor: Reconcile Task State on Worker Exit (Don't Trust Worker Self-Reporting)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | BUGFIX |
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

Workers are the sole source of task state transitions today. If a worker is killed, crashes, or exits without calling update_task/release_task, the task is left in a stale state (e.g., still PREPPED after an implement worker ran and died). This was observed in SESSION_2026-03-31T04-03-16: GLM-5.1 implement worker for TASK_2026_214 exited as 'completed' in the session workers list but did not transition the task to IMPLEMENTED, causing the supervisor to fire a redundant retry.

The fix: after detecting a worker process has exited (via get_pending_events or health check), the supervisor must independently reconcile the expected task state transition rather than relying on the worker to have done it. If the task state has not advanced as expected for the worker type, the supervisor should perform the state update itself (or mark the task FAILED and retry), not blindly respawn.

Specifically:
- After a build/implement worker exits: check task status. If still IN_PROGRESS/PREPPED/IMPLEMENTING, advance to IMPLEMENTED or mark FAILED.
- After a review worker exits: check task status. If still IN_REVIEW, advance to COMPLETE or mark FAILED.
- Log the discrepancy as an event for observability.
- This should work even if the worker was killed by OOM, context limit, or any external signal.

## Dependencies

- None

## Acceptance Criteria

- [ ] Supervisor reconciles task state after worker exit regardless of whether the worker called update_task
- [ ] If task state has not advanced after worker exit, supervisor advances it or marks it FAILED — never leaves it stale
- [ ] Discrepancy between expected and actual task state after worker exit is logged as an event
- [ ] No duplicate implement/review workers spawned for the same task due to false retries from stale state
- [ ] Behavior documented in parallel-mode.md worker completion section

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/parallel-mode.md


## Parallelism

✅ Can run in parallel — doc-only changes to auto-pilot skill files, no file scope conflicts with other CREATED tasks
