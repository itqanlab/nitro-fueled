# Task: Write Full Documentation Content

## Metadata

| Field      | Value         |
|------------|---------------|
| Type       | DOCUMENTATION |
| Priority   | P1-High       |
| Complexity | Complex       |

## Description

Write all documentation content for the Astro Starlight docs site. Replace the stub `.md` files created in TASK_2026_055 with complete, high-quality documentation. Content should be written in Markdown/MDX and leverage Starlight's built-in components (callouts, card grids, tabs, code blocks with `expressive-code`).

The existing design docs (`docs/nitro-fueled-design.md`, `docs/task-template-guide.md`, `docs/mcp-session-orchestrator-design.md`) and the current `docs/index.html` are the primary source of truth for content. This task is about restructuring, rewriting, and expanding that content into proper user-facing documentation.

Write for two audiences:
- **New users** who have never seen Nitro-Fueled (getting started, concepts)
- **Existing users** looking up reference info (commands, agents, configuration)

### Pages to Write

#### Getting Started

**`getting-started/index.md`** — Overview + Prerequisites
- What is Nitro-Fueled (1 paragraph)
- What you'll need: Claude Code CLI, iTerm2 (macOS), session-orchestrator MCP server, Node.js 18+
- Links to installation page

**`getting-started/installation.md`** — Installation Guide
- For a new project (step-by-step with code blocks)
- For an existing project (step-by-step)
- What `nitro-fueled init` does under the hood (what gets created)
- Tech stack detection: what files are read, what gets generated
- Verifying the install (`nitro-fueled status`)
- Troubleshooting: MCP not found, iTerm2 missing, permission errors

**`getting-started/first-run.md`** — Your First Task
- End-to-end walkthrough: write a task → run auto-pilot → see it execute → check results
- Sample task.md for a simple feature
- What to expect: worker spawning in iTerm2, state transitions, completion report

#### Core Concepts

**`concepts/index.md`** — The Big Picture
- How the pieces fit together: Product Owner → Planner → Supervisor → Workers → Agents
- Architecture diagram (ASCII or Mermaid)
- Philosophy: each role has defined scope, explicit handoffs, no free-form AI

**`concepts/tasks.md`** — Tasks and the Registry
- What a task is
- Task states: CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE
- State machine with transitions
- The registry (registry.md) — what it tracks, how the Supervisor reads it
- plan.md — the Planner's roadmap and how it guides the Supervisor

**`concepts/workers.md`** — Autonomous Workers
- What a worker is (isolated Claude Code session in iTerm2 via MCP)
- Three worker types: Build Worker, Review Worker, Cleanup Worker
- What each worker does, what state transitions it owns
- Worker health states: healthy, high_context, stuck, finished
- Two-strike stuck detection

**`concepts/supervisor.md`** — The Supervisor (Auto-Pilot)
- Role of the Supervisor
- The 9-step control loop (numbered, with descriptions)
- Pre-flight validation: what it checks before spawning
- Dependency graph: how task dependencies are resolved
- Concurrency: default 3, configurable
- Recovery: what happens when a worker dies
- Session state persistence (orchestrator-state.md)
- Stop conditions

#### Task Format

**`task-format/index.md`** — Full task.md Reference
- Field-by-field breakdown (Type, Priority, Complexity, Description, Dependencies, Acceptance Criteria, References)
- Each field: what it is, who consumes it, impact on behavior
- Task Types and their agent pipelines (the full workflow matrix table)
- Priority levels: P0-Critical through P3-Low and how auto-pilot uses them
- Good task vs bad task examples (side by side)
- Full annotated example for each task type (FEATURE, BUGFIX, REFACTORING, DEVOPS, RESEARCH, DOCUMENTATION, CREATIVE)
- Using `/create-task` for guided creation

#### Commands

**`commands/index.md`** — Commands Reference
Cover all slash commands with: purpose, when to use, arguments, example output.

Commands to document:
- `/plan` — Strategic planning session with the Planner agent
- `/create-task` — Guided task creation
- `/orchestrate [TASK_ID]` — Run a single task through the full pipeline
- `/auto-pilot` — Start the Supervisor loop (full backlog processing)
- `/run [TASK_ID]` — Unified run: auto-pilot or single task
- `/project-status` — Project health report (tasks by state, blockers, costs)
- `/review-code` — Trigger code review on current task
- `/review-logic` — Logic-only review
- `/review-security` — Security-only review
- `/retrospective` — Post-session analysis and learning loop
- `/initialize-workspace` — Generate CLAUDE.md and workspace docs

Also document the CLI commands: `npx nitro-fueled init|run|status|create`

#### Agents

**`agents/index.md`** — Agent Roster
For each of the 16 agents, document:
- Name, category, role
- Primary responsibilities
- Inputs and outputs
- When it's invoked
- Key behaviors / what makes it different from a generic LLM call

Agents to document (organized by category):
- **Planning**: Planner, Project Manager, Software Architect
- **Orchestration**: Team Leader
- **Development**: Frontend Developer, Backend Developer, Systems Developer, DevOps Engineer
- **Quality Assurance**: Review Lead, Code Style Reviewer, Code Logic Reviewer, Code Security Reviewer, Senior Tester
- **Research & Design**: Researcher Expert, Modernization Detector
- **Creative**: UI/UX Designer, Technical Content Writer

#### Auto-Pilot Configuration

**`auto-pilot/index.md`** — Auto-Pilot Reference
- Configuration parameters table: concurrency (default 3, max 5), monitoring interval (default 5 min), retry limit (default 2, max 5)
- How to change configuration (where config lives)
- Pre-flight validation: full list of checks performed
- Dependency graph: how to express task dependencies, circular dep detection
- Worker health monitoring: what "stuck" means, how two-strike works
- File overlap detection: how it prevents conflicts
- Stop conditions: when auto-pilot exits cleanly vs with errors
- The orchestrator-state.md file: what it contains, how recovery works

#### Examples

**`examples/new-project.md`** — Example: New React + Node.js Project
Walk through:
1. Project bootstrap
2. `nitro-fueled init` — what gets detected, what gets generated
3. Writing 3 tasks for the initial sprint (feature, devops, docs)
4. Running auto-pilot and watching it execute
5. Reviewing the output

**`examples/existing-project.md`** — Example: Adding Nitro-Fueled to an Existing Project
Walk through:
1. Existing project context (e.g., a Python/FastAPI backend)
2. `nitro-fueled init` — stack detection, generated backend-developer agent
3. Writing a bugfix task for a real-world scenario
4. Single-task run with `/orchestrate`
5. Reading the completion report

### Writing Guidelines

- Use Starlight callouts (:::note, :::tip, :::caution, :::danger) for important information
- Use code blocks with language tags for all code/config snippets
- Use Starlight's `<Card>` and `<CardGrid>` components for feature lists
- Use Starlight's `<Steps>` component for numbered procedures
- Use Mermaid diagrams for state machines and architecture (Starlight supports them)
- Keep each page focused — if a page exceeds ~1500 words, consider splitting
- Every page should have a clear "Next steps" or "See also" section at the bottom

## Dependencies

- TASK_2026_055 (stub pages and site scaffold must exist)
- TASK_2026_056 (landing page not blocking, but good to have for cross-linking)

## Acceptance Criteria

- [ ] All stub pages replaced with complete, useful content
- [ ] Getting Started section lets a new user install and run their first task without outside help
- [ ] Task Format reference covers all fields with examples for each task type
- [ ] Commands reference covers all 10+ slash commands + CLI commands
- [ ] All 16 agents documented with role, inputs, outputs
- [ ] Auto-Pilot configuration page covers all parameters and recovery behavior
- [ ] Both example walkthroughs are complete end-to-end (not just outlines)
- [ ] All pages build with no Astro/MDX errors
- [ ] Cross-links between pages are accurate
- [ ] No "TODO" or placeholder content in any page

## References

- Design doc (primary content source): `docs/nitro-fueled-design.md`
- Task template guide: `docs/task-template-guide.md`
- MCP server design: `docs/mcp-session-orchestrator-design.md`
- Current overview page (sections 1-10): `docs/index.html`
- Agent definitions: `.claude/agents/`
- Skills: `.claude/skills/`
- Commands: `.claude/commands/`
- Astro Starlight component docs: https://starlight.astro.build/components/
