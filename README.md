# Nitro-Fueled

**Reusable AI development orchestration.** Install into any project to get a full PM → Architect → Dev → QA pipeline with autonomous worker sessions.

You define scope and priorities. Nitro-Fueled plans, builds, reviews, and advances tasks — autonomously.

[Documentation](https://iamb0ody.github.io/nitro-fueled/) · [Design Doc](docs/nitro-fueled-design.md)

---

## What It Does

Nitro-Fueled is a structured orchestration layer for AI-powered software delivery. It coordinates 16 specialist agents through defined workflows, tracks every artifact, and runs autonomous worker sessions that take tasks from creation to reviewed completion.

- **Plan** — A Planner agent investigates your codebase, proposes phased roadmaps, and creates well-scoped tasks
- **Build** — Build Workers execute the full PM → Architect → Team Leader → Developer pipeline in isolated sessions
- **Review** — Review Workers run style, logic, and security reviews with fix-and-verify cycles
- **Supervise** — An Auto-Pilot Supervisor coordinates workers end-to-end: queue selection, spawning, health monitoring, recovery, and stop conditions

### Built and proven

Nitro-Fueled was built using itself. 18 tasks completed autonomously across orchestration engine, agent system, CLI package, and landing experience — with the Supervisor managing concurrent Build and Review Workers throughout.

---

## Architecture

```
Product Owner          You — define vision, create tasks, set priorities
    ↓
Strategic Layer        Planner Agent → plan.md, registry.md
    ↓
Supervisor Layer       Auto-Pilot Supervisor → Build Workers, Review Workers, Cleanup Workers
    ↓
Execution Layer        PM → Architect → Team Leader → Developers → Reviewers → Tester
```

### Worker Types

| Worker | Role | Transition |
|--------|------|-----------|
| **Build Worker** | Runs PM → Architect → Dev pipeline. Commits code. | CREATED → IMPLEMENTED |
| **Review Worker** | Runs style, logic, security reviews. Writes completion report. | IMPLEMENTED → COMPLETE |
| **Cleanup Worker** | Salvages uncommitted work from failed workers. | Salvage → Commit → Exit |

### Task State Machine

```
CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE
                ↑                          |
                └──────────────────────────┘  (review findings → rework)

Any state → BLOCKED (retries exhausted)
Any state → CANCELLED (manual)
```

---

## Agents

16 specialist agents organized into functional teams:

| Team | Agents |
|------|--------|
| **Planning** | Planner, Project Manager, Software Architect |
| **Orchestration** | Team Leader |
| **Development** | Backend Developer, Frontend Developer, Systems Developer, DevOps Engineer |
| **Quality Assurance** | Senior Tester, Code Logic Reviewer, Code Style Reviewer, Visual Reviewer |
| **Design** | UI/UX Designer |
| **Content** | Technical Content Writer |
| **Research** | Researcher Expert, Modernization Detector |

Core agents ship as-is. Project-specific developer agents are generated at init based on your tech stack.

---

## Skills

| Skill | Purpose |
|-------|---------|
| **Orchestration** | Core workflow engine — routes tasks through agent pipelines based on type |
| **Auto-Pilot** | Supervisor loop — reads backlog, builds dependency graph, spawns/monitors workers |
| **UI/UX Designer** | Visual design workflow — niche discovery, design systems, asset generation |
| **Technical Content Writer** | Content pipeline — landing pages, blogs, docs, video scripts |

---

## Commands

| Command | Description |
|---------|-------------|
| `/plan` | Strategic planning with the Planner agent |
| `/auto-pilot` | Spawn Supervisor to process the task backlog |
| `/orchestrate` | Run the full development workflow for a single task |
| `/create-task` | Create a new task with proper structure |
| `/create-agent` | Generate a developer agent from template |
| `/create-skill` | Generate a new skill directory |
| `/initialize-workspace` | Set up orchestration in a new project |
| `/project-status` | Display project progress overview |
| `/review-code` | Run code style review |
| `/review-logic` | Run business logic review |
| `/review-security` | Run security vulnerability review |
| `/orchestrate-help` | Quick reference for the orchestration system |

---

## Workflow Strategies

Task type determines the agent pipeline:

| Type | Pipeline |
|------|----------|
| **FEATURE** | PM → Research (optional) → Architect → Team Leader → QA |
| **BUGFIX** | Research (optional) → Team Leader → QA |
| **REFACTORING** | Architect → Team Leader → QA |
| **DOCUMENTATION** | PM → Developer → Style Reviewer |
| **RESEARCH** | Researcher → Implementation (conditional) |
| **DEVOPS** | PM → Architect → DevOps Engineer → QA |
| **CREATIVE** | UI/UX Designer → Content Writer → Frontend Dev |

---

## Task Tracking

Every task produces structured artifacts. These files are the system's memory — they give the Supervisor, reviewers, and you full observability.

### Folder Structure

```
task-tracking/
├── registry.md              # Central task index — status, type, dates
├── plan.md                  # Phased roadmap, milestones, decisions log
├── orchestrator-state.md    # Live Supervisor state — workers, queue, session log
├── task-template.md         # Canonical template for new tasks
└── TASK_2026_NNN/
    ├── task.md              # Task definition — type, priority, acceptance criteria
    ├── context.md           # PM-generated requirements and scope
    ├── implementation-plan.md   # Architect's design decisions
    ├── tasks.md             # Team Leader's developer batch breakdown
    ├── code-style-review.md # Style reviewer findings
    ├── code-logic-review.md # Logic reviewer findings
    ├── security-review.md   # Security reviewer findings
    └── completion-report.md # Final summary — what shipped, tradeoffs, follow-ups
```

### Control Files

| File | Role |
|------|------|
| **registry.md** | Single source of truth. Every task's status, type, and dates. The Supervisor's first read on every loop. |
| **plan.md** | Strategic roadmap with Supervisor Guidance directives (PROCEED, REPRIORITIZE, ESCALATE). |
| **orchestrator-state.md** | Live session state — active workers, completed tasks, retry tracker, timestamped session log. Survives context compactions. |
| **task-template.md** | Canonical template ensuring every task is machine-parseable by the Supervisor. |
| **anti-patterns.md** | QA-derived rules from 142+ findings. Checked before every code submission. |
| **review-lessons/** | Per-domain learned patterns (backend, frontend, general). Knowledge compounds across tasks. |

### Artifact Timeline

```
CREATED        → task.md
PM             → context.md, task-description.md
Architect      → implementation-plan.md
Team Leader    → tasks.md
Developers     → code changes + commits
Review         → code-style-review.md, code-logic-review.md, security-review.md
COMPLETE       → completion-report.md
```

---

## Getting Started

### 1. Install

```bash
npx @itqanlab/nitro-fueled init
```

Detects your tech stack, copies core agents, generates project-specific developer agents, sets up task tracking.

### 2. Plan

```
/plan
```

Discuss your vision with the Planner. It investigates the codebase, proposes tasks, and creates a phased roadmap.

### 3. Run

```
/auto-pilot
```

The Supervisor takes over. Spawns workers, monitors health, handles failures, and loops until everything is done.

---

## CLI

The `nitro-fueled` CLI provides programmatic access:

```bash
npx @itqanlab/nitro-fueled init      # Initialize orchestration in current project
npx @itqanlab/nitro-fueled run       # Start the Supervisor
npx @itqanlab/nitro-fueled status    # Show task registry and worker status
npx @itqanlab/nitro-fueled create    # Create a new task interactively
```

---

## Dependencies

- **Claude Code CLI** — Primary execution engine for workers
- **Session Orchestrator MCP Server** — Spawns and monitors autonomous worker sessions

---

## Project Structure

```
nitro-fueled/
├── .claude/
│   ├── agents/              # 16 agent definitions
│   ├── skills/
│   │   ├── orchestration/   # Core workflow engine + references
│   │   ├── auto-pilot/      # Supervisor skill
│   │   ├── ui-ux-designer/  # Visual design workflow
│   │   └── technical-content-writer/  # Content pipeline
│   ├── commands/            # 12 slash commands
│   ├── anti-patterns.md     # QA-derived rules
│   └── review-lessons/      # Per-domain learned patterns
├── packages/
│   └── cli/                 # npx @itqanlab/nitro-fueled (init, run, status, create)
├── task-tracking/           # Registry, plan, state, task folders
├── docs/                    # Design docs + landing page
└── CLAUDE.md                # Project instructions
```

---

## Roadmap

### Completed

| Phase | Description | Tasks |
|-------|-------------|-------|
| **Phase 1: Orchestration Engine** | Core skills, agents, commands, task tracking, Supervisor loop, Planner | 4 tasks |
| **Phase 2: Agent System** | Workspace agent setup, systems-developer, stack detection, /create-agent, /create-skill | 3 tasks |
| **Phase 3: CLI Package** | npm CLI with init, run, status, create commands + MCP server dependency handling | 7 tasks |
| **Phase 5: Landing Experience** | Hero visual identity and interactive landing page | 1 task |

### In Progress

| Task | Type | Priority | Description |
|------|------|----------|-------------|
| TASK_2026_014 | RESEARCH | P0-Critical | End-to-end test on a fresh project to validate the full init → plan → run → complete pipeline |

### Planned

| Task | Type | Priority | Description |
|------|------|----------|-------------|
| TASK_2026_019 | BUGFIX | P1-High | **Fix print mode token/cost tracking.** Session orchestrator reports $0/0 tokens for all `--print` mode workers. Root cause: JSONL session logs aren't written in headless mode. Fix: switch to `stream-json` output format, parse stdout in real-time. |
| TASK_2026_020 | FEATURE | P2-Medium | **Per-task model selection.** Add optional Model field to task template. Wire through Supervisor → spawn_worker. Surface in registry and worker stats for cost visibility. |
| TASK_2026_021 | FEATURE | P1-High | **Smart provider & model routing.** Two-provider system — Claude Code (full orchestration) + OpenCode (single-shot execution with 75+ model providers). Intelligent cost router selects the cheapest capable provider/model based on task type, complexity, and priority. Avoids burning expensive tokens on work that cheaper models can handle. |

### Future Directions

- **Provider-agnostic execution** — OpenCode adapter enables access to OpenAI, Google, Groq, Ollama (local), and 75+ providers for cost optimization
- **Model-aware pipeline simplification** — Opus gets full PM → Architect → Dev → QA; Sonnet gets simplified pipelines; single-shot providers skip orchestration entirely
- **Cost intelligence** — Supervisor auto-routes: Complex/P0 → Claude Opus, Medium → Sonnet, Simple → OpenCode with `o4-mini` or Gemini Flash
- **Local model support** — Run tasks on local models via Ollama through OpenCode for zero API cost on sensitive codebases
- **npm publish** — `npx @itqanlab/nitro-fueled init` available as a public package

---

## How the Supervisor Works

The Auto-Pilot Supervisor runs a continuous loop:

1. **Read State & Recover** — Load orchestrator-state.md, reconcile active workers, validate registry
2. **Build Dependency Graph** — Parse registry and task.md files, classify as READY_FOR_BUILD, READY_FOR_REVIEW, or BLOCKED
3. **Consult Strategic Plan** — Read plan.md for Supervisor Guidance directives
4. **Order & Spawn** — Review queue first (finish > start), fill slots up to concurrency limit
5. **Monitor Health** — Check worker activity every 5 minutes, two-strike stuck detection
6. **Handle Completions** — Validate state transitions, queue next workers
7. **Recovery Protocol** — Spawn Cleanup Workers for failed workers, salvage uncommitted work
8. **Loop or Stop** — Actionable tasks → loop. Nothing left → save history, stop.

---

## Track Record

| Metric | Value |
|--------|-------|
| Tasks completed autonomously | 16 |
| Tasks cancelled | 1 |
| Active tasks | 1 |
| Planned tasks | 3 |
| Concurrent worker sessions | Up to 3 |
| QA findings collected | 142+ |
| Review lessons captured | 3 domains |

---

## License

MIT
