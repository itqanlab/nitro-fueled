# Task: Nitro Commit Traceability Standard

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |
| Model      | default     |
| Testing    | skip        |

## Description

Establish a **commit traceability standard** for all orchestrated work in nitro-fueled. Every commit made by a worker must include a structured footer with full context — enabling tracing by task, agent, phase, provider, model, session, retry status, complexity, and priority.

**Current format:**
```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**New format — structured traceability footer:**
```
<type>(<scope>): <short description>

[optional body]

Task: TASK_YYYY_NNN
Agent: nitro-<agent-name>
Phase: <phase>
Worker: <worker-type>
Session: SESSION_YYYY-MM-DD_HH-MM-SS
Provider: <provider>
Model: <model>
Retry: <attempt>/<max>
Complexity: <complexity>
Priority: <priority>
Generated-By: nitro-fueled v<version> (https://github.com/itqanlab/nitro-fueled)
```

### Footer Field Reference

| Field      | Required | Values | Purpose |
|------------|----------|--------|---------|
| Task       | Yes | `TASK_YYYY_NNN` | Which task this commit belongs to |
| Agent      | Yes | `nitro-backend-developer`, `nitro-frontend-developer`, `nitro-devops-engineer`, `nitro-systems-developer`, `nitro-team-leader`, `nitro-unit-tester`, `nitro-integration-tester`, `nitro-e2e-tester`, `nitro-review-lead`, `auto-pilot`, `orchestrator` | Which agent authored the code |
| Phase      | Yes | `implementation`, `review-fix`, `test-fix`, `review`, `test`, `completion` | Where in the pipeline |
| Worker     | Yes | `build-worker`, `fix-worker`, `review-worker`, `test-worker`, `completion-worker` | Worker type that spawned this agent |
| Session    | Yes | `SESSION_YYYY-MM-DD_HH-MM-SS` | Which auto-pilot session spawned this. For `/orchestrate` (no auto-pilot session), use `manual` |
| Provider   | Yes | `claude`, `glm`, `opencode` | Which AI provider ran this worker |
| Model      | Yes | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `glm-5`, `glm-4.7`, `openai/gpt-4.1-mini`, etc. | Exact model used |
| Retry      | Yes | `0/2`, `1/3`, etc. | Attempt number / max retries (0 = first attempt) |
| Complexity | Yes | `Simple`, `Medium`, `Complex` | Task complexity from task.md |
| Priority   | Yes | `P0-Critical`, `P1-High`, `P2-Medium`, `P3-Low` | Task priority from task.md |
| Generated-By | Yes | `nitro-fueled v<version> (<url>)` | Package attribution — version read from manifest.json or package.json at commit time |

### Rules

- All footer fields are **required** for commits made during orchestrated work (Build Workers, Fix Workers, Review Workers, Test Workers, Completion Workers)
- For commits made by the Supervisor itself (session archive, status updates), use `Agent: auto-pilot`, `Worker: auto-pilot`, `Phase: supervision`
- For commits made via `/orchestrate` (no auto-pilot session), use `Session: manual`
- For manual user commits outside orchestration, all footer fields are **optional**
- The `Co-Authored-By` line (if present) goes after the last footer field
- Footer fields must appear in the order listed above (Task first, Priority last)

### Traceability Queries

This standard enables powerful git log queries:

```bash
# All commits for a task
git log --grep="Task: TASK_2026_087"

# All commits by a specific agent
git log --grep="Agent: nitro-backend-developer"

# All commits from a session
git log --grep="Session: SESSION_2026-03-28"

# All review-fix commits (failure pattern analysis)
git log --grep="Phase: review-fix"

# All commits from GLM provider (cost analysis per provider)
git log --grep="Provider: glm"

# Quality comparison across models
git log --grep="Model: claude-opus-4-6"

# All retry commits (failure pattern analysis)
git log --grep="Retry: 1/"

# Commits from complex tasks (correlate with bugs)
git log --grep="Complexity: Complex"

# All critical priority work
git log --grep="Priority: P0-Critical"

# Combine: all GLM retries for complex tasks
git log --grep="Provider: glm" --grep="Retry: 1/" --grep="Complexity: Complex" --all-match
```

### What Needs Updating

1. **git-standards.md** — Update commit format spec, all examples, and add the footer field reference table
2. **Orchestration SKILL.md** — Worker instructions must pass task metadata to agents for footer inclusion. The orchestrator must make Task, Session, Provider, Model, Retry, Complexity, and Priority available to the agent at commit time.
3. **Auto-pilot SKILL.md** — Worker prompt templates (Build Worker, Review Worker, Fix Worker) must instruct workers to include the full footer. The Supervisor must pass all metadata fields to the worker prompt so the agent has the values.
4. **Agent definitions** (`nitro-*.md`) — Each agent that commits must reference the footer requirement and know its own Agent identity value.

## Dependencies

- None

## Acceptance Criteria

- [ ] git-standards.md commit format updated with full 11-field traceability footer
- [ ] Footer field reference table added to git-standards.md
- [ ] All commit examples in git-standards.md updated with the new footer
- [ ] Orchestration SKILL.md passes task metadata to agents for footer inclusion
- [ ] Auto-pilot SKILL.md worker prompt templates include instructions for the full footer
- [ ] Agent definition files that commit know their Agent identity value and reference the footer requirement
- [ ] Supervisor's own commits use `Agent: auto-pilot`, `Worker: auto-pilot`, `Phase: supervision`
- [ ] Manual/non-orchestrated commits documented as optional for footer fields
- [ ] `Generated-By` line includes nitro-fueled package version (read from manifest.json or package.json) and repo URL
- [ ] Traceability queries section added to git-standards.md as reference

## References

- Git standards: `.claude/skills/orchestration/references/git-standards.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Agent definitions: `.claude/agents/nitro-*.md`
- Checkpoints: `.claude/skills/orchestration/references/checkpoints.md`

## File Scope

- .claude/skills/orchestration/references/git-standards.md
- .claude/skills/orchestration/SKILL.md
- .claude/skills/auto-pilot/SKILL.md
- .claude/agents/nitro-backend-developer.md
- .claude/agents/nitro-frontend-developer.md
- .claude/agents/nitro-devops-engineer.md
- .claude/agents/nitro-systems-developer.md
- .claude/agents/nitro-team-leader.md
- .claude/agents/nitro-unit-tester.md
- .claude/agents/nitro-integration-tester.md
- .claude/agents/nitro-e2e-tester.md
- .claude/agents/nitro-review-lead.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_099 — both modify `.claude/skills/auto-pilot/SKILL.md` and `.claude/skills/orchestration/SKILL.md`
- Suggested execution wave: Wave 2, after TASK_2026_099 completes
