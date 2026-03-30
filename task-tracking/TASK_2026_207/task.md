# Task: Add prep/implement worker types and prep handoff schema to cortex MCP


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |






## Description

Extend the cortex MCP server to support the new Prep and Implement worker types.

1. Add PREPPED and IMPLEMENTING to valid task status values.
2. Add 'prep' and 'implement' to the worker_type enum.
3. Extend write_handoff/read_handoff to accept worker_type='prep' with prep-specific schema: implementation_plan_summary (string), files_to_touch (array of {path, action, why}), batches (array of {summary, files}), key_decisions (array of strings), gotchas (array of strings).

## Dependencies

- None

## Acceptance Criteria

- [ ] PREPPED and IMPLEMENTING are valid statuses in cortex MCP
- [ ] worker_type enum accepts 'prep' and 'implement'
- [ ] write_handoff/read_handoff handle worker_type='prep' with prep schema
- [ ] Existing build/review worker types unchanged

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/


## Parallelism

✅ Can run in parallel with TASK_2026_204
