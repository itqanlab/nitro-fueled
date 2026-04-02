# Task Description — TASK_2026_187

## Goal

Add a dedicated dashboard area for browsing finished orchestration and auto-pilot sessions so operators can answer: what ran, what it cost, which tasks ended how, and what happened during that session.

## Problem Statement

The dashboard already covers active sessions, raw logs, and aggregate analytics, but it does not offer a structured historical session results view. Users can inspect a running session or browse raw events, yet they still lack a clear per-session summary once a run has ended.

## Functional Requirements

1. Add a `/sessions` route that lists ended sessions with source, timing, duration, outcome badge, task outcome counts, total cost, and primary model information.
2. Add a `/sessions/:id` route that shows session metadata, per-task outcomes, timeline events, full session log content, and worker summaries.
3. Add backend endpoints for the sessions list and detail views backed by Cortex SQLite data rather than mock data.
4. Add a Sessions entry to the dashboard sidebar so the new history view is reachable from the main shell.

## Integration Constraints

- Reuse existing Cortex-backed dashboard services instead of introducing a separate history store.
- Preserve the existing active-session experience: `/session/:sessionId` remains the live viewer while the new plural `/sessions` route handles historical browsing.
- Reconcile the existing backend `/api/sessions` and `/api/sessions/:id` endpoints, which currently serve the older in-memory active-session model, before wiring the new history contract.
- Keep frontend contracts in `api.types.ts` and `api.service.ts` aligned with the backend response shapes.

## Acceptance Criteria

- [ ] `/sessions` renders a paginated list of ended sessions with summary stats sourced from Cortex data.
- [ ] Selecting a session opens `/sessions/:id` with task results, timeline, session log, and worker details.
- [ ] Session detail reports accurate COMPLETE / FAILED / BLOCKED task outcomes for that session.
- [ ] Backend `GET /api/sessions` and `GET /api/sessions/:id` return real session history data from Cortex.
- [ ] The sidebar includes a Sessions navigation entry.

## Non-Goals

- No replacement of the existing live `/session/:sessionId` chat-style viewer.
- No mock-only implementation for the new history APIs.
- No new persistence layer outside the existing Cortex DB and existing task/session artifacts.
