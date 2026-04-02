# Task: Add context_percent_at_start to phases table and worker emission


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

Track context window usage at the start of each phase. This is a leading indicator for mid-phase compaction risk.

## What to change
1. Add `context_percent_at_start` float column to phases table
2. Update log_phase() MCP tool to accept this field
3. Update orchestration SKILL.md — workers read their current context % before calling log_phase() and pass it

## Why this matters
- Supervisor can preemptively reduce context load for phases starting above 70%
- evaluate_session() uses this to flag compaction-risk patterns

## Acceptance Criteria
- context_percent_at_start column added to phases table
- log_phase() accepts and stores the field
- Orchestration skill instructs workers to pass context % at phase start

## Dependencies

- TASK_2026_322

## Acceptance Criteria

- [ ] context_percent_at_start column added to phases table
- [ ] log_phase() accepts and stores context_percent_at_start
- [ ] Orchestration SKILL.md instructs workers to pass it

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/phases.ts
- .claude/skills/orchestration/SKILL.md


## Parallelism

Can run in parallel with TASK_2026_322 and TASK_2026_323. Independent.
