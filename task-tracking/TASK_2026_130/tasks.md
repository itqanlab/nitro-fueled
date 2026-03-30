# Development Tasks - TASK_2026_130

**Total Tasks**: 2 | **Batches**: 1 | **Status**: 0/1 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- The file `.claude/commands/nitro-retrospective.md` exists and contains both Step 5b (commit) and Step 5c (auto-apply)
- Step 5c writes to `.claude/review-lessons/` and `.claude/anti-patterns.md`
- The commit block in Step 5b currently only conditionally includes review-lessons/anti-patterns.md
- The ordering issue prevents new lessons from being staged in the retro commit

### Risks Identified

None identified. This is a straightforward step reordering with no dependencies or side effects.

---

## Batch 1: Retrospective Step Ordering Fix - PENDING

**Developer**: nitro-systems-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Swap Step 5c before Step 5b in nitro-retrospective.md - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/nitro-retrospective.md`

**Spec Reference**: `.claude/commands/nitro-retrospective.md` lines 133-151

**Pattern to Follow**: N/A (step reordering in documentation)

**Quality Requirements**:

- Reorder the two subsections so that `#### 5c. Auto-Apply Safe Updates` (currently lines 144-151) appears before `#### 5b. Commit Retrospective Artifacts` (currently lines 133-142)
- Renumber the step headers appropriately: Step 5c becomes Step 5b, Step 5b becomes Step 5c
- Preserve all content within each step — only the order changes
- Update any internal references in text that mention "Step 5b" or "Step 5c" to reflect the new order

**Validation Notes**:

- The idempotency rule in the auto-apply step must remain intact (line 151)
- The commit block references must be updated after auto-apply completes

**Implementation Details**:

- Move the entire `#### 5c. Auto-Apply Safe Updates` section (with all its subsections) to appear before `#### 5b. Commit Retrospective Artifacts`
- Update the markdown section headings from `#### 5c.` to `#### 5b.` and `#### 5b.` to `#### 5c.`
- No functional changes to the logic — purely structural reordering

---

### Task 1.2: Make git add unconditional in commit block - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/nitro-retrospective.md`

**Spec Reference**: `.claude/commands/nitro-retrospective.md` lines 133-142 (post-reorder: what is now Step 5c)

**Pattern to Follow**: Standard git workflow patterns in other commands

**Quality Requirements**:

- In the commit block (formerly Step 5b, now Step 5c after reordering), ensure `git add .claude/review-lessons/ .claude/anti-patterns.md` is executed unconditionally
- Remove or update the conditional comment `# If review-lessons or anti-patterns were modified in this run:` to reflect that these directories are always staged before commit
- The commit always includes newly applied lessons from the previous step

**Validation Notes**:

- This ensures that any lessons auto-applied in the preceding step (Task 1.1's new Step 5b) are captured in the same commit
- Unconditional staging is safe because the idempotency check in the auto-apply step prevents duplicate writes

**Implementation Details**:

- Update the bash block to remove the conditional logic
- Make the `git add .claude/review-lessons/ .claude/anti-patterns.md` line unconditional (always executed)
- Keep the task-tracking retrospectives directory in the add (line 138 in current order)

---

## Batch Status Summary

- **Batch 1**: 2 tasks — PENDING
- **Overall Status**: PENDING
- **Files Modified**: 1 (`.claude/commands/nitro-retrospective.md`)

---

## Verification Checklist

After developer completes both tasks:

- [ ] Both Step 5b and Step 5c have been reordered (5c now before 5b)
- [ ] All markdown headers are correct (#### 5b and #### 5c)
- [ ] The git add command in the commit block is unconditional
- [ ] No content is lost or duplicated during reordering
- [ ] The idempotency rule remains intact
