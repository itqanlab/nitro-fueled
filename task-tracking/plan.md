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
| TASK_2026_106 | Generalize Orchestration Lifecycle — Rename implementation-plan.md to plan.md + Universal Lifecycle Flow | COMPLETE | P2-Medium |

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
| TASK_2026_124 | Evaluation Supervisor — Single Model Mode | COMPLETE | P2-Medium |
| TASK_2026_125 | Evaluation Supervisor — A/B Comparison and Role Testing | COMPLETE | P1-High |

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
| TASK_2026_111 | Two-Phase Provider Resolver Engine (Part 2/3) | COMPLETE | P1-High |
| TASK_2026_112 | Auto-Pilot Routing Update — Config-Driven (Part 3/3) | COMPLETE | P1-High |

### Phase 13: Documentation Site
**Status**: COMPLETE
**Description**: Build a professional Astro Starlight documentation site at packages/docs/ with GitHub Pages deployment, replacing the hand-rolled HTML docs.

#### Milestones
- [x] Astro Starlight scaffold at packages/docs/ (TASK_2026_055)
- [x] Full landing page (TASK_2026_056)
- [x] Content migration from docs/ (TASK_2026_057)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_055 | Scaffold Astro Starlight Docs Site | COMPLETE | P1-High |
| TASK_2026_056 | Build Full Landing Page | COMPLETE | P1-High |
| TASK_2026_057 | Migrate docs/ Content to Starlight | COMPLETE | P2-Medium |

### Phase 14: Nx Workspace Migration
**Status**: NOT STARTED
**Description**: Full migration to Nx monorepo — restructure packages to apps/libs, replace React with Angular 19 + NG-ZORRO (N.Gine dashboard), replace Node service with NestJS 11, replace Commander CLI with Oclif, extract session-orchestrator core as a lib. Angular app built UI-first against mock data before API integration.

#### Milestones
- [ ] Nx initialized and workspace restructured to apps/ + libs/ (Phase 14a)
- [ ] session-orchestrator core extracted to libs/worker-core (Phase 15)
- [ ] Angular 19 + NG-ZORRO dashboard shell and all 9 N.Gine screens complete (Phase 16-17)
- [ ] NestJS API fully replaces dashboard-service (Phase 18)
- [ ] Oclif CLI fully replaces Commander CLI (Phase 19)
- [ ] Angular wired to NestJS, CLI build pipeline updated, old packages removed (Phase 20)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_072 | Nx Workspace Initialization | COMPLETE | P0-Critical |
| TASK_2026_073 | Workspace Folder Restructure (packages → apps + libs) | COMPLETE | P0-Critical |
| TASK_2026_074 | Extract libs/worker-core from session-orchestrator | COMPLETE | P1-High |
| TASK_2026_075 | Refactor session-orchestrator app to consume worker-core | COMPLETE | P1-High |
| TASK_2026_076 | Scaffold Angular 19 + NG-ZORRO app (apps/dashboard) | COMPLETE | P0-Critical |
| TASK_2026_077 | Angular shell — layout, sidebar, routing, dark theme, mock data service | COMPLETE | P0-Critical |
| TASK_2026_078 | Dashboard main view | COMPLETE | P1-High |
| TASK_2026_079 | Analytics & Insights view | COMPLETE | P1-High |
| TASK_2026_080 | Agent Editor view | COMPLETE | P1-High |
| TASK_2026_081 | MCP Integrations view | COMPLETE | P1-High |
| TASK_2026_082 | Model Assignments view | COMPLETE | P1-High |
| TASK_2026_083 | New Task view | CREATED | P1-High |
| TASK_2026_084 | Project Onboarding view | CREATED | P1-High |
| TASK_2026_085 | Provider Hub view | CREATED | P1-High |
| TASK_2026_086 | Scaffold NestJS app (apps/dashboard-api) | COMPLETE | P1-High |
| TASK_2026_087 | Migrate state services + REST controllers to NestJS | COMPLETE | P1-High |
| TASK_2026_088 | Migrate WebSocket server to NestJS gateway | COMPLETE | P1-High |
| TASK_2026_089 | Scaffold Oclif CLI app (apps/cli) | COMPLETE | P1-High |
| TASK_2026_090 | Migrate init + run + status to Oclif commands | COMPLETE | P1-High |
| TASK_2026_091 | Migrate create + dashboard + config + update to Oclif commands | COMPLETE | P1-High |
| TASK_2026_092 | Angular ↔ NestJS integration + CLI build pipeline update | COMPLETE | P1-High |
| TASK_2026_093 | Deprecate old packages — remove packages/ after cutover | CREATED | P2-Medium |
| TASK_2026_144 | Remove legacy dashboard apps (dashboard-service + dashboard-web) | COMPLETE | P2-Medium |
| TASK_2026_145 | Dashboard API cortex migration — replace session-orchestrator with cortex MCP | COMPLETE | P1-High |
| TASK_2026_146 | Dashboard telemetry views — model performance, phase timing, session analytics | COMPLETE | P2-Medium |

### Phase 15: nitro-cortex — Shared Intelligence Layer
**Status**: IN_PROGRESS
**Description**: Build the `nitro-cortex` MCP server — a SQLite-backed shared intelligence layer that gives agents queryable tools for task state, session coordination, and worker management instead of reading markdown files.

#### Milestones
- [x] Package scaffold + SQLite schema + task tools (TASK_2026_120)
- [x] Session and worker management tools (TASK_2026_121)
- [x] Supervisor integration — replace markdown reads with cortex calls (TASK_2026_122)

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_120 | nitro-cortex — Package Scaffold + SQLite Schema + Task Tools (Part 1 of 3) | COMPLETE | P0-Critical |
| TASK_2026_121 | nitro-cortex — Session and Worker Management Tools (Part 2 of 3) | COMPLETE | P0-Critical |
| TASK_2026_122 | nitro-cortex — Supervisor Integration (Part 3 of 3) | COMPLETE | P0-Critical |
| TASK_2026_138 | nitro-cortex schema extension — tasks, handoffs, and events tables | COMPLETE | P1-High |
| TASK_2026_135 | Event-driven supervisor loop — cache registry and plan, refresh on events only | COMPLETE | P1-High |
| TASK_2026_139 | Supervisor DB migration — query cortex instead of reading files | COMPLETE | P1-High |
| TASK_2026_140 | File-DB sync layer — bidirectional consistency between files and cortex | COMPLETE | P1-High |
| TASK_2026_142 | Merge session-orchestrator into nitro-cortex — single MCP server | COMPLETE | P1-High |
| TASK_2026_143 | Agent helper MCP tools — context, lessons, commit, progress, and telemetry tools | COMPLETE | P1-High |
| TASK_2026_141 | CLI update command — DB migration and hydration for existing projects | COMPLETE | P1-High |

### Phase 16: v0.2.0 — Tick-Based Supervisor + Configurable Session Launch
**Status**: NOT STARTED
**Description**: Critical reliability fix for the supervisor architecture. Instead of one long-running supervisor session (which dies from context overflow, compaction loss, or crashes), the supervisor becomes a series of short-lived "ticks" orchestrated by the NestJS dashboard-api server. Each tick spawns a fresh Claude Code process (Haiku by default), reads state from cortex DB, makes one round of decisions, writes back, and exits. If a tick crashes, the next tick recovers from DB state. The dashboard-api is the persistent process; all state lives in cortex DB. Workers write heartbeats -- the server checks heartbeat freshness (not PIDs) for liveness detection. WebSocket events enable real-time frontend updates. User controls from dashboard UI: start/pause/resume/stop sessions.

#### Milestones
- [ ] Supervisor events wired through WebSocket for real-time frontend updates (Wave 1)
- [ ] Tick-mode skill prompt and server restart recovery (Wave 2)
- [ ] Tick scheduler service spawning Claude Code processes per tick (Wave 3)
- [ ] Per-task model/provider editing and cost tracking (Wave 2-5)
- [ ] Live session monitoring and controls in dashboard UI (Wave 2-3)

#### Task Map — Wave 0 (Supervisor hotfixes, run before Wave 1)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_241 | Supervisor: Reconcile Task State on Worker Exit | COMPLETE | P0-Critical |
| TASK_2026_242 | Supervisor: Ensure IMPLEMENTED Tasks Always Get a Review Worker Before Session End | COMPLETE | P1-High |

#### Task Map — Wave 1 (no dependencies, can run in parallel)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_222 | Extend Cortex DB Schema -- Agents, Workflows, Launchers, Compatibility | COMPLETE | P1-High |
| TASK_2026_229 | Extend Cortex Schema for Worker Telemetry | COMPLETE | P1-High |
| TASK_2026_244 | Dashboard API: Wire Supervisor Events to WebSocket Gateway | CREATED | P0-Critical |
| TASK_2026_247 | Sessions List: Checkbox Selection and Compare Button | CREATED | P2-Medium |
| TASK_2026_254 | MCP Cortex: Auto-Close Stale Sessions on Supervisor Startup | CREATED | P1-High |

#### Task Map — Wave 2 (depends on Wave 1)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_218 | Session Creation Advanced Options Panel (incl. supervisor model selector) | COMPLETE | P1-High |
| TASK_2026_230 | Instrument Worker Lifecycle -- Emit Telemetry Events | CREATED | P1-High |
| TASK_2026_243 | Per-Task Model/Provider Editor in Dashboard | CREATED | P1-High |
| TASK_2026_245 | Tick-Mode Auto-Pilot Skill Prompt | CREATED | P1-High |
| TASK_2026_257 | Server Restart Recovery -- Reconstruct Active Sessions from DB | CREATED | P1-High |
| TASK_2026_258 | Dashboard UI: Live Session Monitor via WebSocket | CREATED | P1-High |
| TASK_2026_259 | Dashboard UI: Session Controls -- Start/Pause/Resume/Stop | CREATED | P1-High |
| TASK_2026_262 | Worker Heartbeat Verification in Supervisor Tick Loop | CREATED | P1-High |

#### Task Map — Wave 3 (depends on Wave 2)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_219 | Queue Empty State and Re-Run Affordance | CREATED | P2-Medium |
| TASK_2026_249 | Cortex Schema: Session Cost Breakdown Columns and Summary | CREATED | P2-Medium |
| TASK_2026_261 | Tick Scheduler Service -- Spawn Claude Code Processes per Tick | CREATED | P0-Critical |
| TASK_2026_260 | Dashboard UI: Tick Health Dashboard Card | CREATED | P2-Medium |

#### Task Map — Wave 4 (depends on Wave 3)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_250 | Dashboard API: Session Cost Breakdown Response | CREATED | P2-Medium |
| TASK_2026_231 | Reporting API Endpoints | CREATED | P2-Medium |

#### Task Map — Wave 5 (depends on Wave 4)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_246 | Dashboard UI: Session Cost Breakdown Card | CREATED | P2-Medium |
| TASK_2026_232 | Dashboard Reports Page | CREATED | P2-Medium |
| TASK_2026_248 | Session Comparison View -- Side-by-Side Model Cost/Performance | CREATED | P2-Medium |

#### Cancelled (server-architecture tasks replaced by this phase)
| Task ID | Title | Status |
|---------|-------|--------|
| TASK_2026_220 | Launcher Interface Definition | CANCELLED |
| TASK_2026_221 | Claude Code Launcher Adapter | CANCELLED |
| TASK_2026_223 | Remove Task .md File Generation -- DB-Only Task State | CANCELLED |
| TASK_2026_224 | Server Supervisor Service | CANCELLED |
| TASK_2026_225 | Supervisor REST API + WebSocket Events | CANCELLED |
| TASK_2026_226 | Refactor Session-Mode Supervisor -- MCP Only | CANCELLED |
| TASK_2026_227 | Worker Output Collection -- Structured Parsing | CANCELLED |
| TASK_2026_228 | Direct Mode -- Single-Task Execution Without Supervisor | CANCELLED |
| TASK_2026_233 | Codex Launcher Adapter | CANCELLED |
| TASK_2026_234 | Launcher Registry + Dashboard Configuration | CANCELLED |
| TASK_2026_235 | Compatibility Tracking -- Record Execution Outcomes | CANCELLED |
| TASK_2026_236 | Auto-Routing Engine -- Intelligent Launcher/Model Selection | CANCELLED |
| TASK_2026_237 | Hybrid DB Architecture -- Project-Level + Global DB | CANCELLED |
| TASK_2026_238 | Global Install + User-Scope Server Architecture | CANCELLED |
| TASK_2026_239 | Workspace Management -- Register, Switch, List Projects | CANCELLED |
| TASK_2026_240 | Dashboard Multi-Workspace Support | CANCELLED |

### Phase 17: Subtask Support
**Status**: NOT STARTED
**Description**: Add subtask decomposition to the task system. A parent task can be decomposed into flat subtasks (one level deep, no nesting). Each subtask is independently spawnable with its own model/complexity. The Prep Worker becomes the decomposer -- it analyzes the task and creates subtasks. The Supervisor schedules subtasks independently, retries only failed subtasks (not the whole parent), and routes each subtask to the optimal model based on its complexity. Review happens holistically at the parent level after all subtasks complete.

#### Milestones
- [ ] Cortex schema supports subtasks with parent_task_id, subtask_order, and TASK_YYYY_NNN.M ID format
- [ ] Prep Worker decomposes Medium/Complex tasks into subtasks
- [ ] Supervisor schedules subtasks independently with per-subtask model routing
- [ ] Dashboard shows subtask tree with rollup progress

#### Task Map -- Wave 1 (schema foundation)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_263 | Cortex DB Schema: Subtask Support | CREATED | P1-High |

#### Task Map -- Wave 2 (depends on Wave 1)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_264 | Prep Worker: Task Decomposition into Subtasks | CREATED | P1-High |
| TASK_2026_269 | Dashboard API: Subtask Data in Task Response | CREATED | P2-Medium |

#### Task Map -- Wave 3 (depends on Wave 2)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_265 | Supervisor: Subtask-Aware Scheduling | CREATED | P1-High |
| TASK_2026_268 | Dashboard UI: Subtask Tree Display in Task Detail | CREATED | P2-Medium |

#### Task Map -- Wave 4 (depends on Wave 3)
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_2026_266 | Supervisor: Per-Subtask Model Routing | CREATED | P1-High |
| TASK_2026_267 | Review Worker: Holistic Parent Review After Subtask Completion | CREATED | P1-High |

## Current Focus

**Active Phase**: Phase 16 -- v0.2.0 Tick-Based Supervisor + Configurable Session Launch
**Active Milestone**: Wave 1 -- foundation tasks (WebSocket event wiring + schema extensions + stale session cleanup)
**Next Priorities**:
1. TASK_2026_244 -- Dashboard API: Wire Supervisor Events to WebSocket Gateway (P0-Critical, no deps, enables all frontend real-time features)
2. TASK_2026_254 -- MCP Cortex: Auto-Close Stale Sessions on Supervisor Startup (P1-High, no deps)
3. TASK_2026_222 -- Extend Cortex DB Schema (P1-High, no deps, also unblocks Phase 17 subtask schema)
4. TASK_2026_229 -- Extend Cortex Schema for Worker Telemetry (P1-High, no deps)
5. TASK_2026_247 -- Sessions List: Checkbox Selection and Compare Button (P2-Medium, no deps)

**Supervisor Guidance**: PROCEED
**Guidance Note**: v0.2.0 architecture revised again -- now tick-based supervisor. The dashboard-api NestJS supervisor (SessionRunner) already runs in-process with setInterval ticks. Critical gaps being addressed: (1) Wire supervisor events to WebSocket (244, P0), (2) Server restart recovery (257), (3) Worker heartbeat verification (262), (4) Tick-mode CLI prompt (245), (5) Tick scheduler service (261). Run Wave 1 in parallel (244, 222, 229, 247, 254 -- all independent). Then Wave 2 (245, 257, 258, 259, 262 + existing 218, 230, 243). Priority: 244 is P0-Critical -- it unblocks all real-time frontend features and the tick architecture. Phase 17 (Subtask Support) is queued after Phase 16 -- TASK_2026_263 depends on TASK_2026_222 from Phase 16 Wave 1.

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
| 2026-03-28 | Full Nx migration — Angular 19 + NG-ZORRO, NestJS 11, Oclif CLI | Modernize workspace: proper monorepo tooling, Angular (N.Gine mockups), NestJS for API, Oclif for structured CLI |
| 2026-03-28 | Angular dashboard built UI-first (mock data) before API integration | Decouples UI work from API readiness; all 9 screens can be developed and reviewed independently |
| 2026-03-28 | session-orchestrator core extracted to libs/worker-core | Separates reusable business logic (launchers, registry, watcher) from MCP transport layer |
| 2026-03-28 | CLI migrated to Oclif (from Commander.js) | Structured command classes, auto-generated help, plugin system, Nx-native — scales better as commands grow |
| 2026-03-28 | N.Gine branding used in Angular dashboard | Mockup reference retained as-is in the product |
| 2026-03-28 | Angular app deployment model: bundled into CLI assets | Maintains current model — `nitro-fueled dashboard` serves Angular via CLI, no separate deploy needed |
| 2026-03-31 | v0.2.0 architecture: Configurable Session Launch replaces server-based supervisor | Supervisor is a state machine that can run on Haiku for pennies. No need for expensive server architecture. Dashboard controls model selection, workers use per-task models independently. 16 server-architecture tasks cancelled. |
| 2026-03-31 | Haiku as default supervisor model | Supervisor loop (query tasks, check health, spawn workers, route completions) is mechanical — does not need reasoning power. Haiku at $0.25/1M input tokens vs Sonnet at $3/1M. Expected 90%+ cost reduction for supervisor overhead. |
| 2026-03-31 | Keep tasks 222, 229, 230 from original v0.2.0 plan | Cortex schema extensions and worker telemetry are architecture-neutral -- needed regardless of supervisor model. |
| 2026-03-31 | v0.2.0 revised to tick-based supervisor architecture | Single long-running supervisor session dies from context overflow, compaction, crashes. Replace with short-lived ticks: NestJS spawns fresh Claude Code process per tick (Haiku default), reads DB, decides, writes back, exits. Fresh context every tick. If tick crashes, next tick recovers. All state in cortex DB. |
| 2026-03-31 | Heartbeat-based worker liveness over PID checks | PIDs are invalid after server restart. Workers write heartbeats to DB; server checks heartbeat freshness (>5 min = dead). Works across restarts. |
| 2026-03-31 | WebSocket supervisor events for real-time dashboard | SessionRunner.emitEvent currently logs to debug only. Wire through DashboardGateway with per-session rooms. Eliminates polling for session monitoring. |
| 2026-03-31 | Server restart recovery from DB state | On NestJS startup, detect active sessions from cortex DB, verify worker heartbeats, reconcile dead workers, resume tick loops. No state lost on server restart. |
| 2026-03-31 | Subtask support -- flat decomposition with per-subtask model routing | Medium/Complex tasks decomposed into flat subtasks (one level, no nesting). Each subtask spawns independently with its own model. Failed subtasks retry individually. Review is holistic at parent level. Subtask ID format: TASK_YYYY_NNN.M. 7 tasks across 4 waves. |
