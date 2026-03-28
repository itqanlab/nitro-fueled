# Task: Model Assignments view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the Model Assignments view at route `/models` matching the N.Gine mockup. Provider toggle bar at top: dynamically rendered from configured providers (e.g., Claude, GLM, OpenAI — whatever the user has configured). Main assignments table with columns: Role (agent name), Provider (badge), Model Selection (NG-ZORRO select with optgroups per configured provider), Fallback Chain (secondary/tertiary model as pill tags), Cost/Task (dollar value), Reset (icon button). Each row has an override badge inline below the model select (ROLE OVERRIDE in yellow, GLOBAL DEFAULT in grey). 7 rows: project-manager ($2.40), software-architect ($4.10), team-leader ($1.90), frontend-dev ($2.20), backend-dev ($3.80), security-reviewer, devops-engineer. Table footer row: Estimated total per task $14.92, budget mini progress bar ($59.40/$100 orange), Reset All and Save Assignments buttons. Sub-Agent Assignments section (collapsible): 3 sub-agent rows (code-analyzer parent: architect, test-generator parent: backend-dev, doc-writer parent: team-leader). Quick Presets section (5 cards): CLI-First ~$0.00, Budget Saver ~$4.20, Balanced ~$14.92, Maximum Quality ~$28.50, Speed Priority ~$2.80 — clicking a preset populates the table. All data from MockDataService.

### Architectural Constraints

- **UI is a client, not the core** — this view is a presentation layer. All business logic (model routing, cost calculation, preset definitions) lives in the API. The frontend calls the API and renders.
- **Dynamic providers** — render whatever providers the user has configured. Do not hardcode provider names — read from API.
- **Production-grade Angular** — lazy-loaded feature module, smart/dumb component split, Angular 19 best practices, NG-ZORRO components used correctly.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Provider toggle bar renders dynamically from configured providers with active state styling
- [ ] Assignments table renders all 7 rows with model select dropdowns using provider optgroups
- [ ] Override badges (ROLE OVERRIDE / GLOBAL DEFAULT) render inline per row with correct colors
- [ ] Fallback chain renders as pill tags showing secondary/tertiary model names
- [ ] Table footer shows total cost and budget progress bar with Save Assignments button
- [ ] Sub-agent section collapses/expands; 5 preset cards populate the table when clicked

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/model-assignments.html

## File Scope

- apps/dashboard/src/app/models/model-assignment.model.ts (created)
- apps/dashboard/src/app/services/model-assignment.constants.ts (created)
- apps/dashboard/src/app/services/mock-data.service.ts (modified)
- apps/dashboard/src/app/views/models/model-assignments.component.ts (created)
- apps/dashboard/src/app/views/models/model-assignments.component.html (created)
- apps/dashboard/src/app/views/models/model-assignments.component.scss (created)
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts (created)
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.html (created)
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.scss (created)
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.ts (created)
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.html (created)
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.scss (created)
- apps/dashboard/src/app/app.routes.ts (modified)
