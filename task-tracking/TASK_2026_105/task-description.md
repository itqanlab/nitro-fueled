# Task Description — TASK_2026_105

## Task Summary

Add the **OPS** task type to the orchestration system. This new workflow type handles operational work — project setup, workspace configuration, CI/CD pipelines, deployment, monitoring setup — that is distinct from DEVOPS (which requires full architectural review).

## Problem Statement

The current orchestration system has a DEVOPS strategy for infrastructure work, but it is too heavyweight for straightforward operational configuration. Many operational tasks (CI/CD setup, docker configuration, environment setup) don't require an architect phase — they follow known patterns and just need a DevOps engineer to implement with PM guidance, followed by QA.

## Requirements

### 1. OPS Task Type Definition
- Pipeline: `PM → DevOps Engineer → QA`
- Lighter than DEVOPS — no Architect phase required
- Target: operational configuration of known patterns (not novel infrastructure design)

### 2. Keyword Detection
The OPS type should be triggered by:
- "setup project", "configure CI", "deployment pipeline"
- "monitoring setup", "infrastructure", "environment setup"
- "docker setup", "kubernetes config", "terraform"

### 3. DEVOPS vs OPS Disambiguation
- **DEVOPS** = infrastructure code that needs architectural review (`PM → Architect → DevOps → QA`)
- **OPS** = straightforward operational setup that follows known patterns (`PM → DevOps → QA`)
- If the task involves novel infrastructure design → route to DEVOPS
- If it's configuration/setup of known patterns → route to OPS

### 4. Review Criteria for OPS
- Security (secret management, permissions)
- Reliability (idempotency, rollback capability)
- Configuration correctness

## Acceptance Criteria

- [ ] OPS type added to task-template.md Type enum
- [ ] strategies.md has OPS workflow diagram with phase descriptions and DEVOPS disambiguation
- [ ] Orchestration SKILL.md routes OPS type to correct pipeline
- [ ] Keyword detection triggers OPS for operational keywords
- [ ] OPS vs DEVOPS disambiguation documented in keyword priority
- [ ] checkpoints.md checkpoint matrix includes OPS row
- [ ] agent-catalog.md maps agents to OPS flow

## Affected Files

1. `.claude/skills/orchestration/references/strategies.md`
2. `.claude/skills/orchestration/SKILL.md`
3. `.claude/skills/orchestration/references/agent-catalog.md`
4. `.claude/skills/orchestration/references/checkpoints.md`
5. `task-tracking/task-template.md`
