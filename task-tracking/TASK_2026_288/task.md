# Task: MCP Tools: Task Artifact CRUD Operations


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

Add MCP tools for all task artifact CRUD operations. Following the existing write_handoff/read_handoff pattern, add tool pairs: write_review/read_reviews (write one review, read all reviews for a task), write_test_report/read_test_report, write_completion_report/read_completion_report, write_plan/read_plan, write_task_description/read_task_description, write_context/read_context, write_subtasks/read_subtasks (write full batch list, read current state). Each write tool validates task_id exists before inserting. Each read tool returns structured data. Add a get_task_artifacts(task_id) convenience tool that returns all artifacts for a task in one call.

## Dependencies

- TASK_2026_287

## Acceptance Criteria

- [ ] All 7 write/read tool pairs registered and callable via MCP
- [ ] get_task_artifacts returns all artifact types for a task in one call
- [ ] Each write tool validates task_id exists before insert
- [ ] Tools follow same error handling pattern as write_handoff/read_handoff

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/artifacts.ts (new)
- packages/mcp-cortex/src/index.ts


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_287 — depends on schema tables.
