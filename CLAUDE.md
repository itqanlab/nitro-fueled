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

## Task & Project Queries — ALWAYS Use Cortex MCP
- **NEVER parse filesystem or bash-loop over status files.** The cortex MCP server (`packages/mcp-cortex/`) has all task, session, worker, and event data indexed in SQLite.
- For ANY project data query (task counts, status breakdown, session info, worker stats, events, etc.), use the appropriate cortex MCP tool:
  - `query_tasks` / `get_tasks` — task listings, filtering, counts, status grouping
  - `list_sessions` / `get_session` — session data
  - `list_workers` / `get_worker_stats` — worker data
  - `query_events` — event logs
  - `get_task_context` / `get_task_trace` — deep task info
  - `get_model_performance` / `get_provider_stats` — model and provider analytics
- This is **faster and cheaper** than filesystem parsing. One MCP call vs dozens of bash commands.
- For task creation: use `get_next_task_id` to get the next available ID — do NOT scan folders with `ls | grep | sort | tail`
- Only fall back to filesystem reads if cortex MCP is unavailable (tool not in session).

## Conventions
- Git: conventional commits with scopes
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED
- Agent naming: all agents use the `nitro-` prefix (e.g., `nitro-planner`, `nitro-software-architect`). This prefix scopes agents to the nitro-fueled namespace so they do not conflict with project-specific agents in target codebases.
- Do NOT start git commit/push without explicit user instruction

## Commit Footer
- Do NOT use `Co-Authored-By: Claude ...` in commits. Use this footer instead:
  ```
  Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
  ```
- For orchestrated commits, the full metadata block (Task, Agent, Phase, etc.) is defined in the orchestration skill — follow that format.
- For interactive commits (user asks you to commit directly), end the commit message with:
  ```
  Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
  ```
