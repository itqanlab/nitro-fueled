# Task: Fix Retrospective Commit Step Ordering

## Metadata

| Field                 | Value        |
|-----------------------|--------------|
| Type                  | BUGFIX       |
| Priority              | P2-Medium    |
| Complexity            | Simple       |
| Preferred Tier        | light        |
| Model                 | default      |
| Testing               | skip         |
| Poll Interval         | default      |
| Health Check Interval | default      |
| Max Retries           | default      |

## Description

The `/nitro-retrospective` command's Step 5b commit block fires before Step 5c auto-applies new lessons and anti-pattern entries to `review-lessons/` and `anti-patterns.md`. As a result, any lessons appended during a retro run are never staged in the retro commit — they remain as uncommitted local changes. The fix is to reorder the steps in `.claude/commands/nitro-retrospective.md` so that Step 5c (auto-apply writes to `review-lessons/` and `anti-patterns.md`) executes before Step 5b (the git commit), and the commit block is updated to unconditionally include `git add .claude/review-lessons/ .claude/anti-patterns.md` before committing.

## Dependencies

- None

## Acceptance Criteria

- [ ] Step 5c (auto-apply writes) executes before Step 5b (git commit) in the retrospective skill
- [ ] The `git add` block in Step 5b unconditionally includes `.claude/review-lessons/` and `.claude/anti-patterns.md`
- [ ] A manual retrospective run that produces a new lesson results in that lesson being included in the retro commit
- [ ] The idempotency rule (skip if same scope tag already applied) still functions correctly after the reorder

## References

- `.claude/commands/nitro-retrospective.md` — the file to fix
- TASK_2026_113 logic review — identified this ordering bug (retrospective commit step ordering finding)
- RETRO_2026-03-28_3 — confirmed and proposed this as a fix task

## File Scope

- `.claude/commands/nitro-retrospective.md`

## Parallelism

✅ Can run in parallel — no other CREATED task touches `.claude/commands/nitro-retrospective.md`.
