# Project Plan

## Project Overview

nitro-fueled is a reusable AI development orchestration package. Install into any project to get a full PM -> Architect -> Dev -> QA pipeline with autonomous worker sessions. Includes a Planner for strategic planning, a Supervisor for task execution, and dynamic agent generation for any tech stack.

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
**Status**: COMPLETE
**Description**: Fix token/cost tracking for print-mode workers, add per-task model selection, and build smart provider routing.

#### Milestones
- [x] Print mode token/cost tracking fixed
- [x] Per-task model selection in task metadata
- [x] Smart provider and model routing system

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_019 | Fix Print Mode Token/Cost Tracking | COMPLETE | P1-High |
| TASK_2026_020 | Per-Task Model Selection | COMPLETE | P2-Medium |
| TASK_2026_021 | Smart Provider & Model Routing | COMPLETE | P1-High |
| TASK_2026_042 | CLI Provider Configuration and Dependency Validation | COMPLETE | P1-High |

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
| TASK_2026_038 | Dashboard Session Support — Multi-Session View and History | COMPLETE | P2-Medium |
| TASK_2026_039 | Dashboard Pipeline and Squad Visualization | COMPLETE | P2-Medium |
| TASK_2026_040 | Dashboard Dependency Graph Visualization | COMPLETE | P2-Medium |

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
| TASK_2026_035 | Review Lead — Parallel Reviews with Model Routing | COMPLETE | P1-High |
| TASK_2026_036 | Test Lead — Parallel Test Writing and Execution with Model Routing | COMPLETE | P1-High |

### Phase 9: Learning Loop
**Status**: COMPLETE
**Description**: Close the feedback cycle — retrospective analysis to surface recurring patterns, update review lessons, and drive continuous improvement across sessions.

#### Milestones
- [x] /retrospective command reads completion reports and review files
- [x] Pattern detection identifies systemic issues (3+ task threshold)
- [x] Conflict-safe auto-apply to review-lessons and anti-patterns
- [x] Planner reads most recent retrospective before planning sessions
- [x] Auto-pilot writes quality metrics to orchestrator-history.md on shutdown

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_048 | /retrospective Command — Post-Session Analysis and Learning Loop | COMPLETE | P1-High |

### Phase 10: Agent Calibration
**Status**: COMPLETE
**Description**: Build a calibration system for agents — per-agent records tracking task history and failures, a failure taxonomy, and a `/evaluate-agent` command that tests any agent against a quality bar and auto-fixes its definition until it passes.

#### Milestones
- [x] Agent record schema and failure taxonomy defined
- [x] `/evaluate-agent` command operational with full calibration loop

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_061 | Agent Record Schema and Failure Taxonomy | COMPLETE | P1-High |
| TASK_2026_062 | /evaluate-agent Command | COMPLETE | P1-High |

### Phase 11: Supervisor Reliability & Performance
**Status**: COMPLETE
**Description**: Make the Supervisor production-grade — persistent MCP state, event-driven completion detection, file-system-first reconciliation, provider fallback, and a usable provider config UX.

#### Milestones
- [x] MCP worker registry persisted to disk (survives server restart)
- [x] Supervisor reconciles via status files when MCP returns empty
- [x] Event-driven completion: workers fire events instead of supervisor polling every 5 min
- [x] 30-second event drain loop replaces 5-minute polling as primary completion detection
- [x] Supervisor falls back to Claude Sonnet when a non-Claude provider spawn fails
- [x] `nitro-fueled config` shows provider state upfront with per-provider test/unload actions

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_063 | Move session-orchestrator into Monorepo | COMPLETE | P1-High |
| TASK_2026_059 | MCP Server — Persist Worker Registry to Disk | COMPLETE | P1-High |
| TASK_2026_060 | Supervisor — File-System-First Reconciliation When MCP Returns Empty | COMPLETE | P1-High |
| TASK_2026_067 | Event-Driven Worker Completion — MCP File Watcher + Supervisor Subscriptions | COMPLETE | P1-High |
| TASK_2026_068 | Provider Config UX — State Display, Per-Provider Test and Unload | COMPLETE | P1-High |
| TASK_2026_069 | Supervisor Spawn Fallback — Retry with Claude Sonnet on Provider Failure | COMPLETE | P1-High |
| TASK_2026_065 | Orchestration Analytics — Per-Run Token and Cost Logging | COMPLETE | P2-Medium |
| TASK_2026_070 | Session Artifact Commit Ownership — Defined Committers and Stale Archive Pre-Flight | COMPLETE | P1-High |
| TASK_2026_066 | Worker Compaction Circuit Breaker | COMPLETE | P1-High |

### Phase 12: CLI Maturity
**Status**: IN_PROGRESS
**Description**: Harden the CLI package to reflect its installable-toolkit identity — agent rename to `nitro-*` namespace, documentation updates, scaffold sync, and /run command alignment.

#### Milestones
- [x] Agents renamed to `nitro-*` prefix (TASK_2026_051)
- [ ] /run command updated for new naming (TASK_2026_050)
- [x] Docs and workspace updated to reflect package vision (TASK_2026_053)
- [ ] Scaffold synced with current .claude/ (TASK_2026_049)
- [ ] Workspace init validated end-to-end (TASK_2026_052)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_049 | Sync Scaffold with Current .claude/ | CREATED | P1-High |
| TASK_2026_050 | Update /run Command for nitro-* Agents | CREATED | P1-High |
| TASK_2026_051 | Rename Agents to nitro-* Prefix | COMPLETE | P1-High |
| TASK_2026_052 | Validate Workspace Init End-to-End | CREATED | P1-High |
| TASK_2026_053 | Update Docs and Workspace to Reflect Package Vision | COMPLETE | P1-High |

### Phase 13: Documentation Site
**Status**: IN_PROGRESS
**Description**: Build a professional Astro Starlight documentation site at packages/docs/ with GitHub Pages deployment, replacing the hand-rolled HTML docs.

#### Milestones
- [x] Astro Starlight scaffold at packages/docs/ (TASK_2026_055)
- [x] Full landing page (TASK_2026_056)
- [ ] Content migration from docs/ (TASK_2026_057)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_055 | Scaffold Astro Starlight Docs Site | COMPLETE | P1-High |
| TASK_2026_056 | Build Full Landing Page | COMPLETE | P1-High |
| TASK_2026_057 | Migrate docs/ Content to Starlight | CREATED | P2-Medium |

## Current Focus

**Active Phase**: Phase 12 (CLI Maturity) + Phase 13 (Docs Site)
**Active Milestone**: Agent rename complete; docs, scaffold sync, and /run update in progress
**Next Priorities**:
1. Complete Phase 12 — tasks 049, 050, 052, 053 pending
2. Phase 10 (Agent Calibration) continues in parallel
3. Phase 4 (Validation) — end-to-end fresh project test follows Phase 12 completion

**Supervisor Guidance**: PROCEED
**Guidance Note**: Phase 12 (CLI Maturity) is the active focus. TASK_2026_051 complete. Run 049+050+053 in parallel (no shared files). TASK_2026_052 depends on 049+050+051 all complete. Backlog sizing violations on tasks 038-057 acknowledged and overridden by Product Owner.

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
