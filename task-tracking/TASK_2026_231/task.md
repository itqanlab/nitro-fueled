# Task: Reporting API Endpoints

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | single      |

## Description

Build REST API endpoints that aggregate telemetry data into reporting views. The dashboard will consume these to show filtered, human-readable reports.

**Endpoints:**

1. `GET /api/reports/session/:id` — Session summary:
   - Tasks attempted/completed/failed/cancelled
   - Total cost, total duration
   - Launcher breakdown (% by each)
   - Model breakdown (% by each)
   - Worker count, retry count, kill count

2. `GET /api/reports/models` — Model performance matrix:
   - Per model: success rate, avg duration, avg cost, review pass rate
   - Filterable by task type, date range, launcher

3. `GET /api/reports/launchers` — Launcher comparison:
   - Per launcher: success rate, avg cost, avg duration, task types handled
   - Side-by-side comparison view data

4. `GET /api/reports/costs` — Cost trends:
   - Daily/weekly/monthly aggregation
   - By launcher, by model, by task type
   - Budget tracking (if budget cap set)

5. `GET /api/reports/tasks` — Task history:
   - Filterable table: status, type, priority, launcher, model, date range
   - Sortable by cost, duration, retry count

All endpoints support query params for filtering (date range, task type, launcher, model).

## Dependencies

- TASK_2026_229 — Telemetry schema (data source)
- TASK_2026_230 — Telemetry instrumentation (data population)

## Acceptance Criteria

- [ ] All 5 report endpoints implemented
- [ ] Each supports filtering by date range, task type, launcher, model
- [ ] Aggregation queries are efficient (indexed where needed)
- [ ] Response DTOs are well-typed for frontend consumption
- [ ] Empty state handled (no data yet = meaningful response, not error)

## References

- Telemetry schema: TASK_2026_229
- Existing analytics patterns: TASK_2026_216 (if implemented)

## File Scope

- `apps/dashboard-api/src/reports/reports.controller.ts` (new)
- `apps/dashboard-api/src/reports/reports.service.ts` (new)
- `apps/dashboard-api/src/reports/reports.module.ts` (new)
- `apps/dashboard-api/src/reports/dto/` (new)

## Parallelism

Can run in parallel — entirely new module. No file scope conflicts.
