# Context — TASK_2026_106

## User Intent
Generalize orchestration lifecycle to be type-agnostic. Rename coding-centric artifact names (`implementation-plan.md` → `plan.md`) and document a Universal Lifecycle Flow that all task types follow.

## Strategy
REFACTORING — Architect → Team-Leader → Dev → QA

## Affected Files
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/orchestration/references/task-tracking.md`
- `.claude/skills/orchestration/references/strategies.md`
- `.claude/skills/orchestration/references/checkpoints.md`
- `.claude/skills/auto-pilot/SKILL.md`

## Key Changes
1. Rename `implementation-plan.md` → `plan.md` across all references
2. Add Universal Lifecycle Flow as top-level section in SKILL.md
3. Update phase detection logic to use `plan.md`
4. Update all strategy workflow diagrams and checkpoint definitions
