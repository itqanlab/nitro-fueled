# Task: Real-Time Progress Center — Live Status, Health & ETA

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Build a real-time progress tracking center that gives instant visibility into what's happening across all active work. This is the "mission control" view that makes the terminal unnecessary for monitoring.

Features:
1. **Session Progress** — For each active auto-pilot session: overall progress bar (tasks completed / total), current phase per active task, elapsed time
2. **Task Progress** — Per-task progress indicator showing which orchestration phase it's in (PM → Architect → Dev → QA → Review), with phase completion checkmarks
3. **Health Dashboard** — System-wide health: active workers count, stuck workers, failed tasks, retry count. Color-coded (green/yellow/red)
4. **Live Activity Feed** — Real-time scrolling feed of events (task started, phase completed, review passed, worker spawned) — like a GitHub activity feed
5. **ETA Estimation** — Based on historical phase durations, estimate time remaining for active tasks and sessions
6. **Notifications** — Browser notifications for key events (task completed, task failed, session finished, budget alert)

All data streams via WebSocket for real-time updates without polling.

## Dependencies

- None

## Acceptance Criteria

- [ ] Session and task progress bars update in real-time via WebSocket
- [ ] Health dashboard shows accurate worker and task counts with color coding
- [ ] Live activity feed streams events as they happen
- [ ] ETA estimates are shown based on historical averages
- [ ] Browser notifications fire for task completion and failure events

## Parallelism

✅ Can run in parallel — new progress page, no overlap with other CREATED tasks.

## References

- Home page (command center): TASK_2026_147 (COMPLETE)
- WebSocket gateway: `apps/dashboard-api/src/`
- Cortex events: `packages/mcp-cortex/`

## File Scope

- apps/dashboard-api/src/dashboard/progress-center.types.ts
- apps/dashboard-api/src/dashboard/progress-center.service.ts
- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/dashboard.module.ts
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts
- apps/dashboard/src/app/models/progress-center.model.ts
- apps/dashboard/src/app/services/api.service.ts
- apps/dashboard/src/app/services/websocket.service.ts
- apps/dashboard/src/app/views/progress-center/progress-center.component.ts
- apps/dashboard/src/app/views/progress-center/progress-center.component.html
- apps/dashboard/src/app/views/progress-center/progress-center.component.scss
- apps/dashboard/src/app/app.routes.ts
- apps/dashboard/src/app/services/mock-data.constants.ts
