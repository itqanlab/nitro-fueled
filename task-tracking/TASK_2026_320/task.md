# Task: Write session evaluation markdown scorecard to disk


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

After evaluate_session() computes scores (TASK_2026_319), write a human-readable scorecard to disk.

## What to add
- evaluate_session() writes `task-tracking/sessions/{SESSION_ID}/evaluation.md`
- Format: score card table (4 dimensions + overall), key signals per dimension, top waste events, improvement signals, proposed lesson additions
- Also append proposed lesson entries to a `pending_lessons` JSON field on the evaluation record for the retrospective command to consume

## Acceptance Criteria
- evaluation.md written to correct path after evaluate_session() runs
- Score card table shows all 4 dimensions with scores and key signals
- pending_lessons field populated with actionable lesson proposals

## Dependencies

- TASK_2026_319

## Acceptance Criteria

- [ ] evaluation.md written to sessions/{SESSION_ID}/evaluation.md
- [ ] Score card table includes all 4 dimensions
- [ ] pending_lessons field populated on evaluation record

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/sessions.ts


## Parallelism

Depends on TASK_2026_319.
