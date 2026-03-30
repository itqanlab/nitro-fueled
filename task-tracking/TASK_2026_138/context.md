# Context — TASK_2026_138

## User Intent
Extend the nitro-cortex SQLite schema with handoffs and events tables, and add corresponding MCP tools: upsert_task, write_handoff, read_handoff, log_event, query_events.

## Task Type
FEATURE

## Strategy
Minimal — single developer session. Schema extension + tool implementation in packages/mcp-cortex/.

## Key Findings
- nitro-cortex lives at packages/mcp-cortex/ (not libs/nitro-cortex/ as referenced in task.md)
- tasks table ALREADY EXISTS with a richer schema than spec requires
- handoffs table: does not exist — must be created
- events table: does not exist — must be created
- get_tasks already covers query_tasks functionality — add upsert_task as the missing create/update combo
- Pattern: tools/*.ts files, handler functions exported, registered in index.ts
- Build: tsc, Test: vitest run
