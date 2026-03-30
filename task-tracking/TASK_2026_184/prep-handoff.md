# Prep Handoff — TASK_2026_184

## Implementation Plan Summary

Build the command console as a dashboard-native control surface, not a raw browser terminal. The backend should expose a command catalog plus controlled execution adapters for the Nitro commands that already map to existing dashboard APIs. The frontend should mount a single reusable slide-out console in the global layout, reuse the existing safe markdown rendering pattern for output, persist history locally, and layer route-aware suggestions on top once the core execution loop works.

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| apps/dashboard-api/src/dashboard/command-console.service.ts | new | Centralize command metadata, suggestions, and controlled execution adapters |
| apps/dashboard-api/src/dashboard/command-console.controller.ts | new | Expose catalog, suggestions, and execution endpoints |
| apps/dashboard-api/src/dashboard/dashboard.module.ts | modify | Register the new controller and service |
| apps/dashboard/src/app/models/api.types.ts | modify | Add typed command-console request and response contracts |
| apps/dashboard/src/app/services/api.service.ts | modify | Add API client methods for command-console endpoints |
| apps/dashboard/src/app/components/command-console/command-console.component.ts | new | Own input state, history, suggestions, quick actions, and transcript behavior |
| apps/dashboard/src/app/components/command-console/command-console.component.html | new | Render the panel, autocomplete, output sections, and quick actions |
| apps/dashboard/src/app/components/command-console/command-console.component.scss | new | Style the console for desktop and mobile slide-out use |
| apps/dashboard/src/app/layout/layout.component.ts | modify | Mount the console globally so it is accessible from every page |
| apps/dashboard/package.json | modify if needed | Add syntax-highlighting support only if existing markdown rendering is insufficient |

## Batches

- Batch 1: Build the backend command-console contract and controlled execution layer — files: `apps/dashboard-api/src/dashboard/command-console.service.ts`, `apps/dashboard-api/src/dashboard/command-console.controller.ts`, `apps/dashboard-api/src/dashboard/dashboard.module.ts`
- Batch 2: Build the reusable frontend command-console slice and API integration — files: `apps/dashboard/src/app/models/api.types.ts`, `apps/dashboard/src/app/services/api.service.ts`, `apps/dashboard/src/app/components/command-console/command-console.component.ts`, `apps/dashboard/src/app/components/command-console/command-console.component.html`
- Batch 3: Mount the console globally and finish history, context, and polish — files: `apps/dashboard/src/app/layout/layout.component.ts`, `apps/dashboard/src/app/components/command-console/command-console.component.scss`, optionally `apps/dashboard/package.json`

## Key Decisions

- Use a controlled backend command adapter layer instead of exposing arbitrary shell execution from the browser.
- Reuse existing dashboard HTTP surfaces for commands that already exist as APIs rather than duplicating business logic in the component.
- Reuse the existing `marked` + `DOMPurify` output path for safe markdown rendering.
- Keep command history local to the dashboard client unless a later task introduces shared or server-backed history requirements.

## Gotchas

- `.claude/commands/*.md` exists on disk, but the Angular app cannot read workspace files directly; the command catalog must come from the backend.
- `layout.component.ts` uses inline template/styles, so global-panel integration should stay small and deliberate to avoid large shell refactors.
- `apps/dashboard/package.json` currently has markdown dependencies but no dedicated syntax-highlighting library; verify whether one is needed before changing dependencies.
- Route-aware suggestions should key off router state and known params like `taskId` or `sessionId`; do not scatter console-specific logic into every route component unless there is a real gap.
