# Handoff — TASK_2026_331

## Files Changed
- packages/mcp-cortex/src/supervisor/budget.ts (new, 55 lines)
- packages/mcp-cortex/src/supervisor/budget.spec.ts (new, 80 lines)

## Commits
- (see implementation commit)

## Decisions
- `getCostBudget` accepts an optional `sessionConfig` record so callers can pass the session's `config` JSON without the module needing to hit the DB
- `checkBudget` and `shouldKill` receive the raw `cost_json` string (not a `WorkerRow`) to keep the module dependency-free — callers pull the string from the row themselves
- Complex tier defaults to $15 (the task.md had a formatting corruption; $15 is conservative and aligns with the observed $8–9 spike for Simple tasks)
- Fallback for unknown complexity is the Medium budget ($8) — safe middle ground

## Known Risks
- Default budget values ($3/$8/$15) are estimates; real-world calibration should happen once more worker runs are sampled via `get_model_performance`
- Session config override reads `config.budgets` as a nested object — callers must ensure the session `config` JSON is fully parsed before passing
