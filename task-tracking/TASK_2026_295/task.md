# Task: Extend update_session MCP tool to write supervisor_model, mode, total_cost


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

Part 1 of 2 — original request: Fix session telemetry gaps.

The sessions table has three columns that are never written: supervisor_model, mode, and total_cost. The update_session MCP tool only accepts loop_status, ended_at, summary, tasks_terminal, config, task_limit, source, and last_heartbeat.

Extend update_session in packages/mcp-cortex/src/tools/sessions.ts to accept and persist the three missing fields when provided. Also verify that log_phase and log_review in packages/mcp-cortex/src/tools/telemetry.ts accept all fields the supervisor will pass in Part 2 (worker_run_id, start/end times, tokens, outcome for phases; score, findings_count, model fields for reviews). No supervisor changes in this task.

## Dependencies

- None

## Acceptance Criteria

- [ ] update_session accepts supervisor_model, mode, and total_cost as optional fields
- [ ] When provided, supervisor_model, mode, and total_cost are written to the sessions table
- [ ] Existing update_session callers without these fields are unaffected
- [ ] log_phase and log_review tool schemas confirmed to accept all fields needed by the supervisor

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/sessions.ts
- packages/mcp-cortex/src/tools/telemetry.ts


## Parallelism

✅ Can run in parallel — touches only MCP cortex tool layer, no overlap with supervisor skill files
