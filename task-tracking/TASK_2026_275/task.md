# Task: Add work_type Field to Task Template for Tier Routing


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
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

Add a work_type field to the task template to enable tier routing independent of complexity. A task's complexity tells you how hard the work is; work_type tells you what kind of cognitive effort it requires. Valid values: mechanical (test writing, docs, boilerplate — always light tier), implementation (coding against a plan — balanced tier), design (architecture, planning — heavy tier), judgment (code review, security audit — heavy tier). The Supervisor uses work_type as a routing signal that overrides or refines the complexity-based tier. A Simple task tagged design still gets a heavy-tier worker for that phase. Add the field to task-template.md with inline guidance, update the Supervisor routing table to include work_type, and update the task creator to prompt for it. NOTE TO USER: Test with one mechanical task and one design task to verify routing before applying to all tasks.

## Dependencies

- TASK_2026_274

## Acceptance Criteria

- [ ] work_type field added to task-template.md with valid values and inline guidance
- [ ] Supervisor routing table updated to factor work_type into tier selection
- [ ] Task creator prompts for work_type at creation time
- [ ] Test validation: create one mechanical task and one design task, verify each routes to the correct tier

## References

- task-tracking/task-template.md

## File Scope

- task-tracking/task-template.md
- .claude/skills/auto-pilot/SKILL.md
- .claude/commands/nitro-create-task.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_274 — both touch .claude/skills/auto-pilot/SKILL.md and nitro-create-task.md. Wave 2, after TASK_2026_274 completes.
