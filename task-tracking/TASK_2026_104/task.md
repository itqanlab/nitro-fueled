# Task: Enhance RESEARCH Orchestration Flow (Market, Competitive, Feasibility)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P2-Medium |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

Enhance the existing **RESEARCH** task type. Currently it's minimal: `Researcher → conditional implementation`. Expand it to support structured research workflows beyond technical investigation.

**Current pipeline:** `Researcher → [conditional implementation]`

**New pipeline:** `PM → Researcher → [optional: Architect for tech evaluations] → PM (summary/recommendations)`

**New sub-flows:**
- **Market research:** PM defines research questions → Researcher investigates → PM synthesizes recommendations
- **Competitive analysis:** PM scopes competitors → Researcher deep-dives → PM produces comparison matrix
- **Technology evaluation:** PM defines criteria → Researcher investigates → Architect evaluates feasibility → PM recommends
- **Feasibility study:** PM scopes the question → Researcher + Architect collaborate → PM produces go/no-go recommendation

**Review criteria:** source quality, depth of analysis, actionable recommendations, bias detection.

**Additional keyword detection:** "market research", "competitive analysis", "feasibility study", "technology evaluation", "benchmark", "comparison", "evaluate options"

### Changes

1. **strategies.md** — Expand RESEARCH strategy section with sub-flow diagrams
2. **Orchestration SKILL.md** — Update RESEARCH pipeline routing to support sub-flows, add new keywords
3. **agent-catalog.md** — Update Researcher and PM capability for research sub-flows
4. **checkpoints.md** — Update RESEARCH row for new checkpoint needs

## Dependencies

- TASK_2026_101 — sequential file access (shared files)
- TASK_2026_106 — Universal lifecycle must be in place before adding new flows

## Acceptance Criteria

- [ ] strategies.md RESEARCH section expanded with sub-flow diagrams (market, competitive, tech eval, feasibility)
- [ ] Orchestration SKILL.md routes RESEARCH sub-flows correctly
- [ ] New keywords trigger RESEARCH type
- [ ] checkpoints.md updated for RESEARCH
- [ ] agent-catalog.md updated for Researcher + PM + Architect roles in research flows

## References

- Strategies: `.claude/skills/orchestration/references/strategies.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Agent catalog: `.claude/skills/orchestration/references/agent-catalog.md`
- Checkpoints: `.claude/skills/orchestration/references/checkpoints.md`

## File Scope

- .claude/skills/orchestration/references/strategies.md
- .claude/skills/orchestration/SKILL.md
- .claude/skills/orchestration/references/agent-catalog.md
- .claude/skills/orchestration/references/checkpoints.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_101, TASK_2026_102, TASK_2026_103, TASK_2026_105 — overlapping files
- Suggested execution wave: Wave 3, after TASK_2026_103
