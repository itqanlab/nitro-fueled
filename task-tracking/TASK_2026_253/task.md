# Task: MCP Cortex: Reject Tasks with Empty/Default Titles on Create


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | BUGFIX |
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

create_task and bulk_create_tasks should reject tasks where the title is empty, 'Untitled', or a placeholder. In a recent session, tasks 211-219 were created with 'Untitled' titles and processed by auto-pilot before anyone caught it. Validation should happen at the MCP layer so no tool can create a task without a meaningful title. Reject with a clear error message: 'Task title cannot be empty or "Untitled" — provide a descriptive title.'

## Dependencies

- TASK_2026_252

## Acceptance Criteria

- [ ] create_task rejects title that is empty, whitespace-only, or exactly 'Untitled' (case-insensitive)
- [ ] bulk_create_tasks rejects individual tasks with bad titles without blocking others
- [ ] Error message clearly explains what's wrong and what's expected
- [ ] Existing tasks with 'Untitled' are not affected (validation is create-time only)

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/


## Parallelism

✅ Can run in parallel — adds validation to existing tools, no conflicts
