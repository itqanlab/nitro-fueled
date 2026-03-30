# Task: Logs Dashboard — Event Viewer & Worker Logs

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Part 1 of 2 — Logs & Reports (original request: Logs & Reports Dashboard).

Build a logs section in the dashboard that surfaces all existing log data into a structured, browsable interface.

Features:
1. **Event Log Viewer** — Chronological feed of all events from cortex (phase transitions, worker spawns, completions, failures, retries). Filterable by session, task, event type, severity
2. **Worker Logs** — Per-worker log output with syntax highlighting, searchable content, collapsible sections per phase
3. **Session Logs** — Session-level aggregated view showing all activity within a supervisor session
4. **Log Search** — Full-text search across all log entries with time range filtering
5. **Real-Time Streaming** — Live log tail via WebSocket for active sessions

Data sources: cortex MCP events table (`query_events`), session artifacts, worker output files.

## Dependencies

- None

## Acceptance Criteria

- [ ] Event log viewer displays all cortex events with filtering by session, task, and type
- [ ] Worker logs are browsable with search and collapsible phase sections
- [ ] Session logs show aggregated activity per session
- [ ] Full-text search works across all log entries
- [ ] Live log streaming works for active sessions via WebSocket

## Parallelism

✅ Can run in parallel — new logs page, no overlap with existing CREATED tasks.

## References

- Cortex MCP events: `packages/mcp-cortex/`
- WebSocket gateway: `apps/dashboard-api/src/`
- Session artifacts: `task-tracking/sessions/`

## File Scope

- apps/dashboard/src/app/pages/logs/ (new page directory)
- apps/dashboard-api/src/dashboard/ (log query endpoints)
