# Task: Fix Workspace Agent Setup for Nitro-Fueled

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P0-Critical |
| Complexity | Medium      |

## Description

The current `.claude/agents/` directory contains agents with project-specific descriptions from the original Electron app (backend-developer references Node.js/SQLite/LanceDB, frontend-developer references Angular, devops-engineer references Electron Forge). The nitro-fueled project's actual work is writing markdown specifications, building a CLI package, and documentation — none of which matches these agent descriptions.

This task fixes the workspace setup for the nitro-fueled project itself:

1. **Create `systems-developer.md` agent**: A core agent for orchestration-level work — writing skill files, agent definitions, command files, markdown specifications, and orchestration infrastructure. This agent follows the same structure as all other agents (YAML frontmatter, integration with team-leader assignment, task lifecycle) but with capabilities focused on system specification and orchestration workflow development.

2. **Update existing agents to be project-agnostic**: Remove Electron/Angular/SQLite-specific references from the core agents (backend-developer, frontend-developer, devops-engineer). These agents will later become templates during the CLI build, but for now they should be generic enough to not mislead the orchestration flow when assigning work.

3. **Update agent-catalog.md**: Add systems-developer to the agent catalog reference so the team-leader and orchestration flow know when to assign it.

4. **Update orchestration references**: Ensure the team-leader modes and strategy references include systems-developer as an option for specification/orchestration tasks.

## Dependencies

- None

## Acceptance Criteria

- [ ] `systems-developer.md` agent created with proper YAML frontmatter and full structure
- [ ] systems-developer follows same integration pattern as other agents (team-leader can assign it)
- [ ] systems-developer capabilities cover: skill files, agent definitions, command files, markdown specs, orchestration workflow files
- [ ] backend-developer.md genericized (remove Electron/SQLite/LanceDB references)
- [ ] frontend-developer.md genericized (remove Angular-specific references)
- [ ] devops-engineer.md genericized (remove Electron Forge references)
- [ ] agent-catalog.md updated with systems-developer entry
- [ ] Team-leader assignment logic updated to include systems-developer for spec/orchestration tasks

## References

- Current agents: `.claude/agents/`
- Agent catalog: `.claude/skills/orchestration/references/agent-catalog.md`
- Team-leader modes: `.claude/skills/orchestration/references/team-leader-modes.md`
- Strategies: `.claude/skills/orchestration/references/strategies.md`
