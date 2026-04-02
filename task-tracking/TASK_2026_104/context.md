# Context — TASK_2026_104

## User Intent

Enhance the RESEARCH task type in the orchestration skill to support structured research workflows beyond basic technical investigation. The current pipeline is minimal (`Researcher → conditional implementation`). The new pipeline adds PM-driven scoping, optional Architect collaboration for technical evaluations, and PM synthesis/recommendations at the end.

## Strategy

**Type**: FEATURE
**Strategy**: FEATURE (pure orchestration specification work — no application code changes)
**Developer**: nitro-systems-developer (agent/skill/reference updates)

## Affected Files

1. `.claude/skills/orchestration/references/strategies.md` — Expand RESEARCH section
2. `.claude/skills/orchestration/SKILL.md` — Update RESEARCH pipeline routing + keywords
3. `.claude/skills/orchestration/references/agent-catalog.md` — Update Researcher + PM + Architect entries
4. `.claude/skills/orchestration/references/checkpoints.md` — Update RESEARCH row

## New Sub-Flows

1. **Market research**: PM defines questions → Researcher investigates → PM synthesizes
2. **Competitive analysis**: PM scopes competitors → Researcher deep-dives → PM produces comparison matrix
3. **Technology evaluation**: PM defines criteria → Researcher investigates → Architect evaluates → PM recommends
4. **Feasibility study**: PM scopes question → Researcher + Architect collaborate → PM produces go/no-go
