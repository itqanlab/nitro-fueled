# Task: Planner Agent and /plan Command

## Metadata

| Field      | Value     |
|------------|-----------|
| Type       | FEATURE   |
| Priority   | P1-High   |
| Complexity | Complex   |

## Description

Introduce the Planner — a planning agent that sits between the Product Owner (user) and the Supervisor. The Planner owns the strategic plan, creates well-scoped tasks, manages the backlog, and advises the Supervisor on what to execute next.

Currently there is no planning layer. The user fills in a form (`/create-task`) and the Supervisor processes whatever it finds. This leads to:
- Tasks that are too large for a single worker session (context overflow, dropped steps)
- No strategic roadmap — just a flat list of tasks
- No one checking if a task makes sense against the codebase before creating it
- No dynamic reprioritization as work progresses
- The Supervisor making planning decisions it shouldn't own

The Planner solves this by being the intelligent layer that understands both the product (what the user wants) and the codebase (what exists), and produces right-sized, well-ordered tasks.

**Planner responsibilities:**

1. **New project onboarding**: Product Owner describes an idea → Planner asks questions, researches tech options, proposes architecture/stack, produces a roadmap, creates initial tasks
2. **Task creation via discussion**: Product Owner says what they want → Planner reads codebase, asks clarifying questions, checks feasibility, breaks into right-sized tasks with dependencies and ordering. Replaces the form-based `/create-task` for Product Owner usage
3. **Plan management**: Maintains `task-tracking/plan.md` — the roadmap of phases, milestones, what's done, what's next, what's coming later
4. **Supervisor consultation**: Supervisor asks "what's next?" → Planner checks plan, checks registry states, advises on next action (spawn build worker, spawn review worker, reprioritize, etc.)
5. **Progress tracking**: Planner can assess plan progress — what percentage is done, what's remaining, any blockers that need Product Owner attention
6. **Task sizing enforcement**: Ensures no single task is too large for a worker session. If a requirement is complex, Planner breaks it into multiple tasks with proper dependencies

**Interaction model:**
- Product Owner runs `/plan [what they want]` — starts a conversation with the Planner
- Planner asks clarifying questions, reads codebase, proposes tasks
- Product Owner approves → Planner creates tasks in registry + task folders
- Supervisor picks up CREATED tasks and executes
- Supervisor can invoke Planner between worker completions to get updated guidance

**Key constraint:** The Planner runs in its own session/context. It knows about the product, codebase, and plan — but not about worker health, session management, or Supervisor internals. Clean separation.

## Dependencies

- TASK_2026_003 — Supervisor Architecture must be done first so the Planner knows the Supervisor's interface (states, consultation protocol)

## Acceptance Criteria

- [ ] Planner agent definition created in `.claude/agents/`
- [ ] `/plan` command created in `.claude/commands/`
- [ ] `task-tracking/plan.md` format defined (roadmap structure, phases, milestones)
- [ ] Planner can discuss requirements with Product Owner and ask clarifying questions
- [ ] Planner reads codebase to inform task scoping and feasibility
- [ ] Planner creates properly scoped tasks (right-sized for worker context)
- [ ] Planner creates tasks with correct dependencies and ordering
- [ ] Planner updates plan.md when tasks are created or completed
- [ ] Supervisor ↔ Planner consultation protocol defined (how Supervisor asks "what's next?")
- [ ] `/create-task` updated or replaced — Planner-driven creation for Product Owner, form-based kept for programmatic/internal use
- [ ] New project onboarding flow works: idea → questions → plan → tasks

## References

- Current PM agent: `.claude/agents/project-manager.md`
- Current /create-task command: `.claude/commands/create-task.md`
- Task template: `task-tracking/task-template.md`
- Supervisor SKILL.md (after TASK_2026_003): `.claude/skills/auto-pilot/SKILL.md`
- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`
