# Task: Add OPS Orchestration Flow (Project Setup, CI/CD, Infrastructure)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P2-Medium |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

Add the **OPS** task type to the orchestration system. This flow handles operational work — project setup, workspace configuration, CI/CD pipelines, deployment, monitoring setup. Distinct from DEVOPS which is infrastructure coding with full QA; OPS is lighter-weight operational configuration.

**Pipeline:** `PM → DevOps Engineer → QA`

**Review criteria:** security, reliability, idempotency, rollback capability, secret management.

**Keyword detection:** "setup project", "configure CI", "deployment pipeline", "monitoring setup", "infrastructure", "environment setup", "docker setup", "kubernetes config", "terraform"

**Disambiguation from DEVOPS:** DEVOPS = infrastructure code that needs architecture review (PM → Architect → DevOps → QA). OPS = straightforward operational setup that doesn't need architecture (PM → DevOps → QA). If the task involves novel infrastructure design, route to DEVOPS. If it's configuration/setup of known patterns, route to OPS.

### Changes

1. **strategies.md** — Add OPS strategy section with workflow diagram, include disambiguation rules vs DEVOPS
2. **Orchestration SKILL.md** — Add OPS to Workflow Selection Matrix, pipeline routing, keyword detection, and disambiguation priority
3. **task-template.md** — Add `OPS` to Type enum
4. **agent-catalog.md** — Update capability matrix for DevOps Engineer in OPS flow
5. **checkpoints.md** — Add OPS row to checkpoint matrix

## Dependencies

- TASK_2026_101 — sequential file access (shared files)
- TASK_2026_106 — Universal lifecycle must be in place before adding new flows

## Acceptance Criteria

- [ ] OPS type added to task-template.md Type enum
- [ ] strategies.md has OPS workflow diagram with phase descriptions
- [ ] Orchestration SKILL.md routes OPS type to correct pipeline
- [ ] Keyword detection triggers OPS for operational keywords
- [ ] OPS vs DEVOPS disambiguation documented and enforced in keyword priority
- [ ] checkpoints.md checkpoint matrix includes OPS row
- [ ] agent-catalog.md maps agents to OPS flow

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

- 🚫 Do NOT run in parallel with TASK_2026_101, TASK_2026_102, TASK_2026_103, TASK_2026_104 — overlapping files
- Suggested execution wave: Wave 3, after TASK_2026_104
