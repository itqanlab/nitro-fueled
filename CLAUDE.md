# Nitro-Fueled

Reusable AI development orchestration package. Install into any project to get a full PM -> Architect -> Dev -> QA pipeline with autonomous worker sessions.

## What This Is

A reusable AI development orchestration package (proven across 55+ tasks completed autonomously). Includes agents, skills, commands, task tracking, and an auto-pilot loop.

## Project Structure
```
docs/                      # Design docs and architecture
.claude/
  agents/                  # 15 agent definitions (PM, Architect, Planner, Dev, QA, reviewers, etc.)
    planner.md             # Strategic planning agent (roadmap, task creation, backlog)
  skills/
    orchestration/         # Build Worker orchestration (PM->Architect->Dev->QA)
    auto-pilot/            # Supervisor skill (spawns/monitors workers)
  commands/                # /orchestrate, /plan, /auto-pilot, /review-*, /create-task
  anti-patterns.md         # Starter checklist
  review-lessons/          # Per-reviewer learned lessons (grows over time)
task-tracking/             # Task tracking folder structure
packages/                  # (TBD) Nx workspace packages
  cli/                     # npx nitro-fueled init|run|status
  scaffold/                # Template files copied during init
```

## Key Docs
- `docs/nitro-fueled-design.md` — Full design doc
- `docs/mcp-session-orchestrator-design.md` — MCP server for spawning/monitoring workers
- `docs/task-template-guide.md` — Task template usage and orchestration integration

## Dependencies
- Session Orchestrator MCP Server: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Claude Code CLI

## Current State
- .claude/ setup genericized and project-agnostic
- Supervisor architecture: Build Workers and Review Workers spawned/monitored by auto-pilot
- Planner agent: strategic planning layer between Product Owner and Supervisor (/plan command)
- Task states: CREATED -> IN_PROGRESS -> IMPLEMENTED -> IN_REVIEW -> COMPLETE (or FAILED/BLOCKED)
- Core vs project agent separation: core agents ship as-is, project agents generated at init based on tech stack
- Need to build CLI package

## Development Priority
1. ~~Genericize .claude/ files (remove project-specific references, make project-agnostic)~~ DONE
2. ~~Build task.md template~~ DONE
3. ~~Build auto-pilot skill/command (Supervisor architecture)~~ DONE
4. ~~Planner agent and /plan command~~ DONE
5. ~~Fix workspace agent setup~~ IN_PROGRESS
6. Dynamic agent/skill generation at init (tech stack detection)
7. Build CLI (init, run, status, create)
8. Test on a fresh project

## Conventions
- Git: conventional commits with scopes
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED
- Do NOT start git commit/push without explicit user instruction
