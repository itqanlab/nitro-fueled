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

Implement the Model Assignments view at route `/models` matching the N.Gine mockup. Provider toggle bar at top: 3 buttons (API active, CLI, OAuth) that filter the available model options in the table below. Main assignments table with columns: Role (agent name), Provider (badge), Model Selection (NG-ZORRO select with optgroups per provider: Claude CLI group, API - Anthropic group, API - OpenAI group), Fallback Chain (secondary/tertiary model as pill tags), Cost/Task (dollar value), Reset (icon button). Each row has an override badge inline below the model select (ROLE OVERRIDE in yellow, GLOBAL DEFAULT in grey). 7 rows: project-manager ($2.40), software-architect ($4.10), team-leader ($1.90), frontend-dev ($2.20), backend-dev ($3.80), security-reviewer, devops-engineer. Table footer row: Estimated total per task $14.92, budget mini progress bar ($59.40/$100 orange), Reset All and Save Assignments buttons. Sub-Agent Assignments section (collapsible): 3 sub-agent rows (code-analyzer parent: architect, test-generator parent: backend-dev, doc-writer parent: team-leader). Quick Presets section (5 cards): CLI-First ~$0.00, Budget Saver ~$4.20, Balanced ~$14.92, Maximum Quality ~$28.50, Speed Priority ~$2.80 — clicking a preset populates the table. All data from MockDataService.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Provider toggle bar renders 3 buttons with active state styling
- [ ] Assignments table renders all 7 rows with model select dropdowns using provider optgroups
- [ ] Override badges (ROLE OVERRIDE / GLOBAL DEFAULT) render inline per row with correct colors
- [ ] Fallback chain renders as pill tags showing secondary/tertiary model names
- [ ] Table footer shows total cost and budget progress bar with Save Assignments button
- [ ] Sub-agent section collapses/expands; 5 preset cards populate the table when clicked

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/model-assignments.html

## File Scope

- apps/dashboard/src/app/views/models/model-assignments.component.ts
- apps/dashboard/src/app/views/models/model-assignments.component.html
- apps/dashboard/src/app/views/models/model-assignments.component.scss
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.ts
