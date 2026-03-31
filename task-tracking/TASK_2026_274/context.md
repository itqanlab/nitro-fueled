# Context — TASK_2026_274

## User Intent
Enforce preferred_tier routing end-to-end:
1. Task creator auto-derives preferred_tier from complexity (Simple→light, Medium→balanced, Complex→heavy) so no task enters the pipeline without a tier.
2. Supervisor hard-routes on preferred_tier — no silent fallback to session default model.
3. Supervisor logs explicit error + blocks task when a tier cannot be satisfied.

## Strategy
FEATURE — nitro-systems-developer will modify 3 files.

## Session
SESSION_2026-03-31T16-14-56

## Files to Modify
- .claude/commands/nitro-create-task.md — auto-set preferred_tier from complexity
- .claude/skills/auto-pilot/references/parallel-mode.md — hard-route on preferred_tier in Step 5
- .claude/skills/auto-pilot/SKILL.md — update Key Principle #11

## Tier → Model Mapping (from evidence)
- light → glm-4.7 (low-cost, ~67% success rate)
- balanced → glm-5.1 or claude-sonnet-4-6 (mid-tier)
- heavy → claude-opus-4-6 (premium)
