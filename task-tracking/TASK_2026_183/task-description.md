# Task Description — TASK_2026_183

## Goal
Create a dedicated dashboard page that turns live orchestration data into an at-a-glance progress center for active auto-pilot work.

## Requirements
- Show per-session progress with completed-vs-total task counts, elapsed time, active phase, and ETA.
- Show per-task phase progress using the UI sequence `PM -> Architect -> Dev -> QA -> Review`.
- Surface health metrics for active sessions, workers, stuck work, failed tasks, and retries.
- Stream recent activity from cortex events and refresh the page from WebSocket activity instead of interval polling.
- Fire browser notifications for task completion and failure events when notification permission is available.

## Constraints
- Reuse existing dashboard API, cortex, and WebSocket infrastructure where possible.
- Keep the frontend implementation standalone and route-driven.
- Degrade cleanly when cortex data is unavailable.

## Validation
- `npx nx build dashboard-api`
- `npx nx build dashboard` (currently blocked by pre-existing errors in unrelated dashboard files)
