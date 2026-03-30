# Task: Rename Commands to nitro-* Prefix — Scaffold Sync — Part 2 of 2

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Testing    | skip        |

## Description

Sync the nitro-* command renames from `.claude/commands/` into the scaffold at `apps/cli/scaffold/.claude/commands/`. This is Part 2 of 2 — scaffold sync only. Part 1 (TASK_2026_116) handles the source directory.

Apply the same rename map as Part 1 to all 17 command files in `apps/cli/scaffold/.claude/commands/`. Ensure internal content matches the updated source files exactly after the rename.

## Dependencies

- TASK_2026_116 — source rename must complete first

## Acceptance Criteria

- [ ] All 17 files in `apps/cli/scaffold/.claude/commands/` renamed to `nitro-*` prefix
- [ ] Scaffold content matches source `.claude/commands/` content post-rename
- [ ] No old command names remain in scaffold command files

## References

- `apps/cli/scaffold/.claude/commands/` — files to rename
- TASK_2026_116 — Part 1 rename map

## File Scope

- `apps/cli/scaffold/.claude/commands/*.md` (17 files renamed)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_116 — depends on Part 1.

Suggested wave: Wave 2, after TASK_2026_116.
