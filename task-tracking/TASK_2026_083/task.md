# Task: New Task view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the New Task view at route `/new-task` matching the N.Gine mockup. Breadcrumb: e-commerce-api → New Task. Page title "Create New Task". Four form sections: (1) Task Description — title text input, multi-line description textarea with resize, file attachment drop zone showing "Drop files or click to browse" with dashed border. (2) Strategy Selection — auto-detect banner ("Auto-detected: FEATURE based on keywords") shown when description has content; 8 strategy cards in a 4-column × 2-row grid (Feature selected/blue, Bugfix, Refactor, Docs, Research, DevOps, Creative, Custom) each with icon, name, short description; clicking a card selects it with blue highlight. (3) Workflow Preview — visual horizontal pipeline strip: Scope → PM → Requirements → Architect → Architecture → Team Lead → Dev Loop → QA, with dashed-border checkpoint markers between stages indicating user review points; explanatory hint text below. (4) Advanced Options (collapsible toggle) — model override toggle switch; when enabled: table of agent roles (PM, Architect, Team Lead, Frontend Dev, Backend Dev) with Project Default column and This Task model select column using provider optgroups (dynamically from configured providers); cost estimate range "$2.50–$5.00 for FEATURE workflow" shown below table. Form action buttons at bottom: Cancel, Save as Draft, Start Task (primary).

### Architectural Constraints

- **UI is a client, not the core** — this view is a presentation layer. Task creation logic lives in the API. The frontend collects user input and sends it to the API.
- **Dynamic providers** — model selects render whatever providers the user has configured. Do not hardcode provider names — read from API.
- **Production-grade Angular** — lazy-loaded feature module, smart/dumb component split, Angular 19 best practices, NG-ZORRO components used correctly.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Breadcrumb and page title render correctly
- [ ] Attachment drop zone renders with dashed border and drag-and-drop visual state
- [ ] 8 strategy cards render in 4×2 grid; clicking a card selects it with blue border and background
- [ ] Auto-detect banner appears based on description content (if description non-empty)
- [ ] Workflow pipeline strip renders 8 steps with checkpoint dashed markers between stages
- [ ] Advanced Options collapses/expands; model override table renders correctly when toggle enabled

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/new-task.html

## File Scope

- apps/dashboard/src/app/views/new-task/new-task.component.ts
- apps/dashboard/src/app/views/new-task/new-task.component.html
- apps/dashboard/src/app/views/new-task/new-task.component.scss
- apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts
- apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.ts
