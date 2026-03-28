# Task: Migrate state services + REST controllers to NestJS

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | optional     |

## Description

Migrate the business logic from `apps/dashboard-service/src/state/` (analytics-helpers.ts, analytics-store.ts, differ.ts, pipeline-helpers.ts, session-id.ts, session-store.ts, store.ts, worker-tree-helpers.ts), `src/events/`, `src/parsers/`, and `src/watcher/` into NestJS injectable services within `apps/dashboard-api`. Create `SessionsService` (encapsulates session-store and session-id logic), `AnalyticsService` (encapsulates analytics-store and analytics-helpers), `PipelineService` (encapsulates pipeline-helpers and differ), and `WatcherService` (encapsulates the watcher, implements `OnModuleInit` to start file watching). Then implement `DashboardController` exposing the same REST routes and response shapes as `apps/dashboard-service/src/server/http.ts` — all routes delegating to the injected services. Register all services and the controller in `DashboardModule`.

## Dependencies

- TASK_2026_086 — provides the NestJS app scaffold and DashboardModule

## Acceptance Criteria

- [ ] `SessionsService`, `AnalyticsService`, `PipelineService`, `WatcherService` created and registered in `DashboardModule`
- [ ] All state logic from `dashboard-service/src/state/` migrated with no functional changes to data shapes
- [ ] `DashboardController` implements all REST routes from `dashboard-service/src/server/http.ts` with identical paths and response shapes
- [ ] `WatcherService` implements `OnModuleInit` and begins watching the task-tracking directory on startup
- [ ] `nx build dashboard-api` succeeds with no TypeScript errors

## References

- apps/dashboard-service/src/state/
- apps/dashboard-service/src/server/http.ts
- apps/dashboard-service/src/events/
- apps/dashboard-service/src/parsers/
- apps/dashboard-service/src/watcher/

## File Scope

- apps/dashboard-api/src/dashboard/sessions.service.ts
- apps/dashboard-api/src/dashboard/analytics.service.ts
- apps/dashboard-api/src/dashboard/pipeline.service.ts
- apps/dashboard-api/src/dashboard/watcher.service.ts
- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/dashboard.module.ts
