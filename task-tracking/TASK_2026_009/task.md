# Task: CLI init Command

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Complex |

## Description

Implement the `npx nitro-fueled init` command that scaffolds the orchestration system into any project directory.

**What init does:**

1. **Check prerequisites**: Verify Claude Code CLI is available, check if `.claude/` already exists (offer merge/overwrite)

2. **Copy core agents**: Copy all core agent files (planner, project-manager, software-architect, team-leader, systems-developer, reviewers, researcher, senior-tester) from the scaffold directory into `.claude/agents/`

3. **Copy skills and commands**: Copy orchestration skill, supervisor skill, and all commands into `.claude/skills/` and `.claude/commands/`

4. **Create task-tracking structure**: Create `task-tracking/` with `registry.md` and `task-template.md`

5. **Copy review-lessons structure**: Create `.claude/review-lessons/` with empty template files

6. **AI-assisted stack detection** (from TASK_2026_006): Read the codebase, detect languages/frameworks/tools, propose developer agents, generate project-specific agents on approval

7. **Generate CLAUDE.md**: Create or update the project's CLAUDE.md with orchestration conventions

8. **Summary**: Display what was installed and next steps

## Dependencies

- TASK_2026_008 — CLI scaffold must exist
- TASK_2026_015 — Stack detection registry and developer template
- TASK_2026_016 — /create-agent command for dynamic agent generation

## Acceptance Criteria

- [ ] `npx nitro-fueled init` runs without errors on a fresh project
- [ ] Core agents copied to `.claude/agents/`
- [ ] Skills and commands copied to `.claude/skills/` and `.claude/commands/`
- [ ] `task-tracking/` created with registry and template
- [ ] Stack detection proposes appropriate developer agents
- [ ] Project-specific agents generated on approval
- [ ] Existing `.claude/` handled gracefully (merge/overwrite prompt)
- [ ] Summary displayed with next steps

## References

- Design doc: `docs/claude-orchestrate-package-design.md`
- TASK_2026_006: Dynamic agent/skill generation
- Scaffold source: `packages/cli/scaffold/` (to be created)
