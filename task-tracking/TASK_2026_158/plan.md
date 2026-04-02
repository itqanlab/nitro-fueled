# Implementation Plan — TASK_2026_158

## Architecture

The session monitoring layer follows the existing patterns established by dependent tasks.

### Data Flow

```
Dashboard API (NestJS)  ──HTTP──▶  ApiService (Angular)
       │                              │
       ▼                              ▼
SessionsService                SessionsPanelComponent
  (in-memory store)              (signals + computed)
       │                              │
       ▼                              ▼
DashboardGateway              WebSocketService
  (Socket.io)                   (socket.io-client)
       │                              │
       └───── sessions:changed ───────┘
```

### Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| SessionsPanelComponent | `views/project/sessions-panel/` | Active/recent session cards, click-to-navigate |
| SessionsService | `dashboard-api/src/dashboard/` | In-memory session store, enhanced data |
| DashboardController | `dashboard-api/src/dashboard/` | HTTP endpoints for sessions |
| DashboardGateway | `dashboard-api/src/dashboard/` | WebSocket `sessions:changed` broadcasts |
| ApiService | `dashboard/src/app/services/` | HTTP client for session endpoints |
| WebSocketService | `dashboard/src/app/services/` | Socket.io event stream |

### Key Design Decisions

1. **Sessions are split into active (running) and recent (non-running)** — the panel shows two sections with different card layouts
2. **Mock data fallback** — when the API returns empty/error, hardcoded mock sessions populate the panel
3. **Real-time via `sessions:changed`** — file watcher triggers broadcast which the panel subscribes to via WebSocket
4. **Scroll position** — not explicitly preserved; Angular Router recreates the component on navigation back

## File Scope

### Frontend (Angular)

- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts` — component logic
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html` — template
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.scss` — styles
- `apps/dashboard/src/app/models/sessions-panel.model.ts` — types (SessionStatus, SessionPhase, ActiveSessionSummary)
- `apps/dashboard/src/app/views/project/project.component.ts` — embeds `<app-sessions-panel>`
- `apps/dashboard/src/app/views/project/project.component.html` — sidebar layout

### Backend (NestJS)

- `apps/dashboard-api/src/dashboard/sessions.service.ts` — session store, enhanced data
- `apps/dashboard-api/src/dashboard/dashboard.controller.ts` — session HTTP endpoints
- `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` — WebSocket broadcasts
