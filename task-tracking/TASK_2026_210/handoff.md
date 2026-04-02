# Handoff — TASK_2026_210

## Files Changed
- apps/dashboard/src/app/models/api.types.ts (modified — added 11 session types, removed 5 obsolete auto-pilot types)
- apps/dashboard/src/app/models/sessions-panel.model.ts (modified — cleared old ActiveSessionSummary/SessionPhase/SessionStatus types)
- apps/dashboard/src/app/services/api.service.ts (modified — 7 new session methods, 3 removed, 2 renamed, drainSession return type updated)
- apps/dashboard/src/app/views/project/project.component.ts (modified — replaced single-session auto-pilot flow with multi-session management)
- apps/dashboard/src/app/views/project/project.component.html (modified — New Session button + config form + sessions-panel wiring)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts (rewritten — presentational component with @Input/@Output)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html (rewritten — per-session action controls added)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts (modified — uses getAutoSession(), SessionStatusResponse)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html (modified — removed timeline/log sections)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts (modified — uses getAutoSessions(), SessionStatusResponse)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html (modified — updated column bindings)

## Commits
(none yet — committed in this step)

## Decisions
- `getSessionHistoryDetail()` and the new `getAutoSession()` are identical (both GET /api/sessions/:id → SessionStatusResponse), so only one method `getAutoSession()` is kept — no duplicate
- `SessionsPanelComponent` converted to presentational (parent owns activeSessions signal) to avoid dual API calls
- `SessionHistoryListItem` and `SessionHistoryDetail` types kept in api.types.ts (may be needed for future cortex history endpoint)
- LocalStorage key `nitro-session-config` persists last-used CreateSessionRequest
- WebSocket subscription (`sessions:changed` / `session:update`) plus 15s interval fallback for session refresh

## Known Risks
- `task-detail.component.ts` has a pre-existing TS2769 error unrelated to this task
- Sessions detail view now shows only live aggregate counts (not per-task detail) — if users need historical per-task data, a separate cortex endpoint would be required
- The `source` field was removed from sessions-list display since `SessionStatusResponse` has no source field (only `sessionId`)
