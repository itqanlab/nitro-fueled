---
title: Commands
description: All CLI commands and slash commands available in Nitro-Fueled.
---

Nitro-Fueled provides two command surfaces: **CLI commands** (`npx nitro-fueled`) for project setup and task execution, and **slash commands** (`/orchestrate`, `/plan`, `/auto-pilot`, etc.) for interactive use from inside Claude Code.

---

## CLI Commands

### `npx nitro-fueled init`

**Purpose:** Scaffold the full Nitro-Fueled setup into the current project directory.

Copies the `.claude/` scaffold and `task-tracking/` structure, detects your tech stack, generates project-specific developer agents, and configures `.mcp.json`.

```bash
npx nitro-fueled init
```

Run once when setting up a new or existing project. Safe to re-run — only `nitro-*` prefixed files are overwritten.

---

### `npx nitro-fueled create`

**Purpose:** Interactive task creation wizard.

Prompts you through each `task.md` field, validates inputs, and writes the task file to `task-tracking/TASK_YYYY_NNN/task.md`.

```bash
npx nitro-fueled create
```

Equivalent to the `/create-task` slash command.

---

### `npx nitro-fueled run [TASK_ID]`

**Purpose:** Unified execution command. Runs a single task or the full Auto-Pilot Supervisor loop.

```bash
# Run the full Supervisor loop (processes all ready tasks)
npx nitro-fueled run

# Run a single specific task
npx nitro-fueled run TASK_2026_001
```

When a `TASK_ID` is provided, runs that task through the full pipeline in the current terminal session. Without a `TASK_ID`, starts the Supervisor loop which spawns workers in iTerm2 tabs.

---

### `npx nitro-fueled status`

**Purpose:** Show current project health — task statuses, active workers, costs.

```bash
npx nitro-fueled status
```

Regenerates `task-tracking/registry.md` from the current `status` files, then prints a summary table of all tasks, their states, and any active worker sessions.

---

### `npx nitro-fueled update`

**Purpose:** Update core agent, skill, and command files to the latest version without overwriting project-specific files.

```bash
npx nitro-fueled update
```

Updates all `nitro-*` prefixed agent files, all core skills, and all slash commands in `.claude/`. Files without the `nitro-` prefix (your project-specific agents) are never touched. Run after upgrading the `nitro-fueled` package to pull in the latest agent definitions.

---

## Slash Commands

Slash commands run inside a Claude Code session. Use them for interactive, conversational workflows.

---

### `/plan [intent]`

**Purpose:** Strategic planning with the Planner agent.

Start a planning session to discuss new features, create well-scoped tasks, manage the product roadmap, or reprioritize the backlog.

```
/plan add user authentication
/plan status
/plan reprioritize
```

**Modes:**

- **Default** — interactive planning: discuss intent, read codebase, propose tasks, wait for your approval before writing anything
- **`status`** — refresh `plan.md` from the current task registry, report phase progress
- **`reprioritize`** — reorder the backlog based on new priorities

**When to use:** Before writing `task.md` files manually. The Planner checks task sizing, detects circular dependencies, and proposes a right-sized breakdown.

---

### `/create-task`

**Purpose:** Guided task creation with the task scaffolder.

```
/create-task
```

Prompts through each `task.md` field interactively. Validates `Type`, `Priority`, and `Complexity` against the canonical template. Writes the file and updates the registry.

**When to use:** When you know exactly what you want and want to skip the planning discussion.

---

### `/orchestrate [TASK_ID]`

**Purpose:** Run a single task through the full orchestration pipeline.

```
/orchestrate TASK_2026_001
/orchestrate "Add user authentication to the login page"
```

When given a `TASK_ID`, picks up the existing task folder. When given a plain description, creates a new task context and runs the full pipeline in the current session (without spawning a separate worker tab).

**When to use:** Running a specific task interactively. Useful for complex tasks where you want to validate the PM output and architect plan before implementation proceeds.

---

### `/auto-pilot`

**Purpose:** Start the Supervisor loop to process the full task backlog.

```
/auto-pilot
```

Reads `task-tracking/registry.md`, builds the dependency graph, spawns Build Workers and Review Workers for all ready tasks (up to the concurrency limit), monitors health, and loops until the backlog is drained or blocked.

**When to use:** When you have multiple tasks ready to run and want to step away while they process in parallel.

---

### `/run [TASK_ID]`

**Purpose:** Unified execution — routes to Auto-Pilot or single-task orchestration.

```
/run                  # Start Supervisor loop
/run TASK_2026_001    # Run a single task
```

Equivalent to `npx nitro-fueled run` but from inside Claude Code. Automatically detects whether to start the full loop or run a single task.

---

### `/project-status`

**Purpose:** Generate a verified project health report.

```
/project-status
```

Cross-references three sources of truth: the actual codebase (git log), the task-tracking folder (status files), and the registry. Reports task states, active workers, completed milestones, and any inconsistencies between the sources.

**When to use:** At the start of a session to understand what was completed, what is in progress, and what is blocked.

---

### `/review-code`

**Purpose:** Run a full code quality review on the current task or specified files.

```
/review-code
/review-code TASK_2026_001
```

Invokes the `nitro-code-style-reviewer`, `nitro-code-logic-reviewer`, and `nitro-code-security-reviewer` in sequence. Produces review report files in the task folder.

---

### `/review-logic`

**Purpose:** Logic-only review — checks for stubs, placeholders, missing error handling, and business logic correctness.

```
/review-logic TASK_2026_001
```

---

### `/review-security`

**Purpose:** Security-only review — OWASP pattern matching, input validation, secret exposure, injection vulnerabilities.

```
/review-security TASK_2026_001
```

---

### `/retrospective`

**Purpose:** Post-session analysis and learning loop.

```
/retrospective
```

Analyzes completed tasks for recurring patterns, updates `review-lessons/` with new findings, and proposes process improvements. Run at the end of a working session to capture learnings.

---

### `/initialize-workspace`

**Purpose:** Generate `CLAUDE.md` and comprehensive workspace documentation for the current codebase.

```
/initialize-workspace
```

Scans the project structure, identifies architecture patterns, and generates `CLAUDE.md` with context that future agents will read at the start of every session. Run once when adding Nitro-Fueled to an existing project that has not been documented yet.

---

### `/status`

**Purpose:** Project status report. Alias for `/project-status`.

```
/status
```

Generates a verified status report by cross-referencing the codebase, task-tracking folder, and `registry.md`. Reports task states, active workers, completed milestones, and any inconsistencies. Use interchangeably with `/project-status`.

---

### `/create`

**Purpose:** Unified task creation — routes to the Planner for discussion-based creation or the quick form for immediate scaffolding.

```
/create [description]           # Planner mode — discussion-based task creation
/create --quick [description]   # Quick mode — form-based task scaffolding
```

Without `--quick`, starts a Planner conversation to discuss requirements and scope the work before writing any files. With `--quick`, routes directly to `/create-task` for immediate form-based scaffolding.

---

### `/create-agent`

**Purpose:** Generate a new developer agent from the canonical developer template and update the agent catalog.

```
/create-agent                 # Interactive — prompts for all fields
/create-agent [name]          # Pre-fills name, prompts for the rest
```

Reads the developer template and stack-detection registry, prompts for stack and domain focus, generates a fully populated agent definition, and updates the agent catalog. Agent name must end with `-developer` (e.g., `react-developer`).

---

### `/create-skill`

**Purpose:** Scaffold a new skill directory with a pre-filled `SKILL.md`.

```
/create-skill                 # Interactive — prompts for all fields
/create-skill [name]          # Pre-fills name, prompts for the rest
```

Creates `.claude/skills/{name}/SKILL.md` following the existing skill pattern. The generated file includes YAML frontmatter, trigger conditions, and placeholder sections. Fill in the workflow details after creation.

---

### `/evaluate-agent`

**Purpose:** Agent calibration loop — tests an agent against its definition and auto-fixes failures.

```
/evaluate-agent <agent-name>
```

Runs a targeted test against the specified agent, scores the output on four dimensions (scope adherence, instruction compliance, output quality, tool use), and applies definition fixes on failure. Loops up to 3 iterations before flagging the agent for manual review.

---

### `/orchestrate-help`

**Purpose:** Quick reference for orchestration commands and workflow phases.

```
/orchestrate-help
```

Prints a concise reference showing the `/orchestrate` command arguments, the workflow phases (Pre-Flight → PM → Researcher → Architect → Developer → Reviewer), quality gates, and common troubleshooting steps.

---

## Command Summary Table

| Command | Surface | When to Use |
|---------|---------|-------------|
| `npx nitro-fueled init` | CLI | Initial project setup |
| `npx nitro-fueled create` | CLI | New task creation |
| `npx nitro-fueled run [TASK_ID]` | CLI | Execute task(s) |
| `npx nitro-fueled status` | CLI | Check project health |
| `npx nitro-fueled update` | CLI | Update core agents/skills/commands |
| `/plan` | Slash | Strategic planning and roadmap |
| `/create` | Slash | Unified task creation (Planner or quick form) |
| `/create-task` | Slash | Interactive task scaffolding |
| `/orchestrate [TASK_ID]` | Slash | Single-task pipeline run |
| `/auto-pilot` | Slash | Full backlog processing loop |
| `/run [TASK_ID]` | Slash | Unified execution |
| `/project-status` | Slash | Verified project health report |
| `/status` | Slash | Project status report (alias for `/project-status`) |
| `/review-code` | Slash | Full code quality review |
| `/review-logic` | Slash | Logic-only review |
| `/review-security` | Slash | Security-only review |
| `/retrospective` | Slash | Post-session learning capture |
| `/initialize-workspace` | Slash | Generate project documentation |
| `/create-agent` | Slash | Generate a new developer agent |
| `/create-skill` | Slash | Scaffold a new skill |
| `/evaluate-agent` | Slash | Agent calibration and testing loop |
| `/orchestrate-help` | Slash | Quick reference for orchestration workflow |

---

## See Also

- [First Run](../getting-started/first-run/) — Walkthrough of your first task execution
- [Auto-Pilot Guide](../auto-pilot/) — Supervisor configuration and monitoring
- [Task Format](../task-format/) — Full `task.md` field reference
