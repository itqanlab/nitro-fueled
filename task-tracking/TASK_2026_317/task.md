# Task: Add ARCHIVE status to cortex DB schema and MCP task tools


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

Add ARCHIVE as a valid task status in the MCP cortex layer.

## Use cases
- Tasks with legacy file formats that predate the current system
- Historical reference tasks that are no longer executable
- Tasks deferred indefinitely (distinct from CANCELLED = abandoned mid-flight)

## What to change
- Add 'ARCHIVE' to the task status enum in DB schema
- Update all TypeScript status union types to include 'ARCHIVE'
- Update switch/if guards that enumerate statuses
- Supervisor must skip ARCHIVE tasks (treat same as CANCELLED)
- reconcile_status_files and sync_tasks_from_files must accept ARCHIVE as valid

## Acceptance Criteria
- ARCHIVE is a valid status in DB schema and all TypeScript types
- Supervisor skips ARCHIVE tasks
- Sync and reconcile tools accept ARCHIVE without errors

## Dependencies

- None

## Acceptance Criteria

- [ ] ARCHIVE added to status enum in DB and TypeScript types
- [ ] Supervisor skips ARCHIVE tasks
- [ ] Sync/reconcile accept ARCHIVE as valid status

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/tasks.ts
- packages/mcp-cortex/src/db/schema.ts


## Parallelism

Independent. TASK_2026_318 (dashboard) depends on this.
