# Task: Migrate WebSocket server to NestJS gateway

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | optional     |

## Description

Migrate the WebSocket server from `apps/dashboard-service/src/server/websocket.ts` into a NestJS `@WebSocketGateway` in `apps/dashboard-api`. The gateway must emit the same event names and message payload shapes as the current implementation so that existing clients (current React dashboard and future Angular app) connect without protocol changes. Inject `SessionsService` and `AnalyticsService` for real-time data sourcing. The gateway should handle client connection/disconnection lifecycle and broadcast task-tracking update events triggered by the `WatcherService`. Register the gateway in `DashboardModule`.

## Dependencies

- TASK_2026_087 — provides SessionsService and AnalyticsService the gateway injects

## Acceptance Criteria

- [ ] `DashboardGateway` created with `@WebSocketGateway` decorator and registered in `DashboardModule`
- [ ] Gateway emits the same event names and payload shapes as `dashboard-service/src/server/websocket.ts`
- [ ] Gateway injects `SessionsService` and `AnalyticsService` for data access
- [ ] WebSocket connection can be established by the current React dashboard client without protocol changes
- [ ] `nx build dashboard-api` succeeds with no TypeScript errors

## References

- apps/dashboard-service/src/server/websocket.ts

## File Scope

- apps/dashboard-api/src/dashboard/dashboard.gateway.ts
- apps/dashboard-api/src/dashboard/dashboard.module.ts
