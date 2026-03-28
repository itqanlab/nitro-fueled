# Task: Add DESIGN Orchestration Flow (UI/UX, Wireframes, Brand Identity)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

Add the **DESIGN** task type to the orchestration system. This flow handles pure design work — UI/UX design, wireframes, prototypes, design systems, brand identity. Distinct from CREATIVE which is design + implementation; DESIGN produces design artifacts only.

**Pipeline:** `PM → UI/UX Designer → Style Reviewer`

**Review criteria:** accessibility, consistency with existing design system, responsive specs, color contrast, typography hierarchy, component reusability.

**Keyword detection:** "design system", "wireframe", "prototype", "brand identity", "UI design", "UX audit", "design tokens", "style guide", "mockup", "user flow"

**Disambiguation from CREATIVE:** CREATIVE = design + content + frontend implementation. DESIGN = design artifacts only (no code output). If the user says "design and build", route to CREATIVE. If they say "design" without implementation intent, route to DESIGN.

### Changes

1. **strategies.md** — Add DESIGN strategy section with workflow diagram, include disambiguation rules vs CREATIVE
2. **Orchestration SKILL.md** — Add DESIGN to Workflow Selection Matrix, pipeline routing, keyword detection, and disambiguation priority
3. **task-template.md** — Add `DESIGN` to Type enum
4. **agent-catalog.md** — Update capability matrix for UI/UX Designer in DESIGN flow
5. **checkpoints.md** — Add DESIGN row to checkpoint matrix

## Dependencies

- TASK_2026_101 — sequential file access (shared files)
- TASK_2026_106 — Universal lifecycle must be in place before adding new flows

## Acceptance Criteria

- [ ] DESIGN type added to task-template.md Type enum
- [ ] strategies.md has DESIGN workflow diagram with phase descriptions
- [ ] Orchestration SKILL.md routes DESIGN type to correct pipeline
- [ ] Keyword detection triggers DESIGN for design-only keywords
- [ ] DESIGN vs CREATIVE disambiguation documented and enforced in keyword priority
- [ ] checkpoints.md checkpoint matrix includes DESIGN row
- [ ] agent-catalog.md maps agents to DESIGN flow

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

- 🚫 Do NOT run in parallel with TASK_2026_101, TASK_2026_102, TASK_2026_104, TASK_2026_105 — overlapping files
- Suggested execution wave: Wave 3, after TASK_2026_102
