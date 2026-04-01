# Task: Cost Budget & Circuit Breaker Module


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Build a TypeScript module at `packages/mcp-cortex/src/supervisor/budget.ts` that enforces per-task cost budgets and provides a circuit breaker for runaway workers.

## What to build
- `getCostBudget(complexity: string): number` — returns max cost in USD (Simple=$3, Medium=$8, Complex=## Description

5, configurable via session config)
- `checkBudget(worker: WorkerRecord): BudgetResult` — parses worker.cost_json, compares against budget, returns { exceeded: boolean, current: number, limit: number, overage: number }
- `shouldKill(worker: WorkerRecord, budget: number): boolean` — returns true if worker cost exceeds budget
- Configurable limits via session config JSON (allows override per session)

## References
- Worker cost tracking: `packages/mcp-cortex/src/db/schema.ts` (workers table, cost_json column)
- Known issue: `project_build_worker_cost_spike.md` — Simple task cost $8.46, should be under $2

## Dependencies

- TASK_2026_330

## Acceptance Criteria

- [ ] getCostBudget returns correct defaults for each complexity level
- [ ] checkBudget correctly parses cost_json and compares against budget
- [ ] shouldKill returns true when cost exceeds budget
- [ ] Budget limits are configurable via session config override

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/budget.ts (new)
- packages/mcp-cortex/src/supervisor/budget.spec.ts (new)


## Parallelism

Wave 1 — can run in parallel with TASK_2026_330, 331, 333. No shared files.
