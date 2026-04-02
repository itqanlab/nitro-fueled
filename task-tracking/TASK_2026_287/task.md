# Task: Cortex DB Schema: Task Artifact Tables


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Extend cortex DB schema to store all task artifacts that currently live as files. Add tables: task_reviews (task_id, review_type enum [style|logic|security], verdict enum [PASS|FAIL], findings text, reviewer text), task_test_reports (task_id, status enum [PASS|FAIL], summary text, details text), task_completion_reports (task_id, summary text, review_results text, test_results text, follow_on_tasks text, files_changed_count int), task_plans (task_id, content text — implementation plan), task_descriptions (task_id, content text — PM requirements), task_contexts (task_id, content text — PM context), task_subtasks (task_id, batch_number int, subtask_name text, status text, assigned_to text). Each table has created_at/updated_at timestamps. Extend existing handoff table pattern to cover all types. Add migration file for schema changes.

## Dependencies

- None

## Acceptance Criteria

- [ ] All 7 artifact tables created with proper foreign keys to tasks table
- [ ] Migration file applies cleanly on existing cortex.db with data
- [ ] Existing handoff table pattern preserved (backward compatible)
- [ ] Schema supports querying all artifacts for a task in one call

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/db/migrations/


## Parallelism

✅ Can run in parallel — DB schema only, no overlap with active tasks
