# Task: Add CONTENT Orchestration Flow (Blog, Email, Newsletter, Ad Copy)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

Add the **CONTENT** task type to the orchestration system. This flow handles blog articles, email campaigns, newsletters, and ad copy — non-coding content work.

**Pipeline:** `PM → Researcher (optional, for topic depth) → Content Writer → Style Reviewer`

**Review criteria:** tone, brand voice, audience fit, SEO (for blogs), call-to-action effectiveness, readability.

**Keyword detection:** "blog post", "article", "email campaign", "newsletter", "ad copy", "marketing email", "content piece", "copywriting"

### Changes

1. **strategies.md** — Add CONTENT strategy section with workflow diagram
2. **Orchestration SKILL.md** — Add CONTENT to Workflow Selection Matrix, pipeline routing, and keyword detection
3. **task-template.md** — Add `CONTENT` to Type enum
4. **agent-catalog.md** — Update capability matrix for Content Writer + PM in CONTENT flow
5. **checkpoints.md** — Add CONTENT row to checkpoint matrix

## Dependencies

- TASK_2026_106 — Universal lifecycle must be in place before adding new flows
- TASK_2026_107 — All artifact references must be generalized

## Acceptance Criteria

- [ ] CONTENT type added to task-template.md Type enum
- [ ] strategies.md has CONTENT workflow diagram with phase descriptions
- [ ] Orchestration SKILL.md routes CONTENT type to correct pipeline
- [ ] Keyword detection triggers CONTENT for blog/email/newsletter keywords
- [ ] checkpoints.md checkpoint matrix includes CONTENT row
- [ ] agent-catalog.md maps agents to CONTENT flow

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

- 🚫 Do NOT run in parallel with TASK_2026_099, TASK_2026_100, TASK_2026_102, TASK_2026_103, TASK_2026_104, TASK_2026_105 — overlapping files
- Suggested execution wave: Wave 3
