# Context — TASK_2026_029

## User Intent

Fix two related bugs found in e2e testing:
1. (BUG-6) anti-patterns.md ships with Angular/Tailwind/database rules to plain HTML/CSS/JS projects
2. (BUG-7) workers did not consult anti-patterns during implementation

Three-part fix:
- Part A: Generate stack-aware anti-patterns at init using detected stack
- Part B: Planner updates anti-patterns when tech choices are made during /plan
- Part C: Build workers check anti-patterns before submitting; review workers reference them

## Strategy

FEATURE — Medium complexity. Full workflow.
- Scope is clearly defined in task.md
- No PM/Architect needed — user pre-approved, skip validation checkpoints
- Primary developer: systems-developer (orchestration/skill files) + backend-developer (CLI TypeScript)

## Key Files

- `packages/cli/scaffold/.claude/anti-patterns.md` — current generic file (will become universal set)
- `packages/cli/scaffold/.claude/anti-patterns-master.md` — NEW: master with all tags
- `packages/cli/src/utils/anti-patterns.ts` — NEW: generation utility
- `packages/cli/src/commands/init.ts` — integrate anti-patterns generation after stack detect
- `.claude/skills/orchestration/SKILL.md` — add anti-patterns to Build Worker Exit Gate
- `.claude/agents/code-style-reviewer.md` + `code-logic-reviewer.md` — reference anti-patterns
- `.claude/agents/planner.md` — add tech-choice → anti-patterns update logic
