# Task: MCP Cortex: update_task Syncs Title/Status to Disk Files


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

When update_task changes the title or status fields, also write those changes to the on-disk task files (task.md title line and status file). Currently update_task only updates the DB — disk files drift out of sync. In this session, 6 task titles were updated in the DB but task.md files still say 'Untitled'. Similarly, cancelling tasks via update_task didn't write 'CANCELLED' to the status files. The DB is authoritative, but disk files must stay in sync for workers and file-based fallback paths.

## Dependencies

- TASK_2026_251

## Acceptance Criteria

- [ ] update_task writes new status to task-tracking/TASK_ID/status when status field changes
- [ ] update_task updates the title line in task-tracking/TASK_ID/task.md when title field changes
- [ ] Disk writes are best-effort — DB update succeeds even if disk write fails (log warning)
- [ ] Existing update_task API unchanged — no new parameters needed

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/
- packages/mcp-cortex/src/db/


## Parallelism

✅ Can run in parallel — modifies existing tool behavior, no file scope conflicts
