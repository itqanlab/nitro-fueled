# Task: Enforce per-phase token capture in log_phase MCP tool


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

Phase token fields exist in the DB schema but workers do not populate them. Fix this.

## Current state
- phases table has token_in, token_out, token_cache columns
- log_phase() MCP tool accepts these fields but workers never pass them
- Result: phase-level token breakdown is always null in DB

## What to change
1. Update log_phase() MCP tool to require token fields (or default to 0 with a warning)
2. Update orchestration SKILL.md — workers must pass current token counts when calling log_phase()
3. Update auto-pilot SKILL.md — supervisor reads phase tokens from DB for cost breakdown

## Acceptance Criteria
- log_phase() populates token fields for all new phases
- Phase token data appears in cortex DB after sessions run
- Orchestration skill instructs workers to pass token counts

## Dependencies

- TASK_2026_320

## Acceptance Criteria

- [ ] log_phase() MCP tool populates token fields
- [ ] Orchestration SKILL.md instructs workers to pass token counts
- [ ] Phase token data non-null in DB after sessions

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/phases.ts
- .claude/skills/orchestration/SKILL.md


## Parallelism

Independent. Can run in parallel with TASK_2026_319.
