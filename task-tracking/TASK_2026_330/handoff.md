# Handoff — TASK_2026_330

## Files Changed
- packages/mcp-cortex/src/supervisor/router.ts (new, 293 lines)
- packages/mcp-cortex/src/supervisor/router.spec.ts (new, 242 lines)

## Commits
- (see implementation commit)

## Decisions
- Defined own `WorkerType` type in router.ts rather than importing from schema.ts to keep the module a pure function with no DB imports
- cost_efficiency: null cost treated as 1.0 (free → best efficiency); normalized against max avg_cost in the candidate set
- duration_efficiency: null duration treated as 1.0 (unknown → assume fast); normalized against max avg_duration_ms
- history filtered by `task_type` only (not worker type) to maximize sample size for scoring
- Model override falls through (rather than erroring) when no provider exposes that model, landing on defaults

## Known Risks
- Callers must filter history by task_type before passing — the router filters by task.type but if callers pass cross-task history, scoring works on mixed data (acceptable since same task_type filter applies)
- With very small history samples (1-2 records), scores are noisy; no min-sample guard implemented yet
