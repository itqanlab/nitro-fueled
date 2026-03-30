# Nitro-Fueled

Reusable AI development orchestration package. Install into any project to get a full PM -> Architect -> Dev -> QA pipeline with autonomous worker sessions.

## What This Is

An installable CLI toolkit (`npx @itqanlab/nitro-fueled init`) that sets up a fully customized AI orchestration pipeline in any project. It includes agents, skills, commands, task tracking, and an autonomous Supervisor loop proven across 55+ tasks.

**This project IS the library being tested on itself.** The `.claude/` directory here is the scaffold — it is always in sync with what `npx @itqanlab/nitro-fueled init` copies into a target project. Changes here ship as the next version of the package.

## Project Structure
```
docs/                      # Design docs and architecture
.claude/
  agents/                  # 22 nitro-* agent definitions (planner, architect, team-leader, reviewers, testers, etc.)
    nitro-planner.md       # Strategic planning agent (roadmap, task creation, backlog)
  skills/
    orchestration/         # Build Worker orchestration (PM->Architect->Dev->QA)
    auto-pilot/            # Supervisor skill (spawns/monitors workers)
    technical-content-writer/  # Content writing skill
    ui-ux-designer/        # Visual design skill
  commands/                # /nitro-orchestrate, /nitro-plan, /nitro-auto-pilot, /nitro-review-*, /nitro-create-task, /nitro-initialize-workspace, /nitro-project-status, /nitro-orchestrate-help
  anti-patterns.md         # Starter checklist
  review-lessons/          # Per-reviewer learned lessons (grows over time)
task-tracking/             # Task tracking folder structure
packages/                  # Shared packages (mcp-cortex)
apps/                      # Nx workspace apps (cli, dashboard, dashboard-api, docs)
libs/                      # Shared libraries
```

## Key Docs
- `docs/nitro-fueled-design.md` — Full design doc
- `docs/mcp-session-orchestrator-design.md` — MCP cortex design (worker management + task DB)
- `docs/task-template-guide.md` — Task template usage and orchestration integration

## Dependencies
- nitro-cortex MCP Server: `packages/mcp-cortex/` (worker management + task DB)
- Claude Code CLI

## Current State
- CLI package built (`apps/cli/`) — `npx @itqanlab/nitro-fueled init|run|status|create` operational
- .claude/ is the scaffold — changes here sync to what `init` installs in target projects
- Supervisor architecture: Build Workers and Review Workers spawned/monitored by auto-pilot
- Planner agent: strategic planning layer between Product Owner and Supervisor (/plan command)
- Task states: CREATED -> IN_PROGRESS -> IMPLEMENTED -> IN_REVIEW -> COMPLETE (or FAILED/BLOCKED)
- All agents renamed to `nitro-*` prefix (Phase 12 — CLI Maturity in progress)

## Development Priority
1. ~~Genericize .claude/ files (remove project-specific references, make project-agnostic)~~ DONE
2. ~~Build task.md template~~ DONE
3. ~~Build auto-pilot skill/command (Supervisor architecture)~~ DONE
4. ~~Planner agent and /plan command~~ DONE
5. ~~Fix workspace agent setup~~ DONE
6. ~~Build CLI (init, run, status, create)~~ DONE
7. CLI Maturity — nitro-* rename, scaffold sync, docs update — IN_PROGRESS (Phase 12)
8. Test on a fresh project

## Task Status Queries
- When asked about project status, remaining tasks, what's next, or any task-related question:
  1. **Run `npx nitro-fueled status`** first — this rebuilds `task-tracking/registry.md` from all status files on disk
  2. **Then read `task-tracking/registry.md` ONLY** — do NOT read individual `task.md` files
- The registry contains all task IDs, statuses, types, and descriptions — that is sufficient for status queries.

## Conventions
- Git: conventional commits with scopes
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED
- Agent naming: all agents use the `nitro-` prefix (e.g., `nitro-planner`, `nitro-software-architect`). This prefix scopes agents to the nitro-fueled namespace so they do not conflict with project-specific agents in target codebases.
- Do NOT start git commit/push without explicit user instruction
