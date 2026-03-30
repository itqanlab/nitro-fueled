# Task Description — TASK_2026_169

## Goal

Deliver a logs dashboard in the Nitro-Fueled web UI that lets operators inspect Cortex events, worker activity, session activity, and live updates from one place.

## Problem Statement

The dashboard already exposes task, session, analytics, and report views, but log investigation still requires jumping between Cortex data, worker/session artifacts, and real-time telemetry. This slows debugging and makes it hard to trace failures or active work.

## Functional Requirements

1. Provide an event log viewer that lists Cortex events in chronological order and supports filtering by session, task, event type, and severity.
2. Provide worker log inspection that shows worker metadata, grouped phase activity, and searchable worker-specific events.
3. Provide session log inspection that aggregates events and worker activity for a selected supervisor session.
4. Provide full-text search across log content with optional session/task and time-range constraints.
5. Provide live streaming for active sessions so newly emitted events appear without a manual refresh.

## Integration Constraints

- Reuse the existing NestJS dashboard module and Cortex service instead of introducing a parallel log backend.
- Reuse the Angular standalone route/view pattern already used by `reports`, `progress`, and other dashboard pages.
- Keep the implementation aligned with existing API service and shared dashboard UI patterns.

## Acceptance Criteria

- [ ] `/logs` presents Events, Workers, Sessions, and Search views inside the existing dashboard shell.
- [ ] Event data can be filtered by session, task, event type, and severity without leaving the page.
- [ ] Worker detail exposes worker metadata plus grouped phase/event history useful for debugging a single worker run.
- [ ] Session detail exposes aggregated activity for a selected session.
- [ ] Search returns matching log entries and supports narrowing by session/task and time window.
- [ ] Live updates append new events for active sessions in a way that does not break normal browsing.

## Non-Goals

- No separate log storage system or indexing service.
- No editing or replaying logs.
- No cross-project multi-tenant log view beyond the current workspace.
