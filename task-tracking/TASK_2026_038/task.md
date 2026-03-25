# Task: Dashboard Session Support — Multi-Session View and History

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Medium      |

## Description

The base dashboard (TASK_2026_023) reads from a single orchestrator state. With session-scoped directories (TASK_2026_034), the dashboard needs to support multiple sessions — both live and historical.

### Changes required

**Data Service** (`packages/dashboard-service/`):
1. New endpoints:
   - `GET /api/sessions` — list all sessions (active + historical) from `task-tracking/sessions/`
   - `GET /api/sessions/:id` — full state for a specific session
   - `GET /api/sessions/active` — currently running sessions from `active-sessions.md`
2. File watcher scopes to the selected session directory
3. WebSocket events include session ID so clients can filter

**Web Client** (`packages/dashboard-web/`):
4. **Session picker** — dropdown in the header/sidebar showing active sessions (green dot) and recent historical sessions
5. **Multi-session indicator** — when 2+ supervisors are running simultaneously, show a badge with count
6. **Session switcher** — switching sessions rehydrates all views from that session's state.md
7. **Session overview** — a dedicated view showing all sessions as cards:
   - Active sessions: live status, task count, elapsed time, current cost
   - Historical sessions: final stats (tasks completed, total cost, duration, stop reason)
   - Sorted by most recent first
8. **Session-scoped views** — Workers, Session Log, and Cost views all filter to the selected session
9. **Cross-session views** — Task Board, Roadmap, Queue remain global (tasks exist across sessions)

### UX flow

```
User opens dashboard
  → Sees global views (Task Board, Roadmap) immediately
  → Session picker defaults to latest active session (or most recent if none active)
  → Workers / Log / Cost views show data from selected session
  → User can switch sessions to see historical runs
  → If 2 sessions active: badge shows "2 active", picker shows both with green dots
```

## Dependencies

- TASK_2026_023 — Dashboard Web Client (base dashboard to extend)
- TASK_2026_034 — Session-Scoped State Directories (provides session directory structure)

## Acceptance Criteria

- [ ] Data Service exposes session list and per-session state endpoints
- [ ] Session picker shows active (green) and historical sessions
- [ ] Switching sessions rehydrates session-scoped views (Workers, Log, Cost)
- [ ] Multiple active sessions displayed simultaneously with distinct indicators
- [ ] Session overview view shows all sessions as cards with key stats
- [ ] Global views (Task Board, Roadmap, Queue) work across sessions
- [ ] WebSocket events include session ID for filtering

## References

- `TASK_2026_023` — Base dashboard
- `TASK_2026_034` — Session directories (`task-tracking/sessions/`)
- `task-tracking/active-sessions.md` — Active session tracking (from TASK_034)
