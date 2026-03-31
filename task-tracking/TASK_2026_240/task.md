# Task: Dashboard Multi-Workspace Support

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Part 3 of 3 — original request: Move server, webapp, and DB to user scope. Run from anywhere, switch between projects/workspaces.

Update the Angular dashboard to support multiple workspaces. Users can switch between projects from the UI.

**UI changes:**

1. **Workspace selector** — top nav bar dropdown showing all registered workspaces. Current workspace highlighted. Click to switch. Shows: workspace name, tech stack badge, active workers count.

2. **Workspace overview page** (`/workspaces`) — card grid of all registered workspaces:
   - Name, path, tech stack icons
   - Task stats (created/in-progress/complete)
   - Active workers count
   - Last activity timestamp
   - Quick actions: open, configure, remove
   - "Add Workspace" card with path input

3. **Context scoping** — when a workspace is selected, all views (tasks, reports, sessions, workers) are scoped to that workspace. The API service sends `workspace` header or query param with every request.

4. **Cross-workspace views** (optional stretch):
   - Global cost summary across all workspaces
   - Global worker activity across all workspaces

**API integration:**
- All existing API calls gain a `?workspace=<name>` query param
- Server routes to the correct project DB based on workspace param
- WebSocket events tagged with workspace ID

## Dependencies

- TASK_2026_239 — Workspace management (API endpoints)

## Acceptance Criteria

- [ ] Workspace selector in top nav with all registered workspaces
- [ ] Workspace overview page at /workspaces route
- [ ] All views scoped to selected workspace
- [ ] API calls include workspace context
- [ ] Switching workspace updates all views immediately

## References

- Workspace API: TASK_2026_239
- Dashboard app: `apps/dashboard/src/app/`
- Current navigation: `apps/dashboard/src/app/app.routes.ts`

## File Scope

- `apps/dashboard/src/app/views/workspaces/workspaces.component.ts` (new)
- `apps/dashboard/src/app/views/workspaces/workspaces.component.html` (new)
- `apps/dashboard/src/app/shared/workspace-selector/workspace-selector.component.ts` (new)
- `apps/dashboard/src/app/services/workspace.service.ts` (new)
- `apps/dashboard/src/app/services/api.service.ts` (modified — add workspace context)
- `apps/dashboard/src/app/app.routes.ts` (modified — add routes)

## Parallelism

Can run in parallel — mostly new files. Minor overlap on api.service.ts and app.routes.ts with other dashboard tasks — schedule in a later wave after TASK_2026_210, TASK_2026_217, TASK_2026_232.
