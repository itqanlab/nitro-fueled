# Task: Add first_attempt_pass flag to workers table


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

Track whether a worker passed review on its first attempt, without requiring a fix cycle. This is a key quality signal for evaluate_session().

## What to change
1. Add `first_attempt_pass` boolean column to workers table (nullable — only applies to Build Workers)
2. Update the supervisor in auto-pilot SKILL.md: when a Review Worker returns PASS for a Build Worker with retry_number=0, call update_worker() to set first_attempt_pass=true
3. evaluate_session() uses first_attempt_pass rate in Quality dimension scoring

## Acceptance Criteria
- first_attempt_pass column added to workers table
- Supervisor sets first_attempt_pass=true when retry=0 and review passes
- Field queryable for session quality scoring

## Dependencies

- TASK_2026_324

## Acceptance Criteria

- [ ] first_attempt_pass boolean column added to workers table
- [ ] Supervisor sets it when review passes on first attempt
- [ ] Field used in evaluate_session() quality scoring

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/workers.ts
- .claude/skills/auto-pilot/SKILL.md


## Parallelism

Independent. Can run in parallel with TASK_2026_322 and TASK_2026_323.
