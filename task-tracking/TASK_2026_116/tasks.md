# Development Tasks - TASK_2026_116

**Total Tasks**: 19 | **Batches**: 3 | **Status**: 0/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- All 17 command files exist in `.claude/commands/`: Verified
- Files contain self-references to old command names: Verified (grep found matches)
- CLAUDE.md references old command names in comments: Verified
- Reference files (task-tracking.md, checkpoints.md) do not contain command references: Verified (no `/` command patterns found)

### Risks Identified

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Missing self-reference update | LOW | Batch 2 includes comprehensive grep verification |

---

## Batch 1: Rename Command Files - COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 17 | **Dependencies**: None
**Commit**: Pending (will commit after all batches complete)

### Task 1.1: Rename auto-pilot.md to nitro-auto-pilot.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/auto-pilot.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-auto-pilot.md`

**Implementation Details**:
```bash
git mv .claude/commands/auto-pilot.md .claude/commands/nitro-auto-pilot.md
```

---

### Task 1.2: Rename create-agent.md to nitro-create-agent.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-agent.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-create-agent.md`

**Implementation Details**:
```bash
git mv .claude/commands/create-agent.md .claude/commands/nitro-create-agent.md
```

---

### Task 1.3: Rename create-skill.md to nitro-create-skill.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-skill.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-create-skill.md`

**Implementation Details**:
```bash
git mv .claude/commands/create-skill.md .claude/commands/nitro-create-skill.md
```

---

### Task 1.4: Rename create-task.md to nitro-create-task.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-create-task.md`

**Implementation Details**:
```bash
git mv .claude/commands/create-task.md .claude/commands/nitro-create-task.md
```

---

### Task 1.5: Rename create.md to nitro-create.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-create.md`

**Implementation Details**:
```bash
git mv .claude/commands/create.md .claude/commands/nitro-create.md
```

---

### Task 1.6: Rename evaluate-agent.md to nitro-evaluate-agent.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/evaluate-agent.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-evaluate-agent.md`

**Implementation Details**:
```bash
git mv .claude/commands/evaluate-agent.md .claude/commands/nitro-evaluate-agent.md
```

---

### Task 1.7: Rename initialize-workspace.md to nitro-initialize-workspace.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/initialize-workspace.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-initialize-workspace.md`

**Implementation Details**:
```bash
git mv .claude/commands/initialize-workspace.md .claude/commands/nitro-initialize-workspace.md
```

---

### Task 1.8: Rename orchestrate-help.md to nitro-orchestrate-help.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/orchestrate-help.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-orchestrate-help.md`

**Implementation Details**:
```bash
git mv .claude/commands/orchestrate-help.md .claude/commands/nitro-orchestrate-help.md
```

---

### Task 1.9: Rename orchestrate.md to nitro-orchestrate.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/orchestrate.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-orchestrate.md`

**Implementation Details**:
```bash
git mv .claude/commands/orchestrate.md .claude/commands/nitro-orchestrate.md
```

---

### Task 1.10: Rename plan.md to nitro-plan.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/plan.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-plan.md`

**Implementation Details**:
```bash
git mv .claude/commands/plan.md .claude/commands/nitro-plan.md
```

---

### Task 1.11: Rename project-status.md to nitro-project-status.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/project-status.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-project-status.md`

**Implementation Details**:
```bash
git mv .claude/commands/project-status.md .claude/commands/nitro-project-status.md
```

---

### Task 1.12: Rename retrospective.md to nitro-retrospective.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/retrospective.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-retrospective.md`

**Implementation Details**:
```bash
git mv .claude/commands/retrospective.md .claude/commands/nitro-retrospective.md
```

---

### Task 1.13: Rename review-code.md to nitro-review-code.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/review-code.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-review-code.md`

**Implementation Details**:
```bash
git mv .claude/commands/review-code.md .claude/commands/nitro-review-code.md
```

---

### Task 1.14: Rename review-logic.md to nitro-review-logic.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/review-logic.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-review-logic.md`

**Implementation Details**:
```bash
git mv .claude/commands/review-logic.md .claude/commands/nitro-review-logic.md
```

---

### Task 1.15: Rename review-security.md to nitro-review-security.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/review-security.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-review-security.md`

**Implementation Details**:
```bash
git mv .claude/commands/review-security.md .claude/commands/nitro-review-security.md
```

---

### Task 1.16: Rename run.md to nitro-run.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/run.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-run.md`

**Implementation Details**:
```bash
git mv .claude/commands/run.md .claude/commands/nitro-run.md
```

---

### Task 1.17: Rename status.md to nitro-status.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/status.md`
**Status**: IMPLEMENTED
**Description**: Use `git mv` to rename the file to `nitro-status.md`

**Implementation Details**:
```bash
git mv .claude/commands/status.md .claude/commands/nitro-status.md
```

---

**Batch 1 Verification**:
- All 17 files renamed with `git mv`
- Verify with `ls .claude/commands/` - all should have `nitro-` prefix
- Files are staged but not committed (nitro-team-leader handles commit)

---

## Batch 2: Update Internal References - IN PROGRESS

**Developer**: nitro-systems-developer
**Tasks**: 1 | **Dependencies**: Batch 1

### Task 2.1: Update all command self-references in renamed files - IN PROGRESS

**File**: All 17 renamed files in `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/`
**Status**: PENDING
**Description**: Update all internal command references from old names to new `nitro-*` names

**Files with known references (from grep)**:
- `nitro-auto-pilot.md` - references `/auto-pilot`
- `nitro-create-agent.md` - references `/create-agent`, `/initialize-workspace`, `/create-task`, `/create-skill`
- `nitro-create-task.md` - references `/create-task`, `/orchestrate`, `/auto-pilot`, `/initialize-workspace`, `/project-status`
- `nitro-create-skill.md` - references `/create-skill`, `/initialize-workspace`, `/create-task`
- `nitro-create.md` - references `/create`, `/plan`, `/create-task`
- `nitro-evaluate-agent.md` - references `/evaluate-agent`
- `nitro-initialize-workspace.md` - may have references
- `nitro-orchestrate-help.md` - references `/orchestrate`
- `nitro-orchestrate.md` - references `/orchestrate`
- `nitro-plan.md` - references `/plan`, `/initialize-workspace`
- `nitro-project-status.md` - may have references
- `nitro-retrospective.md` - references `/retrospective`, `/initialize-workspace`
- `nitro-run.md` - references `/run`, `/auto-pilot`, `/orchestrate`
- `nitro-status.md` - references `/status`, `/project-status`

**Replacement Map**:
| Old | New |
| --- | --- |
| `/auto-pilot` | `/nitro-auto-pilot` |
| `/create-agent` | `/nitro-create-agent` |
| `/create-skill` | `/nitro-create-skill` |
| `/create-task` | `/nitro-create-task` |
| `/create` | `/nitro-create` |
| `/evaluate-agent` | `/nitro-evaluate-agent` |
| `/initialize-workspace` | `/nitro-initialize-workspace` |
| `/orchestrate-help` | `/nitro-orchestrate-help` |
| `/orchestrate` | `/nitro-orchestrate` |
| `/plan` | `/nitro-plan` |
| `/project-status` | `/nitro-project-status` |
| `/retrospective` | `/nitro-retrospective` |
| `/review-code` | `/nitro-review-code` |
| `/review-logic` | `/nitro-review-logic` |
| `/review-security` | `/nitro-review-security` |
| `/run` | `/nitro-run` |
| `/status` | `/nitro-status` |

**Implementation Details**:
- Use Edit tool with `replace_all` flag for each replacement pattern in each file
- After all replacements, run verification grep to ensure no old command names remain:
  ```bash
  grep -r "/auto-pilot\|/create-agent\|/create-skill\|/create-task\|/create |\|/evaluate-agent\|/initialize-workspace\|/orchestrate-help\|/orchestrate |\|/plan |\|/project-status\|/retrospective\|/review-code\|/review-logic\|/review-security\|/run |\|/status " .claude/commands/
  ```
- Expected: No matches (all old names replaced)

---

**Batch 2 Verification**:
- All internal references updated to `/nitro-*` prefix
- Grep verification shows no old command names
- Files are staged but not committed

---

## Batch 3: Update Documentation References - PENDING

**Developer**: nitro-systems-developer
**Tasks**: 1 | **Dependencies**: Batch 2

### Task 3.1: Update CLAUDE.md command references - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md`
**Status**: PENDING
**Description**: Update the commands comment line in CLAUDE.md to reflect new `nitro-*` command names

**Current Line (22)**:
```
  commands/                # /orchestrate, /plan, /auto-pilot, /review-*, /create-task, /initialize-workspace, /project-status, /orchestrate-help
```

**New Line**:
```
  commands/                # /nitro-orchestrate, /nitro-plan, /nitro-auto-pilot, /nitro-review-*, /nitro-create-task, /nitro-initialize-workspace, /nitro-project-status, /nitro-orchestrate-help
```

**Implementation Details**:
- Use Edit tool to replace the old comment with new comment
- Verify CLAUDE.md has no other old command references

---

**Batch 3 Verification**:
- CLAUDE.md updated with new command names
- No other old command references in CLAUDE.md
- File staged but not committed
- All batches complete - signal MODE 3

---

## Summary

| Batch | Description | Tasks | Status |
| ----- | ----------- | ----- | ------ |
| 1 | Rename Command Files | 17 | COMPLETE |
| 2 | Update Internal References | 1 | IN PROGRESS |
| 3 | Update Documentation References | 1 | PENDING |

**Total**: 19 tasks across 3 batches
