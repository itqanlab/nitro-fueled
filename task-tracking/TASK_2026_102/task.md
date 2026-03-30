# Task: Add SOCIAL Orchestration Flow (Social Media Campaigns)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

Add the **SOCIAL** task type to the orchestration system. This flow handles multi-platform social media content — Twitter/X, LinkedIn, Instagram, etc.

**Pipeline:** `PM → Content Writer → UI/UX Designer (for visuals) → Style Reviewer`

**Review criteria:** platform character limits, hashtag strategy, visual specs per platform, posting schedule, engagement hooks, brand consistency across platforms.

**Keyword detection:** "social media", "twitter post", "linkedin post", "instagram", "social campaign", "social calendar", "thread", "carousel post"

### Changes

1. **strategies.md** — Add SOCIAL strategy section with workflow diagram
2. **Orchestration SKILL.md** — Add SOCIAL to Workflow Selection Matrix, pipeline routing, and keyword detection
3. **task-template.md** — Add `SOCIAL` to Type enum
4. **agent-catalog.md** — Update capability matrix for Content Writer + UI/UX Designer in SOCIAL flow
5. **checkpoints.md** — Add SOCIAL row to checkpoint matrix

## Dependencies

- TASK_2026_101 — CONTENT flow must land first (shared files, SOCIAL builds on similar patterns)
- TASK_2026_106 — Universal lifecycle must be in place before adding new flows

## Acceptance Criteria

- [ ] SOCIAL type added to task-template.md Type enum
- [ ] strategies.md has SOCIAL workflow diagram with phase descriptions
- [ ] Orchestration SKILL.md routes SOCIAL type to correct pipeline
- [ ] Keyword detection triggers SOCIAL for social media keywords
- [ ] checkpoints.md checkpoint matrix includes SOCIAL row
- [ ] agent-catalog.md maps agents to SOCIAL flow

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
- task-tracking/task-template.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_101, TASK_2026_103, TASK_2026_104, TASK_2026_105 — overlapping files
- Suggested execution wave: Wave 3, after TASK_2026_101
