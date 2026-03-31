# Task: Dashboard UI: Session Cost Breakdown Card


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Display a cost breakdown card in the session detail view showing supervisor cost vs worker cost with model labels. Read cost_breakdown data from the session detail API endpoint (provided by TASK_2026_246). Show a card with: supervisor model label + cost, per-worker-model cost rows, total cost. Use NG-ZORRO card and statistic components for consistent styling.

## Dependencies

- TASK_2026_246 -- provides cost_breakdown data in the session detail API response

## Acceptance Criteria

- [ ] Session detail view displays cost breakdown card with supervisor vs worker cost split
- [ ] Each model tier shows its own cost row (e.g., haiku: $0.02, sonnet: ## Acceptance Criteria

.50)
- [ ] Total cost shown at bottom of card
- [ ] Card handles missing cost data gracefully (shows 'No cost data' placeholder)

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.scss


## Parallelism

Must run after TASK_2026_246. Can run in parallel with other dashboard tasks. Wave 4.
