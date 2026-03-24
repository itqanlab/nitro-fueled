# Task: CLI create Command

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P2-Medium |
| Complexity | Simple   |

## Description

Implement the `npx nitro-fueled create` command that provides interactive task creation by invoking the Planner or create-task flow.

**What create does:**
- By default, starts a Claude Code session with `/plan` (Planner-driven, discussion-based)
- With `--quick` flag, uses `/create-task` for form-based creation
- Passes through any description text as arguments

**Usage:**
```
npx nitro-fueled create                              # Start Planner discussion
npx nitro-fueled create "add payment processing"     # Planner with pre-filled intent
npx nitro-fueled create --quick                      # Form-based creation
npx nitro-fueled create --quick "fix login bug"      # Quick creation with description
```

## Dependencies

- TASK_2026_008 — CLI scaffold must exist

## Acceptance Criteria

- [ ] `npx nitro-fueled create` starts a Planner session
- [ ] Description text passed as arguments to Planner
- [ ] `--quick` flag uses `/create-task` instead
- [ ] Pre-flight check: verify workspace is initialized
- [ ] Clear help text showing usage examples

## References

- Planner agent: `.claude/agents/planner.md`
- /plan command: `.claude/commands/plan.md`
- /create-task command: `.claude/commands/create-task.md`
