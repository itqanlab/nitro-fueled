# Task: Project Page — Task Queue Board

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

Part 1 of 4 — original request: Web-based Auto-Pilot Control Center.

Create a project page that shows the full task queue with live status indicators. This is the central view where users see what's happening across all tasks and can navigate to running sessions.

**What to build:**

1. **Task queue list/board** — Show all tasks with current status: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, FAILED, BLOCKED. Support both list view and optional Kanban-style column view.
2. **Status indicators** — Running tasks get prominent live indicators (pulsing dot, highlighted row). Queued tasks show their position. Completed/failed tasks are visually distinct.
3. **Task row details** — Each task shows: Task ID, title, status badge, current phase (PM/Architect/Dev/QA if running), assigned session ID (if running), last activity timestamp.
4. **Filters** — Filter by status, search by task ID or title.
5. **Click-to-navigate** — Clicking a running task navigates to the session viewer (TASK_2026_157). Clicking a non-running task shows task details.
6. **"Start Auto-Pilot" button** — Prominent button at the top (wired to action in TASK_2026_156). For now, renders as a button with mock click handler.

All mock data — mock task list with various statuses, mock running indicators.

## Dependencies

- None

## Acceptance Criteria

- [ ] Project page displays all tasks with status badges
- [ ] Running tasks have prominent live indicators (pulsing/highlighted)
- [ ] Task list supports filtering by status
- [ ] Each task row shows ID, title, status, phase, session ID, last activity
- [ ] Clicking a running task navigates to `/session/:id` route (placeholder for now)
- [ ] "Start Auto-Pilot" button renders at the top of the page

## References

- Existing task models: `apps/dashboard/src/app/models/task.model.ts`
- Existing task-card: `apps/dashboard/src/app/shared/task-card/`
- Session model: `apps/dashboard/src/app/models/session.model.ts`
- Routes: `apps/dashboard/src/app/app.routes.ts`

## File Scope

- `apps/dashboard/src/app/views/project/project.component.ts` (new)
- `apps/dashboard/src/app/views/project/project.component.html` (new)
- `apps/dashboard/src/app/views/project/project.component.scss` (new)
- `apps/dashboard/src/app/models/project-queue.model.ts` (new)
- `apps/dashboard/src/app/services/project.constants.ts` (new — mock data)
- `apps/dashboard/src/app/app.routes.ts` (modified — add /project route)

## Parallelism

✅ Can run in parallel — no file scope overlap with other CREATED tasks. Touches new files only (except app.routes.ts which is a minimal 1-line addition).
