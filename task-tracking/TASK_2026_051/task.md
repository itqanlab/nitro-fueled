# Task: Rename All Agents to `nitro-*` Prefix

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P0-Critical  |
| Complexity | Medium       |

## Description

Rename every agent file shipped by nitro-fueled to use a `nitro-` prefix. This prevents naming conflicts when installing into a project that already has its own agents, and makes ownership explicit.

### Rename map

| Current name | New name |
|---|---|
| `planner.md` | `nitro-planner.md` |
| `project-manager.md` | `nitro-project-manager.md` |
| `software-architect.md` | `nitro-software-architect.md` |
| `team-leader.md` | `nitro-team-leader.md` |
| `backend-developer.md` | `nitro-backend-developer.md` |
| `frontend-developer.md` | `nitro-frontend-developer.md` |
| `systems-developer.md` | `nitro-systems-developer.md` |
| `devops-engineer.md` | `nitro-devops-engineer.md` |
| `senior-tester.md` | `nitro-senior-tester.md` |
| `code-logic-reviewer.md` | `nitro-code-logic-reviewer.md` |
| `code-style-reviewer.md` | `nitro-code-style-reviewer.md` |
| `code-security-reviewer.md` | `nitro-code-security-reviewer.md` |
| `visual-reviewer.md` | `nitro-visual-reviewer.md` |
| `ui-ux-designer.md` | `nitro-ui-ux-designer.md` |
| `technical-content-writer.md` | `nitro-technical-content-writer.md` |
| `researcher-expert.md` | `nitro-researcher-expert.md` |
| `modernization-detector.md` | `nitro-modernization-detector.md` |
| `review-lead.md` | `nitro-review-lead.md` |
| `test-lead.md` | `nitro-test-lead.md` |
| `unit-tester.md` | `nitro-unit-tester.md` |
| `integration-tester.md` | `nitro-integration-tester.md` |
| `e2e-tester.md` | `nitro-e2e-tester.md` |

Generated stack agents also use the prefix: `nitro-react-developer.md`, `nitro-swift-developer.md`, etc.

### What must be updated

1. **Agent files** — rename in both `.claude/agents/` and `packages/cli/scaffold/.claude/agents/`
2. **`agent-map.ts`** — update all `agentName` values
3. **Skill files** — every reference to an agent name in `SKILL.md`, `strategies.md`, `agent-catalog.md`, `team-leader-modes.md`, `checkpoints.md`, `auto-pilot/SKILL.md`
4. **Command files** — every agent reference in `/orchestrate`, `/auto-pilot`, `/plan`, `/run`, `/review-*`, etc.
5. **`review-lead.md` and `test-lead.md`** — internal references to sub-worker agent names
6. **`agent-catalog.md`** — all 22 agent entries
7. **Scaffold mirror** — all skill/command files in `packages/cli/scaffold/.claude/`

## Dependencies

- TASK_2026_049 must be COMPLETE before this runs — both modify `agent-map.ts`

## Parallelism

⚠️ **MUST RUN ALONE — NO PARALLEL TASKS.**

This task touches agent files, `agent-map.ts`, and references across ALL skill and command files. Running any other task concurrently risks merge conflicts on nearly every file in `.claude/`. The Supervisor must ensure no other worker is active when this task runs.

## Acceptance Criteria

- [ ] All 22 core agent files renamed to `nitro-*.md` in `.claude/agents/`
- [ ] All 22 core agent files renamed to `nitro-*.md` in `packages/cli/scaffold/.claude/agents/`
- [ ] `agent-map.ts` uses new `nitro-*` names for all entries
- [ ] Generated agent proposals use `nitro-` prefix (e.g., `nitro-react-developer`)
- [ ] Zero broken references — grep for all old names returns only this task's own files
- [ ] All skill files updated (orchestration, auto-pilot, review-lead, test-lead)
- [ ] All command files updated
- [ ] Claude Code still resolves agents by their new names (test: invoke one agent)
- [ ] TypeScript compiles cleanly

## File Scope

- `.claude/agents/*.md` (all 22 files — rename)
- `packages/cli/scaffold/.claude/agents/*.md` (all 22 files — rename)
- `packages/cli/src/utils/agent-map.ts`
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/orchestration/references/agent-catalog.md`
- `.claude/skills/orchestration/references/strategies.md`
- `.claude/skills/orchestration/references/team-leader-modes.md`
- `.claude/skills/orchestration/references/checkpoints.md`
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/agents/nitro-review-lead.md` (internal references)
- `.claude/agents/nitro-test-lead.md` (internal references)
- `.claude/commands/` (all command files that reference agent names)
- `packages/cli/scaffold/.claude/skills/` (mirror of above)
- `packages/cli/scaffold/.claude/commands/` (mirror of above)
