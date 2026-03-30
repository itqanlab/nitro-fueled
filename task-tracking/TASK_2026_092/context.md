# Context — TASK_2026_092

## User Intent

Wire the Angular dashboard to the live NestJS API and update the CLI build pipeline.

## Strategy

FEATURE — Medium complexity, full stack integration work.

## Analysis

### Angular App Structure
- `apps/dashboard/src/app/services/mock-data.service.ts` — currently 9 components inject this
- `apps/dashboard/src/environments/` — directory exists but EMPTY (no environment files yet)
- `apps/dashboard/project.json` — build config uses Nx, no fileReplacements configured yet

### NestJS API Endpoints (from dashboard.controller.ts)
- GET /api/health
- GET /api/registry → TaskRecord[]
- GET /api/plan → PlanData
- GET /api/state → OrchestratorState
- GET /api/tasks/:id → FullTaskData
- GET /api/tasks/:id/reviews → ReviewData[]
- GET /api/tasks/:id/pipeline → PipelineData
- GET /api/anti-patterns → AntiPatternRule[]
- GET /api/review-lessons → LessonEntry[]
- GET /api/stats → DashboardStats
- GET /api/graph → GraphData
- GET /api/workers/tree → WorkerTree
- GET /api/sessions/active → SessionSummary[]
- GET /api/sessions/:id → SessionData
- GET /api/sessions → SessionSummary[]
- GET /api/analytics/cost → AnalyticsCostData
- GET /api/analytics/efficiency → AnalyticsEfficiencyData
- GET /api/analytics/models → AnalyticsModelsData
- GET /api/analytics/sessions → AnalyticsSessionsData

### WebSocket
- NestJS uses Socket.IO (socket.io-client needed in Angular)
- Gateway emits 'dashboard-event' events of type DashboardEvent
- Client receives: sessions:changed, state:refreshed, connected

### Port Strategy
- NestJS uses dynamic port (PORT=0, OS assigns).
- In production: Angular served by NestJS → use relative URL window.location.origin
- In dev: use http://localhost:3001 (configured dev port)

### Components Using MockDataService (9 total)
1. dashboard.component.ts → activeTasks/completedTasks from registry, stats for analytics
2. analytics.component.ts → analytics data from /api/analytics/*
3. status-bar.component.ts → stats, budget data
4. sidebar.component.ts → static navigation (can be hardcoded, no API needed)
5. mcp-integrations.component.ts → no NestJS equivalent, inline constants
6. model-assignments.component.ts → no NestJS equivalent, inline constants
7. new-task.component.ts → providerGroups only, inline constants
8. provider-hub.component.ts → no NestJS equivalent, inline constants
9. agent-editor.store.ts → agent list, inline constants

### Dependencies
- rxjs available at workspace root
- socket.io-client NOT installed, needs to be added
