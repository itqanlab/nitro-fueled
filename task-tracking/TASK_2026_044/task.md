# Task: Pre-Flight Validation with Task Sizing Check

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |

## Description

Build a standalone pre-flight validation step that runs BEFORE the auto-pilot supervisor loop starts — NOT inside the supervisor context. This replaces TASK_2026_033 (cancelled) and absorbs its full scope plus sizing validation.

The pre-flight validation is a discrete step in the `/auto-pilot` command entry point. It reads the task registry and task files, runs all validations, reports findings, and then hands control to the supervisor. The supervisor never sees the validation logic — it only receives a clean "proceed" or "abort" signal.

### Validations to include

1. **Dependency check**: All task dependencies are satisfiable (referenced tasks exist and aren't FAILED/CANCELLED)
2. **Circular dependency detection**: No cycles in the dependency graph
3. **File scope overlap detection**: Warn when multiple concurrent tasks may edit the same files
4. **Task completeness check**: All tasks have required fields (description, acceptance criteria, type)
5. **MCP server health**: Verify session-orchestrator MCP is reachable before starting
6. **Task sizing validation**: For each CREATED task, check `task.md` against `sizing-rules.md`. Flag oversized tasks.

### Behavior on findings

- **Blocking issues** (circular deps, MCP unreachable): abort with clear error message
- **Warnings** (file overlap, missing fields, oversized tasks): log warning to session log, proceed unless user configured strict mode

### Key constraint

This MUST NOT run inside the supervisor context. It runs as a pre-step — reads tasks, validates, reports, done. The supervisor loop starts fresh afterward with its own context budget.

## Dependencies

- TASK_2026_043 — Task Sizing Validation (creates `sizing-rules.md` referenced by this task)

## Acceptance Criteria

- [ ] Pre-flight runs before the supervisor loop starts, not inside the supervisor context
- [ ] Dependency graph validated — missing or failed dependencies reported as blocking error
- [ ] Circular dependencies detected and reported as blocking error
- [ ] File scope overlaps detected and logged as warnings
- [ ] Missing task fields logged as warnings
- [ ] MCP server health checked before starting
- [ ] Oversized tasks flagged using rules from `sizing-rules.md`
- [ ] Blocking issues abort the supervisor with clear error message
- [ ] Warnings logged to orchestrator-state.md session log
- [ ] Pre-flight report printed to user before supervisor starts

## References

- `task-tracking/TASK_2026_033/task.md` — original pre-flight task (cancelled, absorbed here)
- `.claude/commands/auto-pilot.md` — auto-pilot entry point
- `.claude/skills/auto-pilot/SKILL.md` — supervisor startup logic
- `task-tracking/sizing-rules.md` — sizing limits (created by TASK_2026_043)
- `task-tracking/TASK_2026_027/task.md` — file scope tracking (enables overlap detection)

## File Scope

- `.claude/commands/auto-pilot.md`
- `.claude/skills/auto-pilot/SKILL.md`
