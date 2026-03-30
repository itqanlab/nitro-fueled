# Code Style Review — TASK_2026_113

## Score: 6/10

## Findings

### MAJOR — Step numbering violates established review lesson (nitro-create-task.md, nitro-retrospective.md)

Both `nitro-create-task.md` and `nitro-retrospective.md` insert the new commit step as `Step 5b`, slotted between an existing `Step 5` and `Step 6` (create-task) or inside an existing `Step 5` subsection hierarchy (retrospective).

This directly violates a rule that already exists in `.claude/review-lessons/review-general.md`:

> "Step numbering in command docs must be flat and sequential — using mixed schemes (Step 5, Step 5b, Step 5c) signals to future contributors that insertions should continue the sub-letter pattern rather than renumber. This creates unbounded lettered sub-steps and makes cross-references fragile. Use flat sequential numbers (5, 6, 7) or group validation steps under a named section heading with its own sequential list." (TASK_2026_043)

For `nitro-create-task.md`: the new step at line 127 should be numbered Step 6, with the existing Step 6 renumbered to Step 7 and Step 7 to Step 8. The step heading in the `## Important Rules` section (rule 3) references "Step 5" by concept, not number, so renumbering does not break that cross-reference.

For `nitro-retrospective.md`: the new step is sub-labeled `5b` inside a three-level hierarchy (`Step 5 > 5a, 5b, 5c, 5d`). The `5b` label makes Step 5 now have four sub-steps. This specific insertion does not break sequential ordering within the sub-step list, but it still uses the sub-letter scheme that the lesson flags as fragile. This is the lesser of the two violations — still minor but noted.

### MAJOR — Sequencing logic error: retrospective commit is placed before auto-apply writes (nitro-retrospective.md)

`Step 5b` (lines 133-142) commits the retrospective report and conditionally stages `.claude/review-lessons/` and `.claude/anti-patterns.md`. However, the step that actually writes to those files is `Step 5c` (lines 144-151), which runs AFTER 5b.

The comment inside the 5b code block reads:

```bash
# If review-lessons or anti-patterns were modified in this run:
git add .claude/review-lessons/ .claude/anti-patterns.md
```

At the point this commit runs, no auto-applied lesson or anti-pattern writes have occurred yet — 5c has not executed. The conditional `git add` will always be a no-op, and the actual lesson/anti-pattern changes will remain uncommitted (orphaned untracked/unstaged files), which is the exact problem this task was created to fix.

The commit either needs to move to after Step 5c, or Step 5c must be reordered to run before 5b.

### MINOR — Code block language tags are inconsistent in SKILL.md

The three new commit instruction blocks in `SKILL.md` use different fence styles:

- Phase 0 block (lines 122-125): plain fence (no language tag)
- Post-PM block (lines 183-188): indented code block inside a bullet, plain fence
- Post-Architect block (lines 190-194): same indented plain fence

The rest of `SKILL.md` uses ` ```bash ` for shell commands (e.g., lines 256-258, lines 510-525, lines 547-548). The new blocks should use ` ```bash ` for consistency with the surrounding document. The `nitro-review-lead.md` new block correctly uses ` ```bash ` (line 244). The two command files also use ` ```bash ` for their new blocks. Only the SKILL.md additions are missing the language tag.

### MINOR — Placeholder notation is inconsistent across files

The four new commit blocks use three different placeholder styles for the task ID:

| File | Placeholder style | Example |
|------|-------------------|---------|
| SKILL.md (Phase 0, PM, Architect) | `TASK_[ID]` | `TASK_[ID]` |
| nitro-review-lead.md | `TASK_{TASK_ID}` | `TASK_{TASK_ID}` |
| nitro-create-task.md | `TASK_YYYY_NNN` | `TASK_YYYY_NNN` |
| nitro-retrospective.md | `RETRO_[DATE]` / `RETRO_{YYYY-MM-DD}` | mixed within same file |

Each file uses the notation already established in that file, so no single file is internally inconsistent. However, the retrospective file itself mixes `[DATE]` in the commit message (line 141: `docs(retro): add RETRO_[DATE] retrospective`) and `{YYYY-MM-DD}` in the step heading and file path (lines 66-68). This within-file inconsistency is a genuine minor issue.

### INFO — nitro-create-task.md Important Rules section is not updated to mention Step 5b

The `## Important Rules` section at the bottom of `nitro-create-task.md` (lines 172-178) lists 6 rules. Rule 3 reads: "Write status file immediately after creating the task folder". There is no corresponding rule that mentions committing after writing the status file. This is an oversight — the new Step 5b is load-bearing behavior but has no reinforcement in the rules list. Given that the existing completion bookkeeping rules in SKILL.md are reinforced in the Key Principles section, the omission here is inconsistent.

### INFO — nitro-review-lead.md: new commit block has no error handling note

Every other commit block added in this task includes implicit or explicit handling via the surrounding context. The review-lead commit block at lines 241-247 sits inside "### After All Sub-Workers Finish" with no note about what to do if the commit fails (e.g., hook failure, nothing to commit if all sub-workers failed and no reports were written). The surrounding Phase 4 fix commit at line 274-277 has the same gap, so this is consistent with existing style, but worth noting given that review report `git add` with a wildcard (`review-*.md`) could succeed with zero files if all sub-workers failed.

## Summary

Two findings require attention before this work can be considered clean: the step numbering in `nitro-create-task.md` violates an already-documented review lesson, and the retrospective commit block is sequenced before the auto-apply step that populates the files it conditionally stages — meaning the lesson and anti-pattern file changes will be left uncommitted in every retrospective run. The remaining findings are style polish. Score 6/10.
