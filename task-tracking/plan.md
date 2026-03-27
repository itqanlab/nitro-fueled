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
**Status**: COMPLETE
**Description**: Fix workspace agent setup, add systems-developer, and build dynamic agent/skill generation for any tech stack.

#### Milestones
- [x] Systems-developer agent created and workspace agents genericized
- [x] Stack detection registry, developer template, /create-agent, /create-skill commands

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_005 | Fix Workspace Agent Setup | COMPLETE | P0-Critical |
| TASK_2026_006 | Dynamic Agent/Skill Generation | CANCELLED | P1-High |
| TASK_2026_015 | Stack Detection Registry + Developer Template | COMPLETE | P1-High |
| TASK_2026_016 | /create-agent Command + Catalog Integration | COMPLETE | P1-High |
| TASK_2026_017 | /create-skill Command | COMPLETE | P1-High |

### Phase 3: CLI Package
**Status**: COMPLETE
**Description**: Build the npm CLI package (`npx nitro-fueled`) with init, run, status, and create commands.

#### Milestones
- [x] CLI scaffold with command parsing
- [x] init command with scaffold + stack detection
- [x] run command starts Supervisor
- [x] status and create commands
- [x] MCP server dependency handling
- [x] Documentation updated

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_007 | Update CLAUDE.md and Design Doc | COMPLETE | P1-High |
| TASK_2026_008 | CLI Package Scaffold | COMPLETE | P1-High |
| TASK_2026_009 | CLI init Command | COMPLETE | P1-High |
| TASK_2026_010 | CLI run Command | COMPLETE | P1-High |
| TASK_2026_011 | CLI status Command | COMPLETE | P2-Medium |
| TASK_2026_012 | CLI create Command | COMPLETE | P2-Medium |
| TASK_2026_013 | MCP Server Dependency Handling | COMPLETE | P1-High |

### Phase 4: Validation
**Status**: NOT STARTED
**Description**: End-to-end test on a fresh project to validate the full pipeline.

#### Milestones
- [ ] Full pipeline works on a fresh project (init -> plan -> run -> complete)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_014 | End-to-End Test Fresh Project | CREATED | P0-Critical |

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

### Phase 6: Token Tracking & Model Routing
**Status**: NOT STARTED
**Description**: Fix token/cost tracking for print-mode workers, add per-task model selection, and build smart provider routing.

#### Milestones
- [ ] Print mode token/cost tracking fixed
- [ ] Per-task model selection in task metadata
- [ ] Smart provider and model routing system

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_019 | Fix Print Mode Token/Cost Tracking | CREATED | P1-High |
| TASK_2026_020 | Per-Task Model Selection | CREATED | P2-Medium |
| TASK_2026_021 | Smart Provider & Model Routing | CREATED | P1-High |

### Phase 7: Real-Time Dashboard
**Status**: NOT STARTED
**Description**: Build a real-time web dashboard for monitoring task progress, active workers, and cost tracking.

#### Milestones
- [ ] Dashboard data service with REST API + WebSocket
- [ ] React web client with task board and live workers
- [ ] CLI command and service integration

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_022 | Dashboard Data Service | IMPLEMENTED | P1-High |
| TASK_2026_023 | Dashboard Web Client | IMPLEMENTED | P1-High |
| TASK_2026_024 | Dashboard CLI Command + Service Integration | COMPLETE | P2-Medium |

### Phase 8: Orchestration Refinements
**Status**: COMPLETE
**Description**: Quality improvements to the orchestration pipeline — task sizing enforcement, pre-flight validation, proactive backlog review, and unified command interface.

#### Milestones
- [x] Task sizing enforced at creation time and during Planner sessions
- [x] Unified /run, /create, /status commands for consistent CLI and slash command interface

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_034 | Session-Scoped State Directories with Unified Event Log | COMPLETE | P1-High |
| TASK_2026_043 | Task Sizing Validation in /create-task Command | COMPLETE | P1-High |
| TASK_2026_044 | Pre-Flight Validation with Task Sizing Check | COMPLETE | P1-High |
| TASK_2026_045 | Planner Retroactive Oversized Task Detection | COMPLETE | P1-High |
| TASK_2026_047 | Unified /run, /create, /status Commands + CLI Single-Task Run | COMPLETE | P1-High |

## Current Focus

**Active Phase**: Phase 4 -- Validation
**Active Milestone**: End-to-end test on a fresh project
**Next Priorities**:
1. TASK_2026_014 — End-to-End Test Fresh Project (P0-Critical, unblocked)
2. TASK_2026_019 — Fix Print Mode Token/Cost Tracking (P1-High, unblocked)
3. TASK_2026_022 — Dashboard Data Service (P1-High, unblocked)

**Supervisor Guidance**: PROCEED
**Guidance Note**: Phases 1-3 and 5 are complete. Phase 4 (validation) is the critical next step. Phases 6 and 7 can start in parallel once validation passes.

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
| 2026-03-24 | TASK_006 cancelled, replaced by 015-017 | Dynamic generation split into focused tasks: stack detection, /create-agent, /create-skill |
| 2026-03-24 | Completion phase must update plan.md | Workers update task status + phase status in plan.md to prevent staleness |
