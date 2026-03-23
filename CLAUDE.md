# Nitro-Fueled

Reusable AI development orchestration package. Install into any project to get a full PM -> Architect -> Dev -> QA pipeline with autonomous worker sessions.

## What This Is

A reusable AI development orchestration package (proven across 55+ tasks completed autonomously). Includes agents, skills, commands, task tracking, and an auto-pilot loop.

## Project Structure
```
docs/                      # Design docs and architecture
.claude/
  agents/                  # 14 agent definitions (PM, Architect, Dev, QA, reviewers, etc.)
  skills/                  # Orchestration, auto-pilot, review skills
  commands/                # /orchestrate, /review-*, /auto-pilot
  anti-patterns.md         # Starter checklist
  review-lessons/          # Per-reviewer learned lessons (grows over time)
task-tracking/             # Task tracking folder structure
packages/                  # (TBD) Nx workspace packages
  cli/                     # npx nitro-fueled init|run|status
  scaffold/                # Template files copied during init
```

## Key Docs
- `docs/claude-orchestrate-package-design.md` — Full design doc
- `docs/mcp-session-orchestrator-design.md` — MCP server for spawning/monitoring workers
- `docs/task-template-guide.md` — Task template usage and orchestration integration

## Dependencies
- Session Orchestrator MCP Server: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Claude Code CLI

## Current State
- .claude/ setup genericized and project-agnostic
- Need to build CLI package
- Need to build auto-pilot skill

## Development Priority
1. ~~Genericize .claude/ files (remove project-specific references, make project-agnostic)~~ DONE
2. ~~Build task.md template~~ DONE
3. Build auto-pilot skill/command
4. Build CLI (init, run, status)
5. Test on a fresh project

## Conventions
- Git: conventional commits with scopes
- Do NOT start git commit/push without explicit user instruction
