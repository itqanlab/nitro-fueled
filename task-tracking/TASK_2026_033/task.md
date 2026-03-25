# Task: Pre-Flight Validation Before Auto-Pilot Spawns Workers

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Simple      |

## Description

Before auto-pilot spawns any workers, it should validate the task graph and warn about potential issues. Currently the supervisor just reads the registry and starts spawning.

### Validations to add

1. **Dependency check**: All task dependencies are satisfiable (referenced tasks exist and aren't FAILED/CANCELLED)
2. **Circular dependency detection**: No cycles in the dependency graph
3. **File scope overlap detection**: Warn when multiple concurrent tasks may edit the same files (requires TASK_2026_027 file scope tracking)
4. **Task completeness check**: All tasks have required fields (description, acceptance criteria, type)
5. **MCP server health**: Verify session-orchestrator MCP is reachable before starting

If any validation fails:
- Blocking issues (circular deps, MCP unreachable): abort with error
- Warnings (file overlap, missing fields): log warning and ask for confirmation (or proceed in autonomous mode with warning logged)

## Dependencies

- TASK_2026_027 -- Shared Review Context and File Scope (for file overlap detection)

## Acceptance Criteria

- [ ] Dependency graph validated before first worker spawn
- [ ] Circular dependencies detected and reported as blocking error
- [ ] File scope overlaps detected and logged as warnings
- [ ] Missing task fields logged as warnings
- [ ] MCP server health checked before starting
- [ ] Blocking issues abort the supervisor with clear error message
- [ ] Warnings logged to orchestrator-state.md session log

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- ENH-10
- `.claude/skills/auto-pilot/SKILL.md` -- supervisor startup logic
- `task-tracking/registry.md` -- dependency source
