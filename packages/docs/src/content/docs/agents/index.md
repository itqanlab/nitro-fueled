---
title: Agent Reference
description: All nitro-* agents included in the Nitro-Fueled system.
---

Nitro-Fueled ships 22 specialist agents, all prefixed with `nitro-` to avoid naming conflicts with project-specific agents in your codebase. Core agents ship as-is and are refreshed on `nitro-fueled update`. Project-generated agents (e.g., `frontend-developer.md`, `backend-developer.md` without the `nitro-` prefix) are created at `init` time and are never overwritten.

---

## Planning Agents

### `nitro-planner`

**Role:** Strategic planning partner between the Product Owner and the Supervisor.

**Responsibilities:**
- Maintains `task-tracking/plan.md` — phases, milestones, current focus
- Discussion-based task creation with codebase analysis
- Task sizing enforcement (catches oversized tasks before they enter the queue)
- Backlog prioritization and dependency management
- Provides the "Supervisor Guidance" field the Supervisor reads for queue ordering

**Inputs:** Product Owner conversation, `task-tracking/registry.md`, codebase files

**Outputs:** `task-tracking/plan.md`, `task-tracking/TASK_YYYY_NNN/task.md` files, `status` files

**Invoked via:** `/plan`

---

### `nitro-project-manager`

**Role:** Task-level requirements specialist inside Build Worker sessions.

**Responsibilities:**
- Produces `task-description.md` — formal requirements with user stories, acceptance criteria, risk assessment, and stakeholder analysis
- Scopes work based on codebase investigation (reads similar implementations before writing requirements)
- Validates requirements against SMART criteria and BDD format

**Inputs:** `task.md`, codebase source files, similar feature implementations

**Outputs:** `task-tracking/TASK_YYYY_NNN/task-description.md`

**Invoked by:** Orchestrator (Phase 1 of Build Worker) for `FEATURE`, `DOCUMENTATION`, and `DEVOPS` tasks

---

### `nitro-software-architect`

**Role:** Evidence-based system designer.

**Responsibilities:**
- Produces `implementation-plan.md` — component specifications with codebase evidence citations
- Investigates existing patterns before proposing any new ones (Glob → Read → verify)
- Never proposes APIs or classes without verifying they exist in the codebase
- Recommends developer type and estimates complexity for the Team-Leader

**Inputs:** `task-description.md`, codebase source files, library CLAUDE.md files

**Outputs:** `task-tracking/TASK_YYYY_NNN/implementation-plan.md`

**Invoked by:** Orchestrator (Phase 2) for `FEATURE`, `REFACTORING`, and `DEVOPS` tasks

---

## Orchestration Agents

### `nitro-team-leader`

**Role:** Task decomposition and batch execution coordinator.

**Responsibilities:**
- Decomposes `implementation-plan.md` into atomic, batched tasks (3–5 per batch)
- Validates the implementation plan for gaps and race conditions before decomposing
- Assigns batches to the correct developer type
- Owns all git commits — developers write code, the Team-Leader commits it
- Invokes `nitro-code-logic-reviewer` as a gate before each commit

**Inputs:** `implementation-plan.md`, `task-description.md`

**Outputs:** `task-tracking/TASK_YYYY_NNN/tasks.md`, git commits

**Invoked by:** Orchestrator (Phase 3) for `FEATURE`, `BUGFIX`, `REFACTORING`, and `DEVOPS` tasks

---

## Development Agents

### `nitro-frontend-developer`

**Role:** UI component and client-side logic implementation.

Implements batches assigned by the Team-Leader. Focuses on components, state management, styling, and accessibility. Does not create git commits.

---

### `nitro-backend-developer`

**Role:** Server-side services, data access layer, and API handler implementation.

Implements batches assigned by the Team-Leader. Focuses on repositories, services, controllers, and IPC handlers. Does not create git commits.

---

### `nitro-systems-developer`

**Role:** Core and infrastructure developer.

Implements orchestration system files, agent definitions, skill files, command files, and Markdown specifications. Used for tasks that modify the Nitro-Fueled system itself.

---

### `nitro-devops-engineer`

**Role:** CI/CD pipelines, build infrastructure, packaging, and deployment automation.

Implements infrastructure-as-code, build scripts, Docker configurations, and deployment workflows for `DEVOPS` type tasks.

---

## Quality Assurance Agents

### `nitro-review-lead`

**Role:** QA orchestrator inside Review Worker sessions.

Does not review code itself. Spawns three parallel reviewer sub-workers (logic, style, security) via MCP, collects their results, applies fixes directly, and writes the task to `COMPLETE`.

**Invoked when:** Task status is `IMPLEMENTED`

---

### `nitro-test-lead`

**Role:** Test orchestration inside Review Worker sessions.

Detects the test framework, spawns parallel test-writer sub-workers via MCP, executes the test suite after writers finish, and writes `test-report.md`.

---

### `nitro-code-style-reviewer`

**Role:** Coding standards and pattern enforcement.

Reviews for naming conventions, code organization, dead code, commented-out blocks, and deviation from established patterns. The "skeptical senior engineer" persona — looks for problems, not approvals.

---

### `nitro-code-logic-reviewer`

**Role:** Business logic correctness and completeness verification.

Checks for stubs, placeholders, TODOs, empty method bodies, hardcoded mock data, and missing error handling. The "paranoid production guardian" — assumes every line will fail.

---

### `nitro-code-security-reviewer`

**Role:** OWASP pattern matching and vulnerability detection.

Checklist-driven review covering input validation, SQL injection, XSS, secret exposure, authentication flaws, and insecure dependencies.

---

### `nitro-senior-tester`

**Role:** Comprehensive test writing and quality assurance.

Writes unit tests, integration tests, and edge case coverage for completed implementation batches.

---

### `nitro-unit-tester`

**Role:** Unit test writer sub-worker.

Spawned by `nitro-test-lead` to write unit tests in parallel with other test writers.

---

### `nitro-integration-tester`

**Role:** Integration test writer sub-worker.

Spawned by `nitro-test-lead` to write integration tests in parallel.

---

### `nitro-e2e-tester`

**Role:** End-to-end test writer sub-worker.

Spawned by `nitro-test-lead` to write end-to-end tests in parallel.

---

### `nitro-visual-reviewer`

**Role:** Visual and UI consistency reviewer.

Reviews visual implementations for design system compliance, responsive behavior, and accessibility.

---

## Research Agents

### `nitro-researcher-expert`

**Role:** Deep technical analysis and strategic insight synthesis.

Researches technology choices, API behaviors, architectural patterns, and external documentation. Produces research summaries and technology comparison matrices that inform Architect decisions.

**Invoked by:** Orchestrator for `RESEARCH` tasks and as an optional Phase 1.5 step before Architecture for complex `FEATURE` tasks.

---

### `nitro-modernization-detector`

**Role:** Technology modernization opportunity detection.

Analyzes the codebase for outdated dependencies, deprecated patterns, security vulnerabilities in libraries, and migration opportunities. Produces a modernization report with prioritized recommendations.

---

## Creative Agents

### `nitro-ui-ux-designer`

**Role:** Visual design system creation and asset generation.

Discovers brand aesthetics, builds design systems with tokens (colors, typography, spacing), generates design specifications, and produces developer handoffs. Invoked for `CREATIVE` type tasks before the Content Writer and Frontend Developer.

---

### `nitro-technical-content-writer`

**Role:** Marketing content, documentation, blog posts, landing pages, and video scripts.

Mines the codebase for technically accurate content claims. Never uses generic marketing copy — all claims are backed by code evidence from the actual implementation.

---

## Agent Roster Summary

| Agent | Category | Invoked By |
|-------|---------|-----------|
| `nitro-planner` | Planning | `/plan` command |
| `nitro-project-manager` | Planning | Orchestrator (FEATURE, DEVOPS) |
| `nitro-software-architect` | Planning | Orchestrator (FEATURE, REFACTORING, DEVOPS) |
| `nitro-team-leader` | Orchestration | Orchestrator (all implementation types) |
| `nitro-frontend-developer` | Development | Team-Leader |
| `nitro-backend-developer` | Development | Team-Leader |
| `nitro-systems-developer` | Development | Team-Leader |
| `nitro-devops-engineer` | Development | Team-Leader (DEVOPS) |
| `nitro-review-lead` | QA | Review Worker |
| `nitro-test-lead` | QA | Review Worker |
| `nitro-code-style-reviewer` | QA | Review Lead (sub-worker) |
| `nitro-code-logic-reviewer` | QA | Review Lead (sub-worker) + Team-Leader gate |
| `nitro-code-security-reviewer` | QA | Review Lead (sub-worker) |
| `nitro-senior-tester` | QA | Test Lead (sub-worker) |
| `nitro-unit-tester` | QA | Test Lead (sub-worker) |
| `nitro-integration-tester` | QA | Test Lead (sub-worker) |
| `nitro-e2e-tester` | QA | Test Lead (sub-worker) |
| `nitro-visual-reviewer` | QA | Review Lead (sub-worker) |
| `nitro-researcher-expert` | Research | Orchestrator (RESEARCH tasks) |
| `nitro-modernization-detector` | Research | Direct invocation |
| `nitro-ui-ux-designer` | Creative | Orchestrator (CREATIVE tasks) |
| `nitro-technical-content-writer` | Creative | Orchestrator (CREATIVE tasks) |

---

## See Also

- [Core Concepts](../concepts/) — How agents fit into the worker and Supervisor architecture
- [Task Format](../task-format/) — How the `Type` field determines which agents are invoked
- [Commands Reference](../commands/) — `/plan`, `/orchestrate`, and other agent-triggering commands
