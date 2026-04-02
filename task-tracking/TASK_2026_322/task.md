# Task: Add lesson_violations_count to reviews table and MCP log_review tool


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

Currently lesson violations are detected post-hoc by text scanning retrospective reports. Instead, Review Workers should count violations in real time when writing their review.

## What to change
1. Add `lesson_violations_count` integer column to reviews table in DB schema
2. Update log_review() MCP tool to accept lesson_violations_count parameter
3. Document in review-lessons/README or review worker context: when writing a review finding that references a known lesson, increment this counter

## Acceptance Criteria
- lesson_violations_count column added to reviews table
- log_review() MCP tool accepts and stores the field
- Column is queryable for evaluate_session() scoring

## Dependencies

- TASK_2026_321

## Acceptance Criteria

- [ ] lesson_violations_count column added to reviews table
- [ ] log_review() accepts and persists lesson_violations_count
- [ ] Field queryable for session scoring

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/reviews.ts


## Parallelism

Independent. Can run in parallel with TASK_2026_319 and TASK_2026_321.
