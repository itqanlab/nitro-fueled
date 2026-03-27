---
title: First Run
description: Run your first orchestrated task with Nitro-Fueled.
---

This guide walks you through creating a task, running it through the full pipeline, and reading the output. By the end you will have watched a Build Worker implement a feature and a Review Worker validate it — all without writing a line of code yourself.

---

## Step 1: Write a Task

Every unit of work starts with a `task.md` file. Create your first task using the interactive scaffolder:

```bash
npx nitro-fueled create
```

Or create the folder and file manually. Tasks live in `task-tracking/TASK_YYYY_NNN/`:

```bash
mkdir task-tracking/TASK_2026_001
```

Create `task-tracking/TASK_2026_001/task.md` with the following content:

```markdown
# Task: Add user greeting to home page

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P2-Medium |
| Complexity | Simple   |

## Description

Add a personalized greeting to the home page that displays the current user's
name after they log in. The greeting should appear in the page header and read
"Welcome back, [name]". Fetch the user name from the existing auth context.

## Dependencies

- None

## Acceptance Criteria

- [ ] Greeting renders in the page header after login
- [ ] Greeting displays the authenticated user's name
- [ ] Greeting is hidden when the user is not logged in
- [ ] No changes to the auth logic itself

## References

- Auth context: src/context/AuthContext.tsx
- Header component: src/components/layout/Header.tsx
```

> **Tip:** The `Type` field controls which agent pipeline runs. `FEATURE` triggers the full PM → Architect → Team-Leader → Developer → QA sequence. Use `BUGFIX` for fixes, `REFACTORING` for restructuring, and `DEVOPS` for infrastructure changes.

---

## Step 2: Run the Task

You have two options depending on whether you want to run one task or the full backlog.

**Run a single task (recommended for your first run):**

```bash
npx nitro-fueled run TASK_2026_001
```

Or from inside Claude Code:

```
/orchestrate TASK_2026_001
```

**Run all ready tasks (Auto-Pilot / Supervisor loop):**

```bash
npx nitro-fueled run
```

Or from inside Claude Code:

```
/auto-pilot
```

---

## Step 3: Watch the Worker

When you run a task, the system:

1. Opens a new iTerm2 tab labeled with the task ID
2. Spawns a fresh Claude Code session with `--dangerously-skip-permissions`
3. Sends the full orchestration prompt to the worker

You will see the worker progress through phases in the iTerm2 tab:

| Phase | Agent | What It Produces |
|-------|-------|-----------------|
| Phase 0 | Orchestrator | `context.md` — task scope and strategy |
| Phase 1 | Project Manager | `task-description.md` — formal requirements |
| Phase 2 | Architect | `implementation-plan.md` — design decisions |
| Phase 3 | Team-Leader | `tasks.md` — atomic implementation batches |
| Phase 4 | Developer | Code commits for each batch |
| Phase 5 | Review Lead | Logic, style, and security review reports |

The worker writes all output files to `task-tracking/TASK_2026_001/` as it progresses.

---

## Step 4: Watch the State Transitions

The task state is stored in `task-tracking/TASK_2026_001/status`. You can watch it change:

```bash
watch cat task-tracking/TASK_2026_001/status
```

The state machine:

```
CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE
```

If the Build Worker finishes successfully, the state moves to `IMPLEMENTED` and a Review Worker is automatically spawned. When the review passes, the state moves to `COMPLETE`.

> **Tip:** If a worker gets stuck or fails, the state moves to `FAILED`. You can retry by resetting the status file to `CREATED` and running the task again.

---

## Step 5: Read the Results

When the task reaches `COMPLETE`, read the completion report:

```bash
cat task-tracking/TASK_2026_001/completion-report.md
```

The report contains:

- Summary of what was implemented
- Files created and modified (with commit SHAs)
- QA findings and how they were resolved
- Acceptance criteria verification

Check the task folder for all generated artifacts:

```
task-tracking/TASK_2026_001/
  task.md                  # Your original task definition
  context.md               # PM scope document
  task-description.md      # Formal requirements
  implementation-plan.md   # Architect's design
  tasks.md                 # Team-Leader's task breakdown
  completion-report.md     # Final summary
  code-logic-review.md     # Logic review findings
  code-style-review.md     # Style review findings
  code-security-review.md  # Security review findings
```

---

## Common Gotchas

**The worker asks for confirmation and hangs**

Workers run with `--dangerously-skip-permissions` by default. If you see a confirmation prompt in the iTerm2 tab, the MCP configuration may be missing the permissions flag. Check your `.mcp.json`.

**The task state stays at IN_PROGRESS indefinitely**

Check the worker iTerm2 tab for errors. Common causes: the project has no `package.json` and the stack was not detected, the MCP server lost connection, or the worker hit an unrecoverable error. Read the last few lines of the session JSONL at `~/.claude/projects/` to diagnose.

**The Review Worker fails after the Build Worker succeeds**

Review failures are expected — the Review Worker found real issues. Read `code-logic-review.md` for the specific findings. If you want to re-run just the review phase, reset the status file to `IMPLEMENTED` and run the task again.

---

## See Also

- [Core Concepts](../concepts/) — Understand tasks, workers, and the Supervisor
- [Task Format](../task-format/) — Full field reference for `task.md`
- [Commands Reference](../commands/) — All available commands
- [Auto-Pilot Guide](../auto-pilot/) — Run multiple tasks in parallel
