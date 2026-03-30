# Task: Auto-Pilot Routing Update — Config-Driven with Codex Support (Part 3/3 — Provider Resolver Engine)

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | REFACTORING |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | skip        |
| Poll Interval         | default     |
| Health Check Interval | default     |
| Max Retries           | default     |

## Description

Update the auto-pilot SKILL.md to use the resolver engine (TASK_2026_111) instead of the hardcoded provider routing table. The supervisor no longer hardcodes `provider: "glm"` or `provider: "opencode"` — it reads routing from config and passes `{ provider, tier }` to `spawn_worker`. The resolver handles launcher selection, model resolution, and fallback.

### Current State (hardcoded routing table in SKILL.md)

```
Build Worker + Complex             → claude        / claude-opus-4-6
Build Worker + Medium              → glm           / glm-5
Build Worker + Simple              → glm           / glm-4.7
Review Worker + logic              → claude        / claude-opus-4-6
Review Worker + style              → glm           / glm-4.7
Review Worker + simple             → opencode      / openai/gpt-4.1-mini
Build Worker + DOCS/RESEARCH       → opencode      / openai/gpt-4.1-mini
```

### Target State (config-driven routing)

```
Build Worker + preferred_tier=heavy       → routing.heavy provider,         tier: heavy
Build Worker + preferred_tier=balanced    → routing.default provider,       tier: balanced
Build Worker + preferred_tier=light       → routing.default provider,       tier: light
Review Worker + type=logic                → routing.review-logic provider,  tier: heavy
Review Worker + type=style                → routing.review-style provider,  tier: balanced
Review Worker + type=simple               → routing.review-simple provider, tier: light
Build Worker + Type=DOCUMENTATION/RESEARCH → routing.documentation provider, tier: light
```

The supervisor reads `routing` from `~/.nitro-fueled/config.json` (falling back to project-level config) and passes `{ provider: <routing value>, tier: <tier> }` to `spawn_worker`. The resolver engine picks the launcher, model, and auth path.

### Codex in the Routing Table

Add `codex` as an available provider option in the routing table comments. Example config that uses codex for simple review tasks:

```json
"routing": {
  "review-simple": "openai-codex"
}
```

The SKILL.md routing table section should document that `openai-codex` (codex launcher) and `openai-opencode` (opencode launcher) are both valid provider names for OpenAI models, and differ in harness behavior.

### Spawn Fallback Update

Remove the hardcoded fallback `provider=claude, model=claude-sonnet-4-6` string from SKILL.md. Replace with: "fall back to the resolver's last-resort provider (always `anthropic/claude-sonnet-4-6` via `claude` launcher)." The resolver owns this logic — SKILL.md just says to delegate.

### Changes

1. **auto-pilot SKILL.md** — Replace hardcoded Provider Routing Table (Step 5d) with config-driven routing. Remove all hardcoded model names from routing decisions. Update spawn fallback section to delegate to resolver.
2. **auto-pilot SKILL.md** — Add `codex` and `openai-codex` as valid provider options in routing table documentation. Update examples to use provider names from config (not launcher names).
3. **auto-pilot SKILL.md** — Update Step 5g (spawn failure) to reference resolver fallback chain instead of hardcoded `claude/claude-sonnet-4-6`.

## Dependencies

- TASK_2026_110 — config schema with `routing` section
- TASK_2026_111 — resolver engine; spawn fallback chain

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md has no hardcoded provider names (claude, glm, opencode) in routing decisions
- [ ] Auto-pilot SKILL.md has no hardcoded model names in routing decisions
- [ ] Routing reads from config `routing` section to determine provider per task condition
- [ ] Supervisor passes `{ provider, tier }` to `spawn_worker`, not specific model names
- [ ] `codex` and `openai-codex` documented as valid provider options in the routing table
- [ ] Spawn fallback section delegates to resolver — no hardcoded fallback model string
- [ ] Existing routing behavior preserved when config matches current defaults (zai for balanced, anthropic for heavy, openai-opencode for simple)

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Config schema: from TASK_2026_110
- Resolver engine: from TASK_2026_111

## File Scope

- .claude/skills/auto-pilot/SKILL.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_110 or TASK_2026_111 — sequential dependency
- 🚫 Do NOT run in parallel with any task that modifies auto-pilot SKILL.md
- Suggested execution wave: after TASK_2026_110 and TASK_2026_111 are both COMPLETE
