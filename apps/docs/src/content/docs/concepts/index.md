---
title: Core Concepts
description: Understand the fundamental concepts behind Nitro-Fueled.
---

Nitro-Fueled is built on five composable layers: **tasks**, **workers**, a **Supervisor**, a **Planner**, and **agents**. Each layer has a defined scope and communicates with the others through plain Markdown files and Git commits — no databases, no services, no proprietary formats.

---

## The Architecture at a Glance

```
Product Owner
     │
     ▼
  Planner (/plan)
     │
     ▼
  Supervisor (Auto-Pilot)
     │
     ├──────────────────────┬──────────────────────┐
     ▼                      ▼                      ▼
Build Worker           Build Worker           Review Worker
     │                                             │
     ▼                                             ▼
  Agents                                        Agents
(nitro-*)                                    (nitro-*)
PM → Architect →                        Review Lead + Test Lead
Team-Leader → Developer                       │
     │                                         ▼
     ▼                                  Fix Worker / Completion Worker
task-tracking/ ◄─────────────────────────────────┘
Git commits
```

---

## The Five Layers

### 1. Product Owner

You. You write task files (or use `/create-task` / `/plan` to have the system help you). You decide priority and scope. You validate the PM's requirements and the Architect's design when the pipeline pauses for your input.

### 2. Planner

The `nitro-planner` agent sits between you and the Supervisor. It maintains `task-tracking/plan.md` — a product roadmap with phases, milestones, and a "Current Focus" section the Supervisor reads to decide what to execute next. The Planner helps you break large features into right-sized tasks and catches oversized tasks before they enter worker sessions. Invoked via `/plan`.

### 3. Supervisor

The orchestrator-of-orchestrators. It reads the task registry, builds a dependency graph, and spawns workers in the correct order. It monitors worker health every 5 minutes, handles failures with a two-strike retry policy, and persists its state to survive context compaction. Invoked via `/auto-pilot` or `npx @itqanlab/nitro-fueled run`.

### 4. Workers

Each worker is an isolated Claude Code session running in its own iTerm2 tab with a fresh 1 million token context window. There are two types:

- **Build Worker** — runs `/orchestrate` on a `CREATED` task and drives it to `IMPLEMENTED`
- **Review Worker** — runs code review (logic, style, security) on an `IMPLEMENTED` task and drives it to `COMPLETE` or `FAILED`

### 5. Agents

Workers are empty containers. What makes a worker useful is the specialist agents it invokes. The `nitro-*` agent library provides 22 specialists covering planning, architecture, development, QA, research, and creative work. Each agent has a defined scope and communicates by reading and writing files in the task folder.

---

## Philosophy: Explicit Handoffs, Defined Scope

Every role in Nitro-Fueled has a hard boundary:

- The **Planner** creates tasks but does not implement them
- The **Project Manager** writes requirements but does not design the solution
- The **Architect** designs the solution but does not write production code
- The **Team-Leader** decomposes the design into batches but does not commit code
- The **Developer** implements code but does not commit (Team-Leader owns git)
- The **Review Lead** orchestrates reviewers but does not review code itself

This separation prevents scope creep in long-running sessions and keeps each agent's context window focused on a single responsibility.

---

## Communication via Plain Files

Agents communicate through files in the task folder, not through direct calls:

```
task-tracking/TASK_YYYY_NNN/
  task.md               ← Product Owner writes this
  context.md            ← Orchestrator writes this
  task-description.md   ← Project Manager writes this
  implementation-plan.md ← Architect writes this
  tasks.md              ← Team-Leader writes this
  completion-report.md  ← Build Worker writes this on finish
  code-logic-review.md  ← Logic Reviewer writes this
  code-style-review.md  ← Style Reviewer writes this
  code-security-review.md ← Security Reviewer writes this
  status                ← Single word: CREATED/IN_PROGRESS/etc.
```

This design means any agent can pick up mid-task by reading the existing files. It also means you can inspect or edit any artifact at any point in the pipeline.

---

## Where to Go Next

| Concept | What You Will Learn |
|---------|-------------------|
| [Tasks](tasks/) | task.md format, state machine, registry, folder structure |
| [Workers](workers/) | Build vs Review workers, health states, communication protocol |
| [Supervisor](supervisor/) | The 9-step control loop, dependency graph, recovery |
