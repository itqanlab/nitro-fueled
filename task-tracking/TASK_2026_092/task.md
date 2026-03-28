# Task: Angular ↔ NestJS integration + CLI build pipeline update

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | optional     |

## Description

Wire the Angular dashboard to the live NestJS API and update the CLI build pipeline. In the Angular app: create `ApiService` with typed methods covering all REST endpoints from `DashboardController`; create `WebSocketService` that connects to the NestJS WebSocket gateway and exposes observable streams for real-time events. Replace `MockDataService` injections in all 9 view components with calls to `ApiService` and `WebSocketService`. Configure Angular environment files (`environment.ts` for dev, `environment.prod.ts` for production) with the correct NestJS API base URL and WebSocket URL. In the CLI: update the `copy-web-assets` script in `apps/cli/package.json` to source from `apps/dashboard/dist` (Angular output) instead of the old `packages/dashboard-web/dist`. Verify the full end-to-end pipeline: `nitro-fueled dashboard` builds, serves the Angular app, which connects to NestJS, which reads real task-tracking data.

## Dependencies

- TASK_2026_077 — provides the Angular shell and all view components to wire
- TASK_2026_088 — provides the complete NestJS API (REST + WebSocket)
- TASK_2026_091 — provides the Oclif CLI with updated dashboard command

## Acceptance Criteria

- [ ] `ApiService` created with typed methods for all `DashboardController` REST endpoints
- [ ] `WebSocketService` created that subscribes to NestJS gateway events and exposes RxJS Observables
- [ ] All 9 view components receive live data from `ApiService`/`WebSocketService` instead of `MockDataService`
- [ ] `environment.prod.ts` contains correct NestJS port and WebSocket URL
- [ ] `apps/cli/package.json` `copy-web-assets` script sources from `apps/dashboard/dist`
- [ ] `nitro-fueled dashboard` opens browser with Angular app showing real task-tracking data

## References

- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts
- apps/cli/src/commands/dashboard.ts
- apps/dashboard/src/environments/

## File Scope

- apps/dashboard/src/app/services/api.service.ts (CREATED)
- apps/dashboard/src/app/services/websocket.service.ts (CREATED)
- apps/dashboard/src/environments/environment.ts (CREATED)
- apps/dashboard/src/environments/environment.prod.ts (CREATED)
- apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts (CREATED)
- apps/dashboard/src/app/views/analytics/analytics.adapters.ts (CREATED)
- apps/dashboard/src/app/app.config.ts (MODIFIED — provideHttpClient added)
- apps/dashboard/project.json (MODIFIED — fileReplacements for production)
- apps/dashboard/src/app/views/dashboard/dashboard.component.ts (MODIFIED — uses ApiService)
- apps/dashboard/src/app/views/analytics/analytics.component.ts (MODIFIED — uses ApiService)
- apps/dashboard/src/app/layout/status-bar/status-bar.component.ts (MODIFIED — uses ApiService)
- apps/dashboard/src/app/layout/sidebar/sidebar.component.ts (MODIFIED — inlined constants)
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts (MODIFIED — inlined constants)
- apps/dashboard/src/app/views/models/model-assignments.component.ts (MODIFIED — inlined constants)
- apps/dashboard/src/app/views/new-task/new-task.component.ts (MODIFIED — inlined constants)
- apps/dashboard/src/app/views/providers/provider-hub.component.ts (MODIFIED — inlined constants)
- apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts (MODIFIED — inlined constants)
- apps/cli/package.json (MODIFIED — copy-web-assets points to apps/dashboard/dist)
- package.json (MODIFIED — socket.io-client added)
