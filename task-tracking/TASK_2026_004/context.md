# Context — TASK_2026_004

## User Intent

Create the Planner — a planning agent that sits between the Product Owner (user) and the Supervisor. The Planner owns the strategic plan, creates well-scoped tasks, manages the backlog, and advises the Supervisor on what to execute next.

## Strategy

**Type**: FEATURE
**Flow**: PM → Architect → Team-Leader → Developer → QA
**Complexity**: Complex

## Key Decisions (from Product Owner discussion)

- The Planner is a NEW agent, separate from the existing project-manager agent
- The existing project-manager writes requirements for individual tasks inside worker sessions
- The Planner manages the whole product: roadmap, task creation, backlog, prioritization
- Product Owner interacts via `/plan [what they want]` command
- Planner runs in its own session/context — knows product + codebase, not worker health
- Supervisor can consult Planner between worker completions
- Task creation becomes a discussion, not a form — Planner reads codebase, asks questions
- `/create-task` stays for programmatic/internal use, Planner handles Product Owner flow
- Plan artifact lives at `task-tracking/plan.md`
- Planner enforces task sizing — no task too large for worker context
