# Context — TASK_2026_136

## Task Type
REFACTORING

## Strategy
REFACTORING → Architect → Team-Leader → Review Lead → Completion

## User Intent
Optimize the JIT quality gate in parallel-mode.md to read only the metadata table from task.md instead of the full file, and cache the metadata per task ID to avoid re-reads on Review/Fix Worker spawns.

## Current State
- TASK_2026_134 (SKILL.md split) is COMPLETE
- Target file: `.claude/skills/auto-pilot/references/parallel-mode.md`
- JIT gate at Step 5a-jit currently reads the full task.md and validates Description/Acceptance Criteria — these validations require full file reads

## Key Decisions
- Drop Description length + Acceptance Criteria checks from JIT gate (body content — not in metadata table)
- Keep Type, Priority, Complexity, Model, Provider, preferred_tier, Testing, Poll Interval, Health Check Interval, Max Retries — all extractable from metadata table (~20 lines)
- Add `## Metadata Cache` table to session state.md format — keyed by task ID
- Review/Fix Worker spawns check cache before reading; if hit, skip file read
