# Task: Add structured kill_reason enum to workers table


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

Worker kill reasons are currently freetext only. Replace with a structured enum so failures can be queried and aggregated.

## Kill reason enum
stuck | timeout | edit_loop | context_full | supervisor_drain | manual | provider_failure | other

## What to change
1. Add `kill_reason` enum column to workers table
2. Update kill_worker() MCP tool to accept kill_reason
3. Update auto-pilot SKILL.md — supervisor passes structured kill_reason when calling kill_worker()
4. Update evaluate_session() to use kill_reason in efficiency scoring

## Acceptance Criteria
- kill_reason column added to workers table with enum constraint
- kill_worker() MCP tool accepts kill_reason
- Auto-pilot skill passes kill_reason on all kill_worker() calls

## Dependencies

- TASK_2026_323

## Acceptance Criteria

- [ ] kill_reason enum column added to workers table
- [ ] kill_worker() MCP tool accepts kill_reason
- [ ] Auto-pilot skill passes kill_reason on all worker kills

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/workers.ts
- .claude/skills/auto-pilot/SKILL.md


## Parallelism

Independent. Can run in parallel with TASK_2026_323 and TASK_2026_324.
