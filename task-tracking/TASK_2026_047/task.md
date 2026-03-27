# Task: Unified /run, /create, /status Commands + CLI Single-Task Run

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

The CLI and slash commands should present the same interface. Currently users must know internal terms ("orchestrate" vs "auto-pilot") and choose the right one. This task creates unified commands that route intelligently, plus adds single-task support to the CLI `run` command.

### Part A — Unified slash commands (inside Claude)

Create three new slash commands that mirror the CLI:

**`/run [TASK_ID]`**
- No argument → invoke `/auto-pilot` (batch mode, all unblocked tasks)
- With TASK_ID → invoke `/orchestrate TASK_ID` (single task, inline)
- Both paths should write to the unified session log (once TASK_2026_034 ships)

**`/create [description]`**
- No `--quick` flag → invoke `/plan [description]` (Planner discussion)
- With `--quick` → invoke `/create-task [description]` (form-based)

**`/status`**
- Invoke `/project-status`
- Simple alias, no routing logic needed

The existing commands (`/orchestrate`, `/auto-pilot`, `/plan`, `/create-task`, `/project-status`) remain as power-user direct access. The new commands are thin routers.

### Part B — CLI `run` single-task support

Update `packages/cli/src/commands/run.ts` to accept an optional task ID argument:

```bash
npx nitro-fueled run                     # auto-pilot (batch)
npx nitro-fueled run TASK_2026_043       # orchestrate single task
npx nitro-fueled run --task 043          # shorthand (auto-prefixes TASK_2026_)
```

When a task ID is provided, spawn Claude with `/orchestrate TASK_ID` instead of `/auto-pilot`.

### Part C — Scaffold sync

Copy the new slash commands to `packages/cli/scaffold/.claude/commands/` so new projects get them on `init`.

## Dependencies

- None (does not depend on TASK_2026_034, but designed to work with it once it ships)

## Acceptance Criteria

- [ ] `/run` with no args invokes auto-pilot
- [ ] `/run TASK_2026_XXX` invokes orchestration for that single task
- [ ] `/create` with no args invokes Planner discussion
- [ ] `/create --quick` invokes form-based task creation
- [ ] `/status` shows project status
- [ ] CLI `npx nitro-fueled run TASK_ID` orchestrates a single task
- [ ] CLI `npx nitro-fueled run --task 043` works as shorthand
- [ ] Existing commands (`/orchestrate`, `/auto-pilot`, `/plan`, `/create-task`, `/project-status`) still work
- [ ] New commands copied to scaffold for `init`

## References

- `.claude/commands/auto-pilot.md` — current auto-pilot command
- `.claude/commands/orchestrate.md` — current orchestrate command
- `.claude/commands/plan.md` — current plan command
- `.claude/commands/create-task.md` — current create-task command
- `.claude/commands/project-status.md` — current status command
- `packages/cli/src/commands/run.ts` — CLI run command
- `packages/cli/src/commands/create.ts` — CLI create command (reference for routing pattern)

## File Scope

- `.claude/commands/run.md`
- `.claude/commands/create.md`
- `.claude/commands/status.md`
- `packages/cli/src/commands/run.ts`
- `packages/cli/scaffold/.claude/commands/run.md`
- `packages/cli/scaffold/.claude/commands/create.md`
- `packages/cli/scaffold/.claude/commands/status.md`
