# Task: Dashboard API cortex migration — replace session-orchestrator with cortex MCP

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | REFACTORING          |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

The NestJS dashboard-api currently talks to session-orchestrator MCP for worker data and uses file reads for task/session data. After TASK_2026_142 (merge session-orchestrator into cortex), there is only one MCP server: nitro-cortex.

Migrate dashboard-api to use cortex as its sole data source:

**REST endpoints updated:**
- `GET /tasks` → calls `query_tasks()` instead of reading registry.md
- `GET /tasks/:id` → calls `get_task_context()` instead of reading task.md
- `GET /sessions` → calls cortex sessions table instead of scanning session directories
- `GET /sessions/:id` → calls `get_session_summary()` for full session detail
- `GET /workers` → calls cortex worker_runs table
- `GET /tasks/:id/trace` → calls `get_task_trace()` for full observability

**WebSocket gateway updated:**
- Real-time events from cortex `events` table instead of file watching
- Worker status changes pushed via WebSocket when cortex events fire

**New endpoints for telemetry:**
- `GET /analytics/model-performance` → calls `get_model_performance()`
- `GET /analytics/phase-timing` → aggregated phase duration stats
- `GET /analytics/session-comparison` → compare sessions by cost/quality

## Dependencies

- TASK_2026_142 — cortex must be the unified MCP server
- TASK_2026_143 — telemetry tools must exist in cortex
- TASK_2026_144 — legacy apps removed (clean workspace)

## Acceptance Criteria

- [ ] All REST endpoints query cortex instead of reading files
- [ ] WebSocket pushes real-time events from cortex events table
- [ ] `GET /tasks` returns task list from cortex (not registry.md)
- [ ] `GET /sessions/:id` returns full session summary with worker breakdown
- [ ] `GET /tasks/:id/trace` returns full session→worker→phase→review chain
- [ ] `GET /analytics/model-performance` returns aggregated quality/cost stats
- [ ] No file reads in dashboard-api (all data from cortex MCP)

## References

- Dashboard API: `apps/dashboard-api/`
- nitro-cortex: `libs/nitro-cortex/`
- Architecture doc: `docs/supervisor-worker-architecture-v2.md`

## File Scope

- `apps/dashboard-api/src/controllers/` (update all controllers)
- `apps/dashboard-api/src/services/` (update data services)
- `apps/dashboard-api/src/gateways/` (update WebSocket gateway)

## Parallelism

- Do NOT run in parallel with TASK_2026_131 (same gateway files)
- Can run in parallel with dashboard UI tasks and skill tasks
