# Task: Add --commit Flag to nitro-fueled init

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Simple      |

## Description

After `nitro-fueled init`, all scaffolded files (56 files in the e2e test) remain untracked. The workers commit their own code changes but not the setup scaffolding. This is fine as default behavior (non-destructive), but users should have the option to commit the setup in one step.

### Fix

Add a `--commit` flag to `nitro-fueled init`:
- `npx nitro-fueled init` -- scaffold only (current behavior, remains default)
- `npx nitro-fueled init --commit` -- scaffold + stage all scaffolded files + commit with message `chore: initialize nitro-fueled orchestration`

The commit should only include files created by init, not any pre-existing uncommitted changes.

## Dependencies

- None

## Acceptance Criteria

- [ ] `nitro-fueled init --commit` stages and commits all scaffolded files
- [ ] Commit message is `chore: initialize nitro-fueled orchestration`
- [ ] Only files created by init are staged (not pre-existing uncommitted changes)
- [ ] `nitro-fueled init` (without flag) behavior unchanged
- [ ] If git is not initialized, `--commit` shows an error message

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-9, ENH-9
- `packages/cli/` -- CLI implementation
- Test project git status -- 56 untracked files after init
