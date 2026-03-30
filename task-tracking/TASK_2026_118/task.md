# Task: /nitro-status Command — Registry-Only Project Status

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P2-Medium |
| Complexity | Simple  |
| Model      | default |
| Testing    | skip    |

## Description

Create a `/nitro-status` command that returns a compact project status report by reading `task-tracking/registry.md` only — no individual `task.md` files. This replaces the current `/status` command with an explicit, efficient implementation that avoids context bloat.

The command must output:
- Counts by status: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, BLOCKED, COMPLETE, CANCELLED
- A table of all non-complete tasks (ID, Status, Type, Description)
- What's next: CREATED tasks with no unresolved dependencies

Reading individual task.md files is explicitly forbidden in this command.

## Dependencies

- TASK_2026_116 — commands must be renamed to nitro-* first

## Acceptance Criteria

- [ ] `/nitro-status` command file created in `.claude/commands/nitro-status.md`
- [ ] Command reads `task-tracking/registry.md` only — no task.md reads
- [ ] Output includes status counts and non-complete task table
- [ ] Command also synced to `apps/cli/scaffold/.claude/commands/nitro-status.md`

## References

- `task-tracking/registry.md` — only file this command reads
- `.claude/commands/` — destination for command file

## File Scope

- `.claude/commands/nitro-status.md` (new file)
- `apps/cli/scaffold/.claude/commands/nitro-status.md` (new file)

## Parallelism

✅ Can run in parallel with TASK_2026_119 — no file scope overlap.

🚫 Do NOT run in parallel with TASK_2026_116 or TASK_2026_117 — wait for rename to complete.

Suggested wave: Wave 3, after TASK_2026_116 and TASK_2026_117.
