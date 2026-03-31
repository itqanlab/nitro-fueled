# Task: Cortex Schema: Session Cost Breakdown Columns and Summary


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

Extend the cortex MCP schema to track cost per model tier per session, separating supervisor cost from worker cost. This builds on TASK_2026_229 (Extend Cortex Schema for Worker Telemetry) and TASK_2026_230 (Instrument Worker Lifecycle). Add supervisor_cost_usd and worker_costs_json columns to the sessions table. worker_costs_json stores a JSON object mapping model names to cost amounts. Update the get_session_summary MCP tool to include a cost_breakdown field in its response with supervisor_cost, worker_cost_by_model, and total_cost.

## Dependencies

- TASK_2026_229 -- provides the telemetry schema this task extends
- TASK_2026_230 -- provides the worker lifecycle events this task reads

## Acceptance Criteria

- [ ] Sessions table includes supervisor_cost_usd REAL column and worker_costs_json TEXT column
- [ ] get_session_summary MCP tool response includes cost_breakdown object with supervisor_cost, worker_cost_by_model, total_cost
- [ ] Migration handles existing sessions gracefully with NULL defaults

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/session-tools.ts


## Parallelism

Must run after TASK_2026_229 and TASK_2026_230. Can run in parallel with frontend tasks. Wave 3.
