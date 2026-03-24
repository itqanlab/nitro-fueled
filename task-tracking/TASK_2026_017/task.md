# Task: /create-skill Command

## Metadata

| Field      | Value     |
|------------|-----------|
| Type       | FEATURE   |
| Priority   | P2-Medium |
| Complexity | Simple    |

## Description

Build the `/create-skill` command that generates a new skill directory and SKILL.md file. This is a standalone command with no dependency on the agent generation system.

The command reads an existing SKILL.md for pattern reference, gathers skill info (interactively or from arguments), generates a SKILL.md with proper YAML frontmatter and structure, creates the skill directory, and writes the file.

Split from TASK_2026_006 (CANCELLED — too large for a single worker session).

## Dependencies

- None

## Acceptance Criteria

- [ ] `create-skill.md` exists at `.claude/commands/`
- [ ] Under 200 lines
- [ ] Follows thin-wrapper command pattern from `create-task.md`
- [ ] Pre-flight checks verify `.claude/skills/` exists and skill doesn't already exist
- [ ] Reads existing SKILL.md for pattern reference
- [ ] Supports interactive mode (`/create-skill`) and pre-filled mode (`/create-skill [name] [description]`)
- [ ] Generated SKILL.md has YAML frontmatter with `name` and `description`
- [ ] Generated SKILL.md has trigger conditions section
- [ ] Creates directory at `.claude/skills/{skill-name}/`
- [ ] Displays summary with directory path and integration instructions

## References

- TASK_2026_006 implementation plan: `task-tracking/TASK_2026_006/implementation-plan.md` (Component 4)
- TASK_2026_006 tasks.md: `task-tracking/TASK_2026_006/tasks.md` (Batch 3, Task 3.2)
- Command pattern: `.claude/commands/create-task.md`
- Skill pattern: `.claude/skills/ui-ux-designer/SKILL.md`
