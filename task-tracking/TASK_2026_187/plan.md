# Plan — TASK_2026_187

## Architecture

- Build the historical sessions slice around Cortex-backed aggregation, not the existing in-memory `SessionsService` state that powers active session monitoring.
- Keep the frontend split into two route-level standalone views:
  - `apps/dashboard/src/app/views/sessions/sessions-list/` for the history index.
  - `apps/dashboard/src/app/views/sessions/session-detail/` for a single session result view.
- Reuse the existing dashboard shell, `ApiService`, and typed frontend contracts in `api.types.ts`.
- Reuse the existing `CortexService` as the low-level DB reader, with a new history-focused aggregation service in `apps/dashboard-api/src/dashboard/` to compose session summary, task outcome, event timeline, worker data, and session log content.

## Key Decisions

- Do not overload the current active-session `SessionsService` with historical aggregation logic unless the existing file proves small enough to extend cleanly; prefer a dedicated history service because the current service is watcher-fed and active-state focused.
- Treat `/api/sessions` and `/api/sessions/:id` as the canonical history endpoints after this task. Any older active-session consumers should continue using `/api/sessions/active` and `/api/sessions/active/enhanced`.
- Reuse data-shaping patterns already present in `logs.service.ts` and `reports.service.ts` instead of inventing a second way to derive session costs, workers, and event summaries.
- Keep the new detail page distinct from the existing singular `/session/:sessionId` live viewer so historical analysis and live chat do not get conflated.

## Implementation Approach

### Backend first

Start by defining the final history contracts and settling the endpoint migration. The implementation worker should add a Cortex-backed session-history service that:

- lists ended sessions with derived counts and display fields,
- returns one session detail payload with task results, timeline, worker summaries, and full `log.md` content when available,
- updates the existing dashboard controller wiring so `/api/sessions` and `/api/sessions/:id` serve the new contract without breaking `/api/sessions/active*`.

### Frontend contracts second

Once the backend payloads are stable, add the corresponding history-specific types and API client methods. Keep them separate from the older active-session summary interfaces to avoid mixing incompatible shapes.

### UI last

Build the sessions list view first, then the session detail page. Reuse established dashboard table/card patterns and only extract helpers if the route components become unwieldy.

## File Strategy

### Expected backend files

- `apps/dashboard-api/src/dashboard/dashboard.controller.ts` — modify session history endpoints to use the new contract
- `apps/dashboard-api/src/dashboard/dashboard.module.ts` — register any new provider
- `apps/dashboard-api/src/dashboard/cortex.service.ts` — extend only if missing lower-level queries are needed
- `apps/dashboard-api/src/dashboard/sessions-history.service.ts` — new aggregation layer for ended sessions and session detail
- `apps/dashboard-api/src/dashboard/reports.service.ts` — optional reference only; avoid duplication if helper extraction becomes warranted

### Expected frontend files

- `apps/dashboard/src/app/app.routes.ts` — add `/sessions` and `/sessions/:id`
- `apps/dashboard/src/app/services/mock-data.constants.ts` — add Sessions sidebar nav item
- `apps/dashboard/src/app/models/api.types.ts` — add typed history list/detail contracts
- `apps/dashboard/src/app/services/api.service.ts` — add sessions history API methods or repoint existing generic session methods if consumers are migrated cleanly
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts`
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html`
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.scss`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.scss`

## Risks

- The backend route names already exist for a different session model, so the worker must migrate consumers deliberately rather than silently changing shapes under unrelated screens.
- `apps/dashboard/src/app/models/api.types.ts` and `apps/dashboard/src/app/services/api.service.ts` are already dirty in the worktree; the worker must integrate carefully with concurrent edits.
- Session detail likely needs data from multiple sources: sessions, workers, events, task context, reviews, and disk-based `log.md`; partial availability must degrade cleanly.
- Historical sessions may include older records with incomplete costs, missing `ended_at`, or sparse event/task links; the UI should surface unknown values rather than assuming completeness.

## Verification Expectations

- `npx nx build dashboard-api`
- `npx nx build dashboard`
- Manual check of `/sessions` list rendering, `/sessions/:id` navigation, sidebar link visibility, and empty/unavailable states
- Manual spot-check that a known historical session shows consistent task outcomes, worker counts, and log content relative to Cortex data and on-disk artifacts
