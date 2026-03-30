# Task: Update Orchestration Examples and Agent References to Generalized Artifact Names

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Testing    | skip        |

## Description

Mechanical follow-up to TASK_2026_106. After the core orchestration files are updated with generalized artifact names (`plan.md` instead of `implementation-plan.md`, etc.), update all remaining reference files and examples to match.

This is a straightforward find-and-replace across the remaining files that reference the old artifact names.

### Changes

1. **feature-trace.md** — Update all `implementation-plan.md` → `plan.md` references
2. **bugfix-trace.md** — Update artifact references
3. **creative-trace.md** — Update artifact references
4. **team-leader-modes.md** — Update artifact references in mode definitions
5. **agent-catalog.md** — Update artifact references in agent capability descriptions
6. **developer-template.md** — Update artifact references in developer workflow
7. **agent-calibration.md** — Update artifact references

## Dependencies

- TASK_2026_106 — must complete first (defines the new artifact names)

## Acceptance Criteria

- [ ] All 3 example trace files updated with generalized artifact names
- [ ] team-leader-modes.md updated
- [ ] agent-catalog.md updated
- [ ] developer-template.md updated
- [ ] agent-calibration.md updated
- [ ] Zero references to `implementation-plan.md` remain in the orchestration skill directory

## References

- TASK_2026_106 for the artifact name mapping
- All files in `.claude/skills/orchestration/`

## File Scope

- .claude/skills/orchestration/examples/feature-trace.md
- .claude/skills/orchestration/examples/bugfix-trace.md
- .claude/skills/orchestration/examples/creative-trace.md
- .claude/skills/orchestration/references/team-leader-modes.md
- .claude/skills/orchestration/references/agent-catalog.md
- .claude/skills/orchestration/references/developer-template.md
- .claude/skills/orchestration/references/agent-calibration.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_106 — depends on it
- ✅ Can run in parallel with TASK_2026_099, TASK_2026_100 (no file overlap)
- Suggested execution wave: Wave 2, immediately after TASK_2026_106
