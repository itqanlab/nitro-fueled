# Code Style Review — TASK_2026_184

## Verdict

FAIL

## Findings

1. Moderate — The UI advertises unsupported commands as primary actions.
   Files: `apps/dashboard/src/app/components/command-console/command-console.component.html:23-26`, `apps/dashboard-api/src/dashboard/command-console.service.ts:247-256`
   The quick actions expose `/nitro-create-task` and `/nitro-auto-pilot`, but the backend only executes `nitro-status` and `nitro-burn`, so the main buttons lead users into a controlled failure path.

2. Moderate — Route-aware suggestions are not wired to route context.
   Files: `apps/dashboard/src/app/components/command-console/command-console.component.ts:74,236-240`, `apps/dashboard/src/app/layout/layout.component.ts:1-45`
   The frontend never sends `route` or `taskId`, so the backend suggestion system only returns generic suggestions.

3. Moderate — Command execution can overlap.
   Files: `apps/dashboard/src/app/components/command-console/command-console.component.ts:88-108,116-119`, `apps/dashboard/src/app/components/command-console/command-console.component.html:22-27`
   There is no `isExecuting()` guard in `execute()`, and quick actions remain available while a request is in flight.

4. Moderate — The console panel misses key accessibility semantics.
   Files: `apps/dashboard/src/app/components/command-console/command-console.component.html:2-18,65-89`
   The toggle lacks clear ARIA state, the panel is not exposed as a dialog, and the autocomplete lacks combobox/listbox semantics and keyboard navigation.

5. Moderate — Catalog generation uses synchronous disk I/O per request.
   File: `apps/dashboard-api/src/dashboard/command-console.service.ts:183-203`
   `fs.readFileSync` runs across the catalog on every request instead of caching command descriptions once.

6. Minor — Request validation is manual instead of using DTOs.
   File: `apps/dashboard-api/src/dashboard/command-console.controller.ts:57-71`

7. Minor — Small cleanup debt remains.
   Files: `apps/dashboard-api/src/dashboard/command-console.service.ts:176-179`, `apps/dashboard/src/app/services/api.service.ts:100-101`
   `CortexService` is injected but unused, and `base`/`cortexBase` are identical.

8. Minor — Transcript growth is unbounded for the lifetime of the page.
   File: `apps/dashboard/src/app/components/command-console/command-console.component.ts:170-180`

9. Minor — Error handling hides useful API failure detail.
   File: `apps/dashboard/src/app/components/command-console/command-console.component.ts:103-106`

## Recommended Fixes

- Remove or disable unsupported quick actions until their backend adapters exist.
- Pass live route and task context into `getCommandSuggestions(...)`.
- Prevent overlapping execution while a command is already running.
- Add basic accessibility semantics for the toggle, panel, and autocomplete.
- Cache command description enrichment instead of reading markdown files on every request.
- Surface API error payload details in the transcript.
