# Nitro-Fueled — Reusable AI Development Orchestration Package

## Vision

Package the orchestration workflow into a reusable tool that can be installed into any project. User writes tasks, hits run, and the system handles the full PM -> Architect -> Dev -> QA pipeline autonomously.

## Architecture

### Nx Workspace (new repo)

Single Nx workspace containing everything:

```
nitro-fueled/
  packages/
    cli/                       # npx nitro-fueled init|run|status|create
    scaffold/                  # Template files copied during init

  scaffold/                    # (TBD) What gets copied into target projects
    .claude/
      agents/
        core/                  # Ship as-is (PM, Architect, Team-Leader, Planner, reviewers, etc.)
        project/               # Generated at init based on tech stack (frontend-dev, backend-dev, etc.)
      skills/
        orchestration/         # Build Worker orchestration (PM->Architect->Dev->QA)
        auto-pilot/            # Supervisor skill (spawns/monitors Build + Review workers)
        technical-content-writer/  # Content writing skill
        ui-ux-designer/        # Visual design skill
      commands/                # /orchestrate, /plan, /auto-pilot, /review-*, /create-task, etc.
      anti-patterns.md         # Starter checklist (generic, not project-specific)
      review-lessons/          # Empty structure — fills up from QA reviews
        review-general.md
        backend.md
        frontend.md
    task-tracking/             # Task tracking folder
      registry.md              # Auto-generated, tracks all tasks
```

### Agent Separation: Core vs Project

Agents are split into two categories:

- **Core agents** ship as-is with the package. They are project-agnostic and work across any codebase:
  - project-manager, software-architect, team-leader, planner
  - code-style-reviewer, code-logic-reviewer, visual-reviewer, senior-tester
  - researcher-expert, modernization-detector, devops-engineer
  - systems-developer, ui-ux-designer, technical-content-writer

- **Project agents** are generated at `init` time based on the detected tech stack:
  - frontend-developer (Angular, React, Vue, etc. — prompt tailored to detected framework)
  - backend-developer (Node.js, Python, Go, etc. — prompt tailored to detected runtime/framework)

This ensures developer agents have deep knowledge of the project's actual stack rather than generic instructions.

### MCP Server

- Lives in its own repo (existing `/Volumes/SanDiskSSD/mine/session-orchestrator/`)
- Referenced/linked from the Nx workspace, not duplicated
- No npm publishing needed — local path reference
- See `docs/mcp-session-orchestrator-design.md` for full design

## Task Structure

Tasks live inside `task-tracking/`, one folder per task:

```
task-tracking/
  registry.md              # Index of all tasks + status
  plan.md                  # Planner output: roadmap, phases, current focus
  TASK_2026_001/
    task.md                # Task definition (created by user or Planner)
    context.md             # PM output (scoped context)
    implementation-plan.md # Architect output
    tasks.md               # Team-leader breakdown
    completion-report.md   # Build Worker final report
    code-logic-review.md   # Review Worker output
    code-style-review.md
    code-security-review.md
  TASK_2026_002/
    task.md
    ...
```

### Task States

| State | Meaning |
|-------|---------|
| CREATED | Task defined, not started |
| IN_PROGRESS | Build Worker is implementing |
| IMPLEMENTED | Build Worker finished, ready for review |
| IN_REVIEW | Review Worker is reviewing |
| COMPLETE | Reviews passed, task done |
| FAILED | Worker failed, needs retry or manual intervention |
| BLOCKED | Waiting on dependency tasks |
| CANCELLED | Task abandoned |

**State machine:**
```
CREATED -> IN_PROGRESS -> IMPLEMENTED -> IN_REVIEW -> COMPLETE
                |                             |
                v                             v
              FAILED                        FAILED
```

### task.md Template

```markdown
# Task: [Title]

## Metadata

| Field      | Value  |
|------------|--------|
| Type       | [FEATURE/BUG/REFACTORING/DOCUMENTATION/DEVOPS/RESEARCH] |
| Priority   | [P0-Critical/P1-High/P2-Medium/P3-Low] |
| Complexity | [Simple/Medium/Complex] |

## Description
[What needs to be built/fixed/changed]

## Dependencies
- [Task IDs this depends on, if any]

## Acceptance Criteria
- [What "done" looks like]

## References
- [Files, docs, or links relevant to this task]
```

## CLI Commands

```bash
npx nitro-fueled init            # Scaffold .claude/ + task-tracking/ into current project
npx nitro-fueled create          # Interactive task creation -> writes task.md
npx nitro-fueled run             # Auto-pilot: Supervisor picks tasks, spawns workers, monitors, loops
npx nitro-fueled run TASK_001    # Run specific task
npx nitro-fueled status          # Show task statuses, active workers, costs
```

## Supervisor Architecture (Auto-Pilot)

The Supervisor is the orchestrator-of-orchestrators. It reads the task backlog, spawns workers, monitors health, and loops until the backlog is drained.

### Worker Types

| Worker | Spawned When | What It Does | Exit State |
|--------|-------------|--------------|------------|
| **Build Worker** | Task is CREATED | Runs /orchestrate: PM -> Architect -> Team-Leader -> Dev. Commits code. | IMPLEMENTED |
| **Review Worker** | Task is IMPLEMENTED | Runs code review (logic, style, security). Passes or fails. | COMPLETE or FAILED |

### Supervisor Loop

```
1. Read registry.md + task folders + plan.md -> build dependency graph
2. Consult plan.md "Current Focus" for Planner guidance on priorities
3. Find actionable tasks:
   - CREATED tasks with all deps COMPLETE -> spawn Build Worker
   - IMPLEMENTED tasks -> spawn Review Worker
4. Spawn worker via MCP session-orchestrator (iTerm2 tab)
5. Monitor every 10min:
   - Check worker health (healthy/high_context/stuck/finished)
   - Two-strike stuck detection: first stuck = warn, second = kill + retry
6. On worker complete:
   a. Verify state transition happened (CREATED->IMPLEMENTED or IMPLEMENTED->COMPLETE)
   b. If no transition, count as failure (retry up to limit)
   c. Kill worker if still running post-completion
7. Persist state to orchestrator-state.md (survives compaction)
8. Loop back to step 1
```

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Concurrency | 3 | Max simultaneous workers |
| Monitoring interval | 10 min | Time between health checks |
| Retry limit | 2 | Max retries for failed tasks (capped at 5) |

## Planner Agent

The Planner sits between the Product Owner and the Supervisor. It owns the product roadmap and advises the Supervisor on execution order.

### Responsibilities
- Product-level planning and roadmap management via `plan.md`
- Discussion-based task creation with codebase analysis
- Task sizing enforcement (each task must fit in a single worker session)
- Backlog prioritization and dependency management
- Supervisor consultation via plan.md "Current Focus" section
- Progress tracking and status reporting

### Modes (via /plan command)
- **Default**: Interactive planning session with the Product Owner
- **Status**: Refresh plan.md from registry, report progress
- **Reprioritize**: Reorder backlog based on new information

### How Planner Solves the PM Scoping Problem

The original PM agent burned 2M+ tokens scanning the codebase unboundedly. The Planner solves this by:
1. Operating at the **product level**, not task level — it creates well-scoped tasks
2. Each task gets a **scoped PM** inside the Build Worker that reads only task.md + README + project structure
3. The Planner's task sizing enforcement ensures each task is completable in a single worker session

## Main Session State Preservation

To survive compactions in long-running Supervisor sessions:

- **`task-tracking/orchestrator-state.md`** — written after every worker event:
  - Active workers (ID, task, status, cost)
  - Completed tasks this session
  - Next tasks in queue
  - Active configuration
  - After compaction, Supervisor re-reads this file to recover context

## What Gets Copied (init)

The package copies the proven orchestration setup into the target project:

### Core (copied as-is)
- Core agent definitions (PM, Architect, Team-Leader, Planner, reviewers, tester, etc.)
- All skills (orchestration, auto-pilot/Supervisor, technical-content-writer, ui-ux-designer)
- All commands (/orchestrate, /plan, /auto-pilot, /review-*, /create-task, /initialize-workspace, /project-status, /orchestrate-help)
- Anti-patterns checklist (genericized)
- Review-lessons structure (empty, learns per project)
- Task tracking folder structure

### Generated (at init time)
- Project-specific developer agents (frontend-developer, backend-developer) tailored to detected tech stack
- Tech stack detection reads package.json, requirements.txt, go.mod, Cargo.toml, etc.

## Resolved Design Decisions

1. **Project-specific vs generic anti-patterns**: Core anti-patterns ship with the package. Project-specific lessons accumulate in `review-lessons/` over time from QA reviews.

2. **Tech stack detection**: Yes — the `init` command detects the tech stack and generates project-specific developer agents with tailored prompts.

3. **MCP server dependency**: User needs iTerm2 + session-orchestrator MCP server running. The CLI `init` command will configure `.mcp.json` and verify the dependency.

4. **License model**: TBD — open source likely.
