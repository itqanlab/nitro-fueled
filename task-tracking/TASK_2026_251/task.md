# Task: MCP Cortex: bulk_update_tasks Tool


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

Add a bulk_update_tasks MCP tool that accepts an array of {task_id, fields} and updates them all in one call. Mirrors bulk_create_tasks but for updates. Use case: cancelling 16 tasks required 16 individual update_task calls in this session. The tool should validate each task_id exists, apply updates in a transaction, and return a summary of successes/failures.

## Dependencies

- None

## Acceptance Criteria

- [ ] New bulk_update_tasks MCP tool registered and callable
- [ ] Accepts array of {task_id, fields} objects (max 50)
- [ ] Updates applied in a single DB transaction
- [ ] Returns per-task success/failure summary
- [ ] Invalid task_ids reported as errors without blocking other updates

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/
- packages/mcp-cortex/src/db/


## Parallelism

✅ Can run in parallel — only adds a new tool, no conflicts with existing tools
