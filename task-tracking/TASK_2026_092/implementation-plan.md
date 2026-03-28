# Implementation Plan — TASK_2026_092

## Overview

Wire Angular dashboard to live NestJS API. Create ApiService (HTTP) and WebSocketService (Socket.IO). Replace MockDataService in 9 components. Update CLI copy-web-assets script.

## Batch 1: Foundation

### 1.1 Add socket.io-client to workspace
- Add `socket.io-client` and `@types/socket.io-client` to root `package.json` devDependencies
- Run `npm install` at workspace root

### 1.2 Create environment files
- `apps/dashboard/src/environments/environment.ts` (dev): apiUrl = 'http://localhost:3001'
- `apps/dashboard/src/environments/environment.prod.ts` (prod): apiUrl = '' (relative, same origin)
- Update `apps/dashboard/project.json` to add fileReplacements for production build

### 1.3 Create ApiService
- `apps/dashboard/src/app/services/api.service.ts`
- Uses `HttpClient` with typed return observables for all 19 NestJS endpoints
- Returns typed Observables from dashboard.types.ts
- Reads base URL from environment

### 1.4 Create WebSocketService
- `apps/dashboard/src/app/services/websocket.service.ts`
- Uses socket.io-client to connect to NestJS Socket.IO gateway
- Exposes Observable<DashboardEvent> for 'dashboard-event' events
- Handles reconnection, connect/disconnect lifecycle
- Cleans up on Angular service destroy (implements OnDestroy)

### 1.5 Provide HttpClient in app.config.ts
- Add `provideHttpClient()` to `appConfig.providers` in `app.config.ts`

## Batch 2: Wire Real-Data Components

### 2.1 dashboard.component.ts
- Remove MockDataService injection
- Inject ApiService, use `getRegistry()` for tasks
- Display TaskRecord[] (status: IN_PROGRESS = active, COMPLETE = completed)
- Use `getStats()` for budget/cost summary
- Components that have no API mapping: use sensible defaults

### 2.2 analytics.component.ts
- Remove MockDataService injection
- Inject ApiService, use `getAnalyticsCost()`, `getAnalyticsEfficiency()`, `getAnalyticsModels()`, `getAnalyticsSessions()`
- Map NestJS analytics types to Angular AnalyticsData model

### 2.3 status-bar.component.ts
- Remove MockDataService injection
- Inject ApiService, use `getStats()` for budget data
- Use `getActiveSessions()` for active worker count

## Batch 3: Wire Remaining Components (Remove Mock Dep)

### 3.1 sidebar.component.ts
- Remove MockDataService injection
- Hardcode sidebar sections as a `readonly` constant in the component (they're static nav items)

### 3.2 mcp-integrations.component.ts
- Remove MockDataService injection
- Import constants directly from `../services/mock-data.constants`

### 3.3 model-assignments.component.ts
- Remove MockDataService injection
- Import MOCK_MODEL_ASSIGNMENTS_DATA directly from `../services/model-assignment.constants`

### 3.4 new-task.component.ts
- Remove MockDataService injection
- Import MOCK_PROVIDER_GROUPS directly from `../services/new-task.constants`

### 3.5 provider-hub.component.ts
- Remove MockDataService injection
- Import MOCK_PROVIDER_HUB_DATA directly from `../services/provider-hub.constants`

### 3.6 agent-editor.store.ts
- Remove MockDataService injection
- Import constants directly from `../services/mock-data.constants`

## Batch 4: CLI Update

### 4.1 Update copy-web-assets script
- In `apps/cli/package.json`, change the `copy-web-assets` script to source from `apps/dashboard/dist` instead of `packages/dashboard-web/dist`

## Key Constraints

- Environment files need `export const environment = { ... }` pattern
- HttpClient requires `provideHttpClient()` in app.config.ts
- Socket.IO client must be properly cleaned up to avoid memory leaks
- All API calls return Observables (not Promises) for Angular best practices
- Components using async data need `AsyncPipe` and Angular 17+ `@if` syntax
- Follow review lessons: no method calls in templates, use `computed()` for derived state
