# Task: Dashboard Home — Live Command Center Redesign

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

Redesign the `/dashboard` home page as a live operational command center. The home page should give the user a single-glance overview of everything happening in the system — task statuses, token/cost usage, active sessions, and active tasks.

The redesign replaces the current dashboard view with a numbers-focused, command center layout using stat cards and compact lists. All data is mock for now (no real API integration).

**Sections to implement:**

1. **Task Status Breakdown** — stat cards showing counts by status: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, FAILED, BLOCKED. Include a total task count card.
2. **Token & Cost Summary** — total tokens consumed, total cost ($), with a breakdown by recent sessions.
3. **Active Sessions** — count of currently running sessions, small list showing session ID and what task each is working on.
4. **Active Tasks** — count of in-progress tasks with a mini list (task ID, title, current status).

Design should be clean, numbers-focused, minimal details. Command center feel — one glance tells you the state of everything.

## Dependencies

- None

## Acceptance Criteria

- [ ] Dashboard home page shows stat cards with task counts per status (CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, FAILED, BLOCKED)
- [ ] Total task count is displayed prominently
- [ ] Token usage summary card shows total tokens consumed and total cost ($)
- [ ] Active sessions section shows count and a compact list (session ID + assigned task)
- [ ] Active tasks section shows count and a compact list (task ID, title, status)
- [ ] All data comes from mock data constants (no real API calls)
- [ ] Existing shared stat-card component is reused or extended
- [ ] Page is responsive and renders cleanly at common breakpoints

## References

- Existing dashboard view: `apps/dashboard/src/app/views/dashboard/`
- Shared stat-card: `apps/dashboard/src/app/shared/stat-card/`
- Mock data service: `apps/dashboard/src/app/services/mock-data.service.ts`
- Mock data constants: `apps/dashboard/src/app/services/mock-data.constants.ts`
- Dashboard model: `apps/dashboard/src/app/models/` (may need new model file)

## File Scope

- `apps/dashboard/src/app/views/dashboard/dashboard.component.ts` (modified)
- `apps/dashboard/src/app/views/dashboard/dashboard.component.html` (modified)
- `apps/dashboard/src/app/views/dashboard/dashboard.component.scss` (modified)
- `apps/dashboard/src/app/services/mock-data.constants.ts` (modified)
- `apps/dashboard/src/app/services/mock-data.service.ts` (modified)
- `apps/dashboard/src/app/models/dashboard.model.ts` (new)

## Parallelism

✅ Can run in parallel — no file scope overlap with other CREATED tasks. TASK_2026_128 touches model files but different ones (analytics/agent-editor interfaces, not dashboard models).
