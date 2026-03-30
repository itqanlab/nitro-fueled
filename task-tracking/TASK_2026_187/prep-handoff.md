# Prep Handoff — TASK_2026_187

## Implementation Plan Summary

This task should add a historical sessions product slice, not another active-session view. The backend already has active-session endpoints and the frontend already has a singular live viewer at `/session/:sessionId`; the implement worker should preserve those flows while introducing a plural `/sessions` list/detail experience backed by Cortex data for ended sessions.

The main architectural constraint is the endpoint collision: `GET /api/sessions` and `GET /api/sessions/:id` already exist for the older in-memory session store. The implement worker needs to migrate those endpoints to the new historical contract deliberately and keep active consumers on `/api/sessions/active` and `/api/sessions/active/enhanced`.

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| apps/dashboard-api/src/dashboard/dashboard.controller.ts | modify | Repoint generic sessions endpoints to the new history contract |
| apps/dashboard-api/src/dashboard/dashboard.module.ts | modify | Register the new history aggregation provider |
| apps/dashboard-api/src/dashboard/sessions-history.service.ts | new | Centralize ended-session list/detail shaping from Cortex + disk artifacts |
| apps/dashboard-api/src/dashboard/cortex.service.ts | modify if needed | Expose any additional low-level session/task/event queries required |
| apps/dashboard/src/app/app.routes.ts | modify | Add `/sessions` and `/sessions/:id` routes |
| apps/dashboard/src/app/services/mock-data.constants.ts | modify | Add Sessions to sidebar navigation |
| apps/dashboard/src/app/models/api.types.ts | modify | Add session history list/detail contracts |
| apps/dashboard/src/app/services/api.service.ts | modify | Add or migrate session history HTTP methods |
| apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts | new | Load and render ended sessions index |
| apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html | new | Table/list markup for session history |
| apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.scss | new | List layout and status styling |
| apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts | new | Load and render one historical session |
| apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html | new | Detail layout for task results, timeline, workers, and log |
| apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.scss | new | Detail-page responsive styling |

## Batches

- Batch 1: Backend history aggregation and endpoint migration — files: `apps/dashboard-api/src/dashboard/sessions-history.service.ts`, `apps/dashboard-api/src/dashboard/dashboard.controller.ts`, `apps/dashboard-api/src/dashboard/dashboard.module.ts`, optionally `apps/dashboard-api/src/dashboard/cortex.service.ts`
- Batch 2: Frontend contracts, routes, nav, and sessions list — files: `apps/dashboard/src/app/models/api.types.ts`, `apps/dashboard/src/app/services/api.service.ts`, `apps/dashboard/src/app/app.routes.ts`, `apps/dashboard/src/app/services/mock-data.constants.ts`, `apps/dashboard/src/app/views/sessions/sessions-list/*`
- Batch 3: Session detail page and polish — files: `apps/dashboard/src/app/views/sessions/session-detail/*`

## Key Decisions

- Keep historical sessions separate from the existing live `/session/:sessionId` viewer.
- Use Cortex as the source of truth for session/task/worker/event metrics, and read on-disk `log.md` content only as an additional detail payload when available.
- Prefer a new history-specific backend service over forcing the current active-session `SessionsService` to own both watcher-fed active state and persisted historical analytics.
- Keep frontend history types separate from the older `SessionSummary` / `SessionData` active-session types unless the worker fully migrates every consumer in the same change.

## Gotchas

- `apps/dashboard/src/app/models/api.types.ts` and `apps/dashboard/src/app/services/api.service.ts` already have uncommitted worktree changes; integrate rather than overwrite.
- The existing dashboard backend also exposes Cortex session endpoints under `/api/cortex/sessions`; do not duplicate that raw API when the task calls for higher-level, operator-friendly history summaries.
- Historical sessions can have partial data, especially around `ended_at`, review scores, or task-event linkage; the UI should handle unknown values explicitly.
- TASK_2026_158 warned about file overlap around sessions-related backend work. Even though this prep task is file-only, the implement worker should re-check current file ownership before editing shared session endpoints.

## First Batch Prompt Seed

Implement Batch 1 by creating a history-focused backend aggregation layer for ended sessions and migrating `GET /api/sessions` plus `GET /api/sessions/:id` to that contract. Preserve `/api/sessions/active*` behavior, reuse `CortexService` and existing logs/reports shaping patterns where possible, and make missing session/log data degrade cleanly instead of throwing generic errors.
