# Development Tasks - TASK_2026_051

**Total Tasks**: 4 | **Batches**: 1 | **Status**: 1/1 complete

## Batch 1: Rename all 22 agent files to nitro- prefix and update all references - COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 4 | **Dependencies**: None

### Task 1.1: Rename agent files in both locations

**File**: `.claude/agents/` and `packages/cli/scaffold/.claude/agents/`
**Status**: COMPLETE

All 22 agent files renamed using `git mv` in both locations:
- `.claude/agents/planner.md` -> `.claude/agents/nitro-planner.md`
- `.claude/agents/project-manager.md` -> `.claude/agents/nitro-project-manager.md`
- `.claude/agents/software-architect.md` -> `.claude/agents/nitro-software-architect.md`
- `.claude/agents/team-leader.md` -> `.claude/agents/nitro-team-leader.md`
- `.claude/agents/backend-developer.md` -> `.claude/agents/nitro-backend-developer.md`
- `.claude/agents/frontend-developer.md` -> `.claude/agents/nitro-frontend-developer.md`
- `.claude/agents/systems-developer.md` -> `.claude/agents/nitro-systems-developer.md`
- `.claude/agents/devops-engineer.md` -> `.claude/agents/nitro-devops-engineer.md`
- `.claude/agents/senior-tester.md` -> `.claude/agents/nitro-senior-tester.md`
- `.claude/agents/code-logic-reviewer.md` -> `.claude/agents/nitro-code-logic-reviewer.md`
- `.claude/agents/code-style-reviewer.md` -> `.claude/agents/nitro-code-style-reviewer.md`
- `.claude/agents/code-security-reviewer.md` -> `.claude/agents/nitro-code-security-reviewer.md`
- `.claude/agents/visual-reviewer.md` -> `.claude/agents/nitro-visual-reviewer.md`
- `.claude/agents/ui-ux-designer.md` -> `.claude/agents/nitro-ui-ux-designer.md`
- `.claude/agents/technical-content-writer.md` -> `.claude/agents/nitro-technical-content-writer.md`
- `.claude/agents/researcher-expert.md` -> `.claude/agents/nitro-researcher-expert.md`
- `.claude/agents/modernization-detector.md` -> `.claude/agents/nitro-modernization-detector.md`
- `.claude/agents/review-lead.md` -> `.claude/agents/nitro-review-lead.md`
- `.claude/agents/test-lead.md` -> `.claude/agents/nitro-test-lead.md`
- `.claude/agents/unit-tester.md` -> `.claude/agents/nitro-unit-tester.md`
- `.claude/agents/integration-tester.md` -> `.claude/agents/nitro-integration-tester.md`
- `.claude/agents/e2e-tester.md` -> `.claude/agents/nitro-e2e-tester.md`
All 22 also renamed in `packages/cli/scaffold/.claude/agents/`.

### Task 1.2: Update agent-map.ts

**File**: `packages/cli/src/utils/agent-map.ts`
**Status**: COMPLETE

Updated `ui-ux-designer` agentName to `nitro-ui-ux-designer`. Other entries are project-specific agents (nextjs-developer, react-developer, etc.) that are not in the rename scope.

### Task 1.3: Update YAML frontmatter and internal references in all 22 agent files

**File**: `.claude/agents/nitro-*.md` and `packages/cli/scaffold/.claude/agents/nitro-*.md`
**Status**: COMPLETE

- Updated YAML `name:` field in all 22 agent files in both locations to use `nitro-` prefix.
- Updated internal references (e.g., "See team-leader.md" -> "See nitro-team-leader.md", "You are project-manager" -> "You are nitro-project-manager") in agent files that reference other agents.

### Task 1.4: Update all skill, command, and reference files

**Files Updated**:
- `.claude/skills/orchestration/SKILL.md` - Updated agent name references in tables and inline references
- `.claude/skills/orchestration/references/agent-catalog.md` - Updated all subagent_type values and prose references (22 agents)
- `.claude/skills/orchestration/references/strategies.md` - Updated agent name references in flow diagrams and tables
- `.claude/skills/orchestration/references/team-leader-modes.md` - Updated subagent_type and prose references
- `.claude/skills/orchestration/references/checkpoints.md` - Updated subagent_type in QA invocation patterns
- `.claude/skills/orchestration/examples/feature-trace.md` - Updated subagent_type in example code
- `.claude/skills/orchestration/examples/bugfix-trace.md` - Updated subagent_type in example code
- `.claude/skills/orchestration/examples/creative-trace.md` - Updated subagent_type in example code
- `.claude/commands/orchestrate.md` - Updated Quick Reference agents list
- `.claude/commands/create-agent.md` - Updated quality reference file paths
- All mirror files in `packages/cli/scaffold/.claude/` updated identically
**Status**: COMPLETE
