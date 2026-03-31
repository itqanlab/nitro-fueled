# Task: Cortex DB: Skill Invocations Table and MCP Analytics Tools


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

Add skill_invocations table to cortex DB and MCP tools for logging and querying. Schema: skill_invocations (id INTEGER PRIMARY KEY, skill_name TEXT NOT NULL, session_id TEXT, worker_id TEXT, task_id TEXT, invoked_at TEXT NOT NULL, duration_ms INTEGER, outcome TEXT). Add migration file. Add MCP tool log_skill_invocation(skill_name, session_id?, worker_id?, task_id?, duration_ms?, outcome?) that inserts a row. Add get_skill_usage(period?) MCP tool that returns aggregated counts per skill for the given period (default 30d). Workers emit SKILL_INVOKED events via emit_event — the cortex listener writes to skill_invocations table. This follows the same pattern as existing event handling.

## Dependencies

- None

## Acceptance Criteria

- [ ] skill_invocations table created with migration
- [ ] log_skill_invocation MCP tool inserts rows correctly
- [ ] get_skill_usage returns aggregated counts per skill with period filtering
- [ ] SKILL_INVOKED events from emit_event are captured in the table

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/db/migrations/
- packages/mcp-cortex/src/tools/analytics.ts


## Parallelism

✅ Can run in parallel — new table and tools, no overlap with active tasks
