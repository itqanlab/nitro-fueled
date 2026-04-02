# Plan — TASK_2026_218

## Approach
Add collapsible Advanced Options section to session creation form. Move Concurrency from basic form to Advanced section. Add new fields: Supervisor Model, Max Retries, Max Compactions, Poll Interval, Dry Run. Show config summary in session card headers.

## Files to Modify
1. `apps/dashboard/src/app/models/api.types.ts` — Add `supervisorModel`, `maxCompactions`, `pollIntervalMs`, `dryRun` to `CreateSessionRequest`
2. `apps/dashboard/src/app/views/project/project.component.ts` — Signals, handlers, load/save for new fields
3. `apps/dashboard/src/app/views/project/project.component.html` — Collapsible Advanced Options section
4. `apps/dashboard/src/app/views/project/project.component.scss` — Styles for collapsible + session-form layout
5. `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html` — Config summary in session card

## Key Decisions
- Concurrency moved from basic to Advanced Options (task specification)
- Poll Interval as a select (10s, 30s, 1m, 2m, 5m) — better UX than free numeric input
- Supervisor Model: haiku (default), sonnet, opus — mapped to full model IDs
- Advanced section collapsed by default; localStorage remembers last-used values
- Config summary in session card: concurrency, model, retries as compact badges
