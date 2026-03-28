# Task: Angular shell — layout, sidebar, routing, dark theme, mock data service

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P0-Critical     |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Build the full N.Gine application shell that all 9 views plug into. Implement the sidebar navigation with three sections: Projects (e-commerce-api active, my-react-app, go-microservice, + Add Project button with item counts), Library (Agents 14, Skills 13, Commands 8, Prompts 5, Workflows 7), and Management (Clients 4, Teams 3, Knowledge Base, Analytics, Integrations 3, Activity Log, Provider Hub, Settings). Implement the top header bar with the N.Gine logo/wordmark and action icons (search, notifications, settings). Implement the bottom status panel with 4 indicators (API status dot, Indexing progress bar, MCP connection status, Budget cost display). Set up Angular Router with named routes for all 9 views. Create `MockDataService` — an injectable Angular service providing typed static data (projects, tasks, agents, sessions, analytics, providers) consumed by all view components. All data from MockDataService must be realistic and match the values shown in the mockups.

## Dependencies

- TASK_2026_076 — provides the scaffolded Angular app, NG-ZORRO, and dark theme

## Acceptance Criteria

- [ ] Sidebar renders all 3 sections (Projects, Library, Management) with correct labels, count badges, and active state highlighting per the mockup
- [ ] Header bar renders logo and 3 action icons; layout is stable at all sidebar widths
- [ ] Bottom status panel renders with 4 indicators matching the mockup layout
- [ ] Angular Router configured with routes: `/dashboard`, `/analytics`, `/agents`, `/mcp`, `/models`, `/new-task`, `/onboarding`, `/providers`
- [ ] `MockDataService` injectable with typed interfaces for all data domains (Project, Task, Agent, Session, AnalyticsSummary, Provider)

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/dashboard.html

## File Scope

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
