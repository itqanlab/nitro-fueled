# Plan — TASK_2026_184

## Architecture

- Add a dedicated command-console slice in `apps/dashboard-api/src/dashboard/` with a small controller/service pair that exposes:
  - a command catalog derived from `.claude/commands/*.md`,
  - route-aware suggestions based on the current dashboard route and optional task/session context,
  - a controlled execution endpoint that maps supported Nitro commands to existing backend services or controllers.
- Add a reusable Angular `CommandConsoleComponent` under `apps/dashboard/src/app/components/command-console/` that owns:
  - the command input,
  - autocomplete and quick actions,
  - transcript rendering,
  - persisted command history,
  - route-aware suggestions.
- Mount the console once in `apps/dashboard/src/app/layout/layout.component.ts` so the panel is available from every dashboard route.
- Extend the dashboard API client and shared frontend types so the console talks to the new backend contract instead of scattering command-specific HTTP logic through the component.

## Decisions

- Treat the console as a dashboard-native command surface, not a raw unrestricted terminal emulator.
- Reuse existing HTTP services for commands that already map cleanly to backend APIs, and keep the backend execution layer extensible for additional command adapters later.
- Reuse the existing `marked` + `DOMPurify` rendering approach for rich output, and only add a syntax-highlighting dependency if the existing stack cannot satisfy the code-block requirement acceptably.
- Keep history persistence in the frontend with `localStorage` unless a concrete multi-user/shared-history requirement appears.

## Implementation Approach

### Backend first

Start by defining the command-console API contract and execution adapters in `dashboard-api`. The first implementation should support the commands that already have backend equivalents or straightforward service calls, such as status, task creation, auto-pilot lifecycle actions, reports/cost views, and help/catalog discovery.

### Frontend second

Build the console component around that contract. Keep the component self-contained, using the existing shell layout for global availability and the existing markdown pipeline for safe output rendering.

### Route-aware polish last

Once command execution and transcript rendering are stable, add route-aware suggestions, persistent history search/recall, and responsive drawer behavior.

## File Strategy

### Expected backend files

- `apps/dashboard-api/src/dashboard/command-console.controller.ts`
- `apps/dashboard-api/src/dashboard/command-console.service.ts`
- `apps/dashboard-api/src/dashboard/dashboard.module.ts`
- `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` only if command execution needs live event push beyond request/response

### Expected frontend files

- `apps/dashboard/src/app/components/command-console/command-console.component.ts`
- `apps/dashboard/src/app/components/command-console/command-console.component.html`
- `apps/dashboard/src/app/components/command-console/command-console.component.scss`
- `apps/dashboard/src/app/layout/layout.component.ts`
- `apps/dashboard/src/app/services/api.service.ts`
- `apps/dashboard/src/app/models/api.types.ts`
- `apps/dashboard/package.json` if a syntax-highlighting dependency is required

## Risks

- Command coverage can grow large quickly if the implement worker tries to support every Nitro command end-to-end in one pass; prioritize the commands already backed by existing dashboard APIs.
- The dashboard shell currently uses inline layout markup/styles, so integrating a global slide-out panel should stay minimal to avoid unnecessary shell churn.
- Rich output rendering must stay sanitized; markdown and code-block support cannot bypass the existing safety pattern.
- Mobile usability can regress if the panel is treated as desktop-only; drawer sizing and open/close affordances need explicit responsive handling.

## Verification Expectations

- `npx nx build dashboard-api`
- `npx nx build dashboard`
- Manual validation of the console open/close flow, autocomplete, command execution, history recall, and task-detail-context suggestions
