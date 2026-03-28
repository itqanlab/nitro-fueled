# Review Context — TASK_2026_077

## Task Scope
- Task ID: 2026_077
- Task type: FEATURE
- Files in scope: (these are the ONLY files reviewers may touch)
  - apps/dashboard/src/app/models/project.model.ts (created)
  - apps/dashboard/src/app/models/task.model.ts (created)
  - apps/dashboard/src/app/models/agent.model.ts (created)
  - apps/dashboard/src/app/models/session.model.ts (created)
  - apps/dashboard/src/app/models/analytics-summary.model.ts (created)
  - apps/dashboard/src/app/models/provider.model.ts (created)
  - apps/dashboard/src/app/models/sidebar.model.ts (created)
  - apps/dashboard/src/app/services/mock-data.constants.ts (created)
  - apps/dashboard/src/app/services/mock-data.service.ts (created)
  - apps/dashboard/src/app/layout/layout.component.ts (created)
  - apps/dashboard/src/app/layout/header/header.component.ts (created)
  - apps/dashboard/src/app/layout/sidebar/sidebar.component.ts (created)
  - apps/dashboard/src/app/layout/sidebar/sidebar.component.html (created)
  - apps/dashboard/src/app/layout/sidebar/sidebar.component.scss (created)
  - apps/dashboard/src/app/layout/status-bar/status-bar.component.ts (created)
  - apps/dashboard/src/app/layout/status-bar/status-bar.component.html (created)
  - apps/dashboard/src/app/layout/status-bar/status-bar.component.scss (created)
  - apps/dashboard/src/app/views/placeholder-view.component.ts (created)
  - apps/dashboard/src/app/app.routes.ts (created)
  - apps/dashboard/src/app/app.config.ts (modified)
  - apps/dashboard/src/app/app.component.ts (modified)
  - apps/dashboard/src/styles.scss (modified)

## Git Diff Summary

Implementation commit: `d3107bf feat(dashboard): add application shell with layout, sidebar, routing, and mock data service`

**Files changed (22 source files, 922 insertions, 23 deletions):**

- `app.component.ts` — replaced placeholder template with `<router-outlet />`, removed inline styles, added RouterOutlet import
- `app.config.ts` — added provideRouter(APP_ROUTES), provideNzIcons with SearchOutline/BellOutline/SettingOutline
- `app.routes.ts` — new file; defines APP_ROUTES with LayoutComponent as shell and 8 child routes (dashboard, analytics, agents, mcp, models, new-task, onboarding, providers), all using PlaceholderViewComponent
- `layout/layout.component.ts` — new file; shell component with header/sidebar/main/status-bar layout using CSS flexbox
- `layout/header/header.component.ts` — new file; standalone component with inline template+styles; renders N.Gine logo wordmark and 3 action icon buttons (search, bell, setting) via NzIconModule
- `layout/sidebar/sidebar.component.ts` — new file; standalone, injects MockDataService, exposes `sections: readonly SidebarSection[]`, trackBy methods
- `layout/sidebar/sidebar.component.html` — new file; 42 lines, uses `@for`/`@if` control flow, routerLink/routerLinkActive, [ngClass] for dot status and active state, conditional badge rendering
- `layout/sidebar/sidebar.component.scss` — new file; 118 lines; full sidebar styles including section headers, items, dots, badges, add-button, divider, spacer
- `layout/status-bar/status-bar.component.ts` — new file; 19 lines; standalone, injects MockDataService for indicators/mcpCount/autoRunEnabled/budget
- `layout/status-bar/status-bar.component.html` — new file; 36 lines; renders indicators loop, MCP count, auto-run toggle, budget cost
- `layout/status-bar/status-bar.component.scss` — new file; 74 lines; bottom panel styles, dot status colors, progress bar, pulse animation
- `models/project.model.ts` — new file; ProjectStatus union type + Project interface (all readonly fields)
- `models/task.model.ts` — new file; TaskStatus/TaskType/TaskPriority/PipelineStage/PipelineStageStatus union types + Task + PipelineStep interfaces
- `models/agent.model.ts` — new file; AgentModel/AgentTeam union types + Agent interface
- `models/session.model.ts` — new file; ActivityEntry interface (named "session" but contains activity log entries)
- `models/analytics-summary.model.ts` — new file; AnalyticsSummary interface
- `models/provider.model.ts` — new file; ProviderStatusType union + StatusIndicator + Provider interfaces
- `models/sidebar.model.ts` — new file; SidebarItemType union + SidebarSection + SidebarItem interfaces
- `services/mock-data.constants.ts` — new file; 215 lines; all static mock data as exported `const` arrays/objects (MOCK_PROJECTS, MOCK_ACTIVE_TASKS, MOCK_COMPLETED_TASKS, MOCK_AGENTS, MOCK_ACTIVITY, MOCK_ANALYTICS, MOCK_STATUS_INDICATORS, MOCK_SIDEBAR_SECTIONS); emoji icons encoded as unicode escapes
- `services/mock-data.service.ts` — new file; 65 lines; @Injectable({providedIn:'root'}), 12 public getter methods returning typed data from constants
- `views/placeholder-view.component.ts` — new file; 39 lines; reads `data.title` from ActivatedRoute, uses AsyncPipe + Observable pattern
- `styles.scss` — modified; added CSS custom properties for --bg-tertiary, --bg-hover, --border, --border-light, --accent-hover, --accent-bg, --radius, --radius-lg

## Project Conventions
From CLAUDE.md:
- Git: conventional commits with scopes
- Agent naming: all agents use the `nitro-` prefix
- TypeScript is used throughout; Angular 19 with standalone components pattern
- This is an Nx workspace; apps/ contains Angular applications

From TypeScript conventions:
- Explicit access modifiers on ALL class members (`public`, `private`, `protected`)
- No `any` type ever
- String literal unions for status/type/category fields — never bare `string`
- No unused imports or dead code
- kebab-case for file names, PascalCase for classes/interfaces/types
- One interface/type per file (model files)

## Style Decisions from Review Lessons
Relevant rules from `.claude/review-lessons/review-general.md`:

**File Size Limits (MOST VIOLATED RULE):**
- Components: max 150 lines. Inline templates: max 50 lines.
- Services/repositories: max 200 lines.
- `header.component.ts` has inline template+styles totaling 83 lines — within component limit but inline styles are a smell when they exceed ~30 lines
- `mock-data.constants.ts` is 215 lines — exceeds the 200-line service limit (it is a constants file, not a service, but warrants review)

**TypeScript:**
- Explicit access modifiers on ALL class members — verify every component property and method
- No `any` type — verify no implicit `any` in `map((data) => (data['title'] as string))`
- No `as` type assertions — `data['title'] as string` in `placeholder-view.component.ts` is a type assertion
- String literal unions for status/type fields — well-applied here (union types throughout)

**Constants files:**
- Single responsibility — `mock-data.constants.ts` contains 8 distinct domains; may violate single-responsibility rule

**File naming:**
- `session.model.ts` contains `ActivityEntry` (not a session/session model — naming mismatch)

**Frontend Interaction:**
- No `getBoundingClientRect()` or SVG interaction in this diff — not applicable
- `AsyncPipe` pattern used in `placeholder-view.component.ts` — correct for Observable-based data

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard/src/app/models/project.model.ts
- apps/dashboard/src/app/models/task.model.ts
- apps/dashboard/src/app/models/agent.model.ts
- apps/dashboard/src/app/models/session.model.ts
- apps/dashboard/src/app/models/analytics-summary.model.ts
- apps/dashboard/src/app/models/provider.model.ts
- apps/dashboard/src/app/models/sidebar.model.ts
- apps/dashboard/src/app/services/mock-data.constants.ts
- apps/dashboard/src/app/services/mock-data.service.ts
- apps/dashboard/src/app/layout/layout.component.ts
- apps/dashboard/src/app/layout/header/header.component.ts
- apps/dashboard/src/app/layout/sidebar/sidebar.component.ts
- apps/dashboard/src/app/layout/sidebar/sidebar.component.html
- apps/dashboard/src/app/layout/sidebar/sidebar.component.scss
- apps/dashboard/src/app/layout/status-bar/status-bar.component.ts
- apps/dashboard/src/app/layout/status-bar/status-bar.component.html
- apps/dashboard/src/app/layout/status-bar/status-bar.component.scss
- apps/dashboard/src/app/views/placeholder-view.component.ts
- apps/dashboard/src/app/app.routes.ts
- apps/dashboard/src/app/app.config.ts
- apps/dashboard/src/app/app.component.ts
- apps/dashboard/src/styles.scss

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 6
- Minor: 10
