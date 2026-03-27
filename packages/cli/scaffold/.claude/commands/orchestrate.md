# Orchestrate Development Workflow

Invoke the orchestration skill for development workflows.

## Usage

```
/orchestrate [task description]     # New task
/orchestrate TASK_2025_XXX          # Continue existing task
```

## Execution

1. Load `.claude/skills/orchestration/SKILL.md`
2. Follow the Workflow Selection Matrix to determine strategy
3. Execute the chosen strategy (invoke agents, handle checkpoints)
4. Load references as needed during execution:
   - `references/strategies.md` - Strategy details and flows
   - `references/agent-catalog.md` - Agent profiles and invocation
   - `references/team-leader-modes.md` - MODE 1/2/3 integration
   - `references/task-tracking.md` - Folder structure and registry
   - `references/checkpoints.md` - User validation templates
   - `references/git-standards.md` - Commit rules and hook handling

## Quick Reference

**Strategies**: FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE

**Agents** (13): nitro-project-manager, nitro-software-architect, nitro-team-leader, nitro-backend-developer, nitro-frontend-developer, nitro-devops-engineer, nitro-senior-tester, nitro-code-style-reviewer, nitro-code-logic-reviewer, nitro-researcher-expert, nitro-modernization-detector, nitro-ui-ux-designer, nitro-technical-content-writer

**Checkpoints**: Scope Clarification, Requirements Validation, Architecture Validation, QA Choice

## Skill Path

`.claude/skills/orchestration/SKILL.md`
