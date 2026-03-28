# nitro-fueled

**Reusable AI development orchestration.** Install into any project to get a full PM → Architect → Dev → QA pipeline with autonomous worker sessions.

```bash
npx @itqanlab/nitro-fueled init
```

---

## What It Does

Nitro-Fueled sets up a structured orchestration layer for AI-powered software delivery inside your project. It coordinates specialist agents through defined workflows, tracks every artifact, and runs autonomous worker sessions that take tasks from creation to reviewed completion.

- **Plan** — A Planner agent investigates your codebase, proposes phased roadmaps, and creates well-scoped tasks
- **Build** — Build Workers execute the full PM → Architect → Team Leader → Developer pipeline in isolated sessions
- **Review** — Review Workers run style, logic, and security reviews with fix-and-verify cycles
- **Supervise** — An Auto-Pilot Supervisor coordinates workers end-to-end: queue selection, spawning, health monitoring, recovery, and stop conditions

---

## Requirements

- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- Node.js >= 18

---

## CLI Commands

```bash
npx @itqanlab/nitro-fueled init      # Initialize orchestration in current project
npx @itqanlab/nitro-fueled run       # Start the Supervisor
npx @itqanlab/nitro-fueled status    # Show task registry and worker status
npx @itqanlab/nitro-fueled create    # Create a new task interactively
```

---

## Getting Started

### 1. Initialize

```bash
cd your-project
npx @itqanlab/nitro-fueled init
```

Detects your tech stack, copies core agents, generates project-specific developer agents, and sets up task tracking.

### 2. Plan

Open Claude Code in your project, then run:

```
/plan
```

The Planner agent investigates the codebase, proposes tasks, and creates a phased roadmap.

### 3. Run

```
/auto-pilot
```

The Supervisor takes over. Spawns workers, monitors health, handles failures, and loops until everything is done.

---

## What Gets Installed

```
your-project/
├── .claude/
│   ├── agents/          # 16+ specialist agent definitions
│   ├── skills/          # Orchestration, Auto-Pilot, UI/UX, Content Writing
│   ├── commands/        # /plan, /auto-pilot, /orchestrate, /create-task, and more
│   └── anti-patterns.md # QA-derived rules checked before every submission
└── task-tracking/
    ├── registry.md      # Central task index
    ├── plan.md          # Phased roadmap
    └── task-template.md # Canonical task structure
```

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/plan` | Strategic planning with the Planner agent |
| `/auto-pilot` | Spawn Supervisor to process the task backlog |
| `/orchestrate` | Run the full workflow for a single task |
| `/create-task` | Create a new task with proper structure |
| `/project-status` | Display project progress overview |
| `/review-code` | Run code style review |
| `/review-logic` | Run business logic review |
| `/review-security` | Run security vulnerability review |

---

## Architecture

```
Product Owner     You — define vision, create tasks, set priorities
    ↓
Strategic Layer   Planner Agent → plan.md, registry.md
    ↓
Supervisor Layer  Auto-Pilot → Build Workers, Review Workers, Cleanup Workers
    ↓
Execution Layer   PM → Architect → Team Leader → Developers → Reviewers
```

### Task State Machine

```
CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE
```

---

## License

MIT

---

[Full documentation & design docs](https://github.com/itqanlab/nitro-fueled)
