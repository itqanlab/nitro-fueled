# Context — TASK_2026_259

## User Intent
Add session lifecycle control buttons (Pause/Resume/Stop/Drain) to the dashboard session view.

## Strategy
FEATURE — Simple complexity, direct implementation.

## Key Findings
- API service already has: `pauseAutoSession`, `resumeAutoSession`, `stopAutoSession`, `drainSession`
- Auto-pilot controller: POST /pause, POST /resume, POST /stop, PATCH /stop (drain)
- WebSocket service: emits `session:updated`, `sessions:changed`, `session:update` events
- `SessionStatusResponse.loopStatus: LoopStatus` = `'running' | 'paused' | 'stopped'`
- `SessionStatusResponse.drainRequested: boolean`
- Session detail shows `SessionHistoryDetail.endStatus === 'running'` for active sessions
- `getAutoSession(id)` returns live `SessionStatusResponse` (404 if not active)

## Planned Changes
1. `session-detail.component.ts`: Add live status fetch + WebSocket refresh + action methods
2. `session-detail.component.html`: Add controls panel (Pause/Resume/Stop/Drain)
3. `sessions-list.component.ts`: Add per-row Stop quick-action for running sessions
4. `sessions-list.component.html`: Add Actions column with Stop button

## Dependency
TASK_2026_244 (WebSocket events) — COMPLETE
