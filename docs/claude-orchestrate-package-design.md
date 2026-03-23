# claude-orchestrate — Reusable AI Development Orchestration Package

## Vision

Package the orchestration workflow into a reusable tool that can be installed into any project. User writes tasks, hits run, and the system handles the full PM -> Architect -> Dev -> QA pipeline autonomously.

## Architecture

### Nx Workspace (new repo)

Single Nx workspace containing everything:

```
claude-orchestrate/
  packages/
    cli/                    # npx claude-orchestrate init|run|status
    mcp-session-orchestrator/  # MCP server (keep as separate package, link from existing repo)
    scaffold/               # Template files copied during init

  scaffold/                 # What gets copied into target projects
    .claude/
      agents/               # All 14 agent definitions (PM, Architect, Dev, QA, reviewers, etc.)
      skills/               # orchestration, auto-pilot, review skills
      commands/             # /orchestrate, /review-*, /auto-pilot
      anti-patterns.md      # Starter checklist (generic, not project-specific)
      review-lessons/       # Empty structure — fills up from QA reviews
        review-general.md
        backend.md
        frontend.md
    task-tracking/           # Task tracking folder
      registry.md            # Auto-generated, tracks all tasks
```

### MCP Server

- Lives in its own repo (existing `/Volumes/SanDiskSSD/mine/session-orchestrator/`)
- Referenced/linked from the Nx workspace, not duplicated
- No npm publishing needed — local path reference

## Task Structure

Tasks live inside `task-tracking/`, one folder per task (same as current):

```
task-tracking/
  registry.md              # Index of all tasks + status
  TASK_001/
    task.md                # Task definition (created by user or PM)
    context.md             # Orchestration context (auto-generated)
    implementation-plan.md # Architect output
    tasks.md               # Team-leader breakdown
    completion-report.md   # Final report
    review-logic.md        # QA output
    review-style.md
    review-security.md
  TASK_002/
    task.md                # Status visible from file: CREATED | IN_PROGRESS | COMPLETE | FAILED
    ...
```

### Task Lifecycle (visible from folder state)

| Files present | Status |
|---------------|--------|
| Only `task.md` | CREATED — user wrote it, not started |
| `task.md` + `context.md` | IN_PROGRESS — orchestration started |
| `task.md` + `context.md` + `completion-report.md` | COMPLETE |
| `task.md` + `context.md` + no completion | FAILED or stuck |

### task.md Template

```markdown
# Task: [Title]

## Description
[What needs to be built/fixed/changed]

## Dependencies
- [Task IDs this depends on, if any]

## Acceptance Criteria
- [What "done" looks like]

## References
- [Files, docs, or links relevant to this task]
```

## CLI Commands

```bash
npx claude-orchestrate init          # Scaffold .claude/ + task-tracking/ into current project
npx claude-orchestrate create        # Interactive task creation -> writes task.md
npx claude-orchestrate run           # Auto-pilot: pick next tasks, spawn workers, monitor, loop
npx claude-orchestrate run T001      # Run specific task
npx claude-orchestrate status        # Show task statuses, active workers, costs
```

## Auto-Pilot Loop

```
1. Read registry.md + task folders -> build dependency graph
2. Find unblocked tasks (deps all COMPLETE, status CREATED)
3. Pick next 1-2 tasks
4. Generate orchestration prompt from task.md
5. Spawn worker via MCP session-orchestrator
6. Monitor every 10min (health, stuck detection)
7. On worker complete:
   a. Verify deliverables exist
   b. Kill worker if stuck post-completion
   c. Update registry
   d. If incomplete, spawn continuation worker
8. Loop back to step 1
```

## Main Session State Preservation

To survive compactions in long-running orchestrator sessions:

- **`task-tracking/orchestrator-state.md`** — written after every worker event:
  - Active workers (ID, task, status, cost)
  - Completed tasks this session
  - Next tasks in queue
  - After compaction, orchestrator re-reads this file to recover context

## What Gets Copied (not rewritten)

The package copies the proven orchestration setup, making it generic:
- All 14 agent definitions
- All skills (orchestration, review, etc.)
- All commands (/orchestrate, /review-code, /review-logic, /review-security)
- Anti-patterns checklist (genericized)
- Review-lessons structure (empty, learns per project)
- Task tracking folder structure

The agents/skills are the SAME ones — not rewritten. Just parameterized where they reference project-specific paths.

## PM Agent Discussion

The PM agent is the biggest challenge for generalization:
- Currently burns 2M+ tokens scanning codebase unboundedly
- Needs to be rewritten to be scoped and efficient
- For the package: PM should discover project context dynamically, not assume specific doc locations
- Open question: how much PM ceremony is needed? BDD/stakeholder matrices are overkill for most tasks

### PM Agent Options
1. **Minimal PM** — skip PM entirely for tasks with detailed specs (like our current approach)
2. **Scoped PM** — PM reads only: task.md + README + package.json/project structure, produces brief context.md
3. **Full PM** — current behavior but bounded (token budget, file count limit, no enterprise ceremony)

Recommendation: Default to option 2 (scoped), allow override to skip or use full.

## Open Questions

1. How to handle project-specific anti-patterns vs generic ones?
2. Should the package detect the tech stack and adjust agent prompts?
3. How to handle the MCP server dependency (user needs iTerm2 + session-orchestrator running)?
4. License model — open source?
