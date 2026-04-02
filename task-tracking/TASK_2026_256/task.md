# Task: MCP Cortex: get_backlog_summary Tool — Status Counts Only


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

Add a get_backlog_summary MCP tool that returns task counts grouped by status. Example: {CREATED: 37, IMPLEMENTED: 20, COMPLETE: 55, total: 130}. query_tasks without a status filter returned 99k chars and overflowed context this session. The supervisor only needs counts for overview decisions. Response must always be under 500 chars regardless of task count.

## Dependencies

- None

## Acceptance Criteria

- [ ] New get_backlog_summary MCP tool registered and callable
- [ ] Returns count per status as a flat object
- [ ] Response always under 500 chars
- [ ] Optional group_by parameter for priority breakdown

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/


## Parallelism

✅ Can run in parallel — adds a new read-only tool, no conflicts
