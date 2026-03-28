# Task: Auto-Pilot Routing Update — Use Resolver Instead of Hardcoded Table (Part 3/3 — Provider Resolver Engine)

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |
| Model      | default     |
| Testing    | skip        |

## Description

Update the auto-pilot SKILL.md to use the resolver engine instead of the hardcoded provider routing table. The supervisor no longer decides `provider: "glm"` or `provider: "opencode"` by name — it sends `{ provider: <from routing config>, tier: <from task complexity> }` and the resolver handles everything.

### Current State (hardcoded routing table)

```
Build Worker + Complex → claude / claude-opus-4-6
Build Worker + Medium → glm / glm-5
Build Worker + Simple → glm / glm-4.7
Review Worker + logic → claude / claude-opus-4-6
Review Worker + style → glm / glm-4.7
Review Worker + simple → opencode / openai/gpt-4.1-mini
Build Worker + DOCS/RESEARCH → opencode / openai/gpt-4.1-mini
```

### Target State (config-driven routing)

```
Build Worker + Complex → routing.complex-tasks provider, tier: heavy
Build Worker + Medium → routing.default provider, tier: balanced
Build Worker + Simple → routing.default provider, tier: light
Review Worker + logic → routing.review-logic provider, tier: heavy
Review Worker + style → routing.review-style provider, tier: balanced
Review Worker + simple → routing.default provider, tier: light
Build Worker + DOCS/RESEARCH → routing.documentation provider, tier: light
```

The supervisor reads `routing` from config and passes `{ provider, tier }` to `spawn_worker`. The resolver (TASK_2026_111) handles model resolution, launcher selection, and fallback.

### Changes

1. **Auto-pilot SKILL.md** — Replace hardcoded routing table with config-driven routing. Update Step 5a-jit, Step 5c/5d (provider routing), spawn fallback logic. Remove all hardcoded model names from routing decisions.
2. **Auto-pilot SKILL.md** — Update worker prompt templates to not reference specific providers/models by name — use the resolved values passed by the supervisor.

## Dependencies

- TASK_2026_110 — config schema with `routing` section
- TASK_2026_111 — resolver engine in session-orchestrator

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md has no hardcoded provider names in routing decisions
- [ ] Auto-pilot SKILL.md has no hardcoded model names in routing decisions
- [ ] Routing reads from config `routing` section to determine provider per task condition
- [ ] Supervisor passes `{ provider, tier }` to `spawn_worker`, not specific model names
- [ ] Fallback logic delegates to resolver (not hardcoded in SKILL.md)
- [ ] Worker prompt templates use resolved provider/model values, not hardcoded ones
- [ ] Existing behavior preserved when config matches current defaults

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Config schema: from TASK_2026_110
- Resolver: from TASK_2026_111

## File Scope

- .claude/skills/auto-pilot/SKILL.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_099, TASK_2026_100 — all modify auto-pilot SKILL.md
- Suggested execution wave: after TASK_2026_099, TASK_2026_100, TASK_2026_110, TASK_2026_111
