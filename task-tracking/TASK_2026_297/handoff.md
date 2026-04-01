# Handoff — TASK_2026_297

## Files Changed
- apps/dashboard/src/app/layout/sidebar/sidebar.component.ts (modified, full rewrite)
- apps/dashboard/src/app/layout/sidebar/sidebar.component.html (modified, +1 -1)
- apps/dashboard/src/app/services/mock-data.constants.ts (modified, removed MOCK_SIDEBAR_SECTIONS + SidebarSection import)
- apps/dashboard/src/app/services/mock-data.service.ts (modified, removed getSidebarSections() + MOCK_SIDEBAR_SECTIONS import)

## Commits
- (see implementation commit)

## Decisions
- Static nav config defined in sidebar.component.ts (SIDEBAR_SECTIONS const) — no API needed for nav structure
- Removed placeholder Management items (Clients, Teams, Knowledge Base, Activity Log) that had no real routes
- Orchestration badge wired to IN_PROGRESS + IN_REVIEW task count from getStats()
- Sessions badge wired to activeWorkers count from getStats() (reuses the single getStats() call)
- Used toSignal() + computed() for OnPush-compatible reactivity — no manual subscription management
- getStats() error silenced via catchError → of(null) so sidebar renders with no badges on API failure

## Known Risks
- getStats() is called on every sidebar mount; if the API is slow, badges appear after a brief delay
- Library items (Agents, Skills, Commands, Prompts, Workflows) all still route to /agents — no dedicated routes exist yet
