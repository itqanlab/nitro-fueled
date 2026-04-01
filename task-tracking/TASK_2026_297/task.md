# Task: Wire Sidebar navigation to real data (badges, items)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P0-Critical |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

The SidebarComponent uses MOCK_SIDEBAR_SECTIONS from mock-data.constants.ts — all nav items, routes, and badge counts are hardcoded mock data.

## Context
- Mock source: MOCK_SIDEBAR_SECTIONS (5 sections, hardcoded badges like '14 agents', '11 orchestration')
- Sidebar is visible on every page

## What to do
1. Identify which badges map to real countable data (tasks, agents, sessions, etc.)
2. Wire badge counts to real API calls (getStats(), getCortexTasks(), etc.)
3. Remove MOCK_SIDEBAR_SECTIONS dependency
4. Keep nav items as static config (routes don't need to be dynamic) but remove mock import
5. Ensure all sidebar links route correctly (some currently point to /dashboard as placeholder)

## Acceptance Criteria
- Sidebar nav items defined as static config (not from mock constants)
- Badge counts driven by real data
- No mock constants imported
- All sidebar links point to correct routes

## Dependencies

- None

## Acceptance Criteria

- [ ] Sidebar items defined as static config, not from mock constants
- [ ] Badge counts pulled from real API
- [ ] MOCK_SIDEBAR_SECTIONS removed
- [ ] All nav links point to correct routes

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/layout/sidebar/sidebar.component.ts
- apps/dashboard/src/app/services/mock-data.constants.ts
- apps/dashboard/src/app/services/api.service.ts


## Parallelism

Can run in parallel with TASK_2026_297 (workspace switcher). Blocks all other tasks since shell must work first.
