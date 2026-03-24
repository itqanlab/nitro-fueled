# Project Plan

## Project Overview

claude-nitro-fueled is a reusable AI development orchestration package. Install into any project to get a full PM -> Architect -> Dev -> QA pipeline with autonomous worker sessions. Includes a Planner for strategic planning, a Supervisor for task execution, and dynamic agent generation for any tech stack.

## Phases

### Phase 1: Orchestration Engine
**Status**: COMPLETE
**Description**: Build the core orchestration engine — skills, agents, commands, task tracking, Supervisor loop, and Planner.

#### Milestones
- [x] Genericize .claude/ files
- [x] Build task template system
- [x] Build auto-pilot (now Supervisor) skill/command
- [x] Implement Supervisor architecture (Build/Review worker split, new states)
- [x] Build Planner agent and /plan command

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_001 | Build the task.md template system | COMPLETE | P1-High |
| TASK_2026_002 | Build auto-pilot skill/command | COMPLETE | P1-High |
| TASK_2026_003 | Supervisor Architecture | COMPLETE | P1-High |
| TASK_2026_004 | Planner Agent and /plan Command | COMPLETE | P1-High |

### Phase 2: Agent System
**Status**: IN PROGRESS
**Description**: Fix workspace agent setup, add systems-developer, and build dynamic agent/skill generation for any tech stack.

#### Milestones
- [ ] Systems-developer agent created and workspace agents genericized
- [ ] Dynamic agent generation system (AI stack detection, templates, /create-agent)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_005 | Fix Workspace Agent Setup | CREATED | P0-Critical |
| TASK_2026_006 | Dynamic Agent/Skill Generation | CREATED | P1-High |

### Phase 3: CLI Package
**Status**: NOT STARTED
**Description**: Build the npm CLI package (`npx claude-nitro-fueled`) with init, run, status, and create commands.

#### Milestones
- [ ] CLI scaffold with command parsing
- [ ] init command with scaffold + stack detection
- [ ] run command starts Supervisor
- [ ] status and create commands
- [ ] MCP server dependency handling

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_007 | Update CLAUDE.md and Design Doc | CREATED | P1-High |
| TASK_2026_008 | CLI Package Scaffold | CREATED | P1-High |
| TASK_2026_009 | CLI init Command | CREATED | P1-High |
| TASK_2026_010 | CLI run Command | CREATED | P1-High |
| TASK_2026_011 | CLI status Command | CREATED | P2-Medium |
| TASK_2026_012 | CLI create Command | CREATED | P2-Medium |
| TASK_2026_013 | MCP Server Dependency Handling | CREATED | P1-High |

### Phase 4: Validation
**Status**: NOT STARTED
**Description**: End-to-end test on a fresh project to validate the full pipeline.

#### Milestones
- [ ] Full pipeline works on a fresh project (init → plan → run → complete)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_014 | End-to-End Test Fresh Project | CREATED | P0-Critical |

## Current Focus

**Active Phase**: Phase 2 -- Agent System
**Active Milestone**: Systems-developer agent and workspace agent cleanup
**Next Priorities**:
1. TASK_2026_005 — Fix Workspace Agent Setup (P0-Critical, unblocked)
2. TASK_2026_007 — Update CLAUDE.md and Design Doc (P1-High, unblocked)
3. TASK_2026_006 — Dynamic Agent/Skill Generation (P1-High, depends on 005)

**Supervisor Guidance**: PROCEED
**Guidance Note**: Phase 2 tasks are ready. TASK_005 is the top priority (P0, unblocked). TASK_007 can run in parallel.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-24 | Package name: claude-nitro-fueled | Reflects both the Claude Code ecosystem and the project identity |
| 2026-03-24 | Supervisor replaces auto-pilot as main session name | Reflects flow coordinator role, not just autonomous execution |
| 2026-03-24 | Split workers into Build and Review | Reduces context pressure, prevents completion phase from being skipped |
| 2026-03-24 | Planner as separate agent from PM | Product-level planning vs task-level requirements — different scopes |
| 2026-03-24 | Core vs project agent separation | Core agents are universal, project agents generated per tech stack at init |
| 2026-03-24 | Systems-developer as core agent | Needed for orchestration-level work (specs, skills, agents, commands) |
| 2026-03-24 | Supervisor consultation via plan.md artifacts | Clean context separation — Supervisor reads plan.md, doesn't spawn Planner |

### Phase 5: Landing Experience
**Status**: COMPLETE
**Description**: Design and implement the Nitro-Fueled landing hero identity and interactive visual system.

#### Milestones
- [x] Replace generic hero background with Nitro-themed visual system
- [x] Preserve readability and premium composition
- [x] Keep static-file compatibility and reduced-motion behavior

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_018 | Nitro-Fueled Landing Hero Visual Redesign | COMPLETE | P1-High |

