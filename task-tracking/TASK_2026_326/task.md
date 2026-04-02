# Task: Add --trend flag to nitro-burn command showing session score history


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

Extend the nitro-burn CLI command to show session evaluation score history alongside cost history.

## What to add
- `nitro-burn --trend` flag reads session_evaluations table (from TASK_2026_319)
- Outputs a table: session ID, date, overall score, quality, efficiency, cost, task count
- Trend line: show score delta vs previous session (↑/↓)
- Color code: green ≥7, yellow 5–6.9, red <5

## Acceptance Criteria
- `nitro-burn --trend` command works
- Shows session scores alongside cost history
- Score delta trend indicator shown per session
- Depends on TASK_2026_319 session_evaluations table

## Dependencies

- TASK_2026_319

## Acceptance Criteria

- [ ] nitro-burn --trend shows session score history
- [ ] Score delta trend shown per session
- [ ] Color coding applied to score bands

## References

- task-tracking/task-template.md

## File Scope

- .claude/commands/nitro-burn.md


## Parallelism

Depends on TASK_2026_319. Independent of other schema tasks.
