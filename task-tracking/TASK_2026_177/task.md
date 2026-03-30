# Task: Scaffold-SKILL.md Sync Automation

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | DEVOPS      |
| Priority              | P2-Medium   |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |

## Description

Add a pre-commit hook or CI check that detects when a `.claude/` file is modified but the corresponding `apps/cli/scaffold/.claude/` copy is not updated in the same commit. Divergence between source and scaffold was found in 4 task reviews (122, 129, 137, 154) — each time acknowledged as "pre-existing" but never fixed systematically.

The check should compare file checksums between the two directories and fail with a clear message listing which files are out of sync.

## Dependencies

- None

## Acceptance Criteria

- [ ] Script or hook that compares `.claude/` files with `apps/cli/scaffold/.claude/` counterparts
- [ ] Detects files present in source but missing from scaffold
- [ ] Detects files with differing content (checksum mismatch)
- [ ] Clear error message listing divergent files
- [ ] Integrated as pre-commit hook or CI step

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Acknowledged-but-Unfixed
- Review files: TASK_2026_122, 129, 137, 154

## File Scope

- scripts/check-scaffold-sync.sh (new)
- .husky/pre-commit or .github/workflows/ (integration point)

## Parallelism

✅ Can run in parallel — CI/tooling concern, no overlap with feature/refactor tasks
