# Task: Supervisor: Ensure IMPLEMENTED Tasks Always Get a Review Worker Before Session End


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | BUGFIX |
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

In SESSION_2026-03-31T04-03-16, TASK_2026_214 reached IMPLEMENTED status but the session ended with 0 terminal tasks and no review worker was ever spawned for it. The task is now orphaned at IMPLEMENTED.

Root cause: the supervisor's stop condition (tasks_terminal >= task_limit or no actionable tasks + no active workers) fired before evaluating IMPLEMENTED tasks that needed review workers. This could happen if: (1) the session hit the --limit N count prematurely, (2) the loop's Step 7 (stop-or-continue) evaluated before the IMPLEMENTED state was registered, or (3) the retry + recheck cycle consumed all concurrency slots and the loop exited before the next tick could spawn a review worker.

The fix: before the supervisor exits the loop, it must assert that no tasks are stranded at IMPLEMENTED without an active review worker. If any are found, either spawn a review worker (if slots available) or record them as a handoff warning in the session summary so the next session picks them up immediately.

## Dependencies

- TASK_2026_241

## Acceptance Criteria

- [ ] Supervisor never exits with tasks stranded at IMPLEMENTED and no active review worker
- [ ] Pre-exit check scans for IMPLEMENTED tasks with no active review worker; spawns review workers if slots exist
- [ ] If slots are full at exit, IMPLEMENTED orphans are recorded in session summary as a handoff warning
- [ ] Next session startup detects IMPLEMENTED tasks with no active workers and queues them for review immediately
- [ ] Behavior documented in parallel-mode.md session stop section

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/parallel-mode.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_241 — both modify the same auto-pilot skill files. Run after TASK_2026_241 completes.
