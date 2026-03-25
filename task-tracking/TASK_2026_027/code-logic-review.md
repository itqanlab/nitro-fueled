# Code Logic Review - TASK_2026_027

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 3/10                                 |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 3                                    |
| Serious Issues      | 2                                    |
| Moderate Issues     | 2                                    |
| Failure Modes Found | 6                                    |

**Note**: This implementation has severe structural corruption in the auto-pilot SKILL.md file that must be fixed before approval.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Duplicate step headers cause ambiguous step execution:**
- There are TWO `### Step 3b` headers (lines 263 and 265)
- There are TWO `### Step 5: Spawn Workers` headers (lines 313 and 328)
- There are TWO `## Active Workers` headers in the orchestrator-state.md format section
- There are TWO `## Completed Tasks` headers in the orchestrator-state.md format section

**Impact**: When a supervisor reads this file to determine what to do, it may execute duplicate steps or skip steps entirely. The "Step 5" duplication is particularly dangerous because it means the supervisor could attempt to spawn workers twice, or the second duplicate could have incorrect logic.

**Silent failure scenario**: The supervisor reads the first "Step 5: Spawn Workers" and executes it. If there's a bug in that implementation, it continues to the second "Step 5" which might have different instructions. The supervisor may not detect that it executed the same step twice.

### 2. What user action causes unexpected behavior?

**User runs `/auto-pilot` with overlapping tasks:**

Scenario:
1. Two tasks (TASK_A and TASK_B) both have `index.html` in their File Scope
2. Supervisor detects overlap and logs: `"OVERLAP DETECTED — TASK_A and TASK_B share files: index.html"`
3. Supervisor records both tasks in `## Serialized Reviews` table
4. **PROBLEM**: Step 4 only says "SKIP it for this spawn cycle (it will be handled in a serial pass after current parallel reviews complete)"
5. **NO logic exists to actually handle the serial pass!**

**Result**: Tasks are marked for serialization but never actually handled. They get skipped indefinitely. The user sees their tasks stuck in IMPLEMENTED state forever, waiting for review that never comes.

### 3. What data makes this produce wrong results?

**Empty or missing File Scope section:**

The implementation assumes File Scope is always populated:
- Step 3b: "Extract File Scope from each task's File Scope section"
- Review Worker prompt: "Read the task's File Scope section from task.md"

**Failure modes:**
1. Build Worker forgets to populate File Scope (task has `[None]` or empty list)
2. Task was created before this change (no File Scope section exists)
3. File Scope is malformed (not a list, contains invalid paths)

**Result**: Supervisor cannot detect overlaps. Review Worker has no scope boundaries. Both problems this task was supposed to fix (BUG-3 and BUG-4) re-occur.

**No validation**: There is no fallback for missing/malformed File Scope. The supervisor silently continues as if scope is empty.

### 4. What happens when dependencies fail?

**review-context.md does not exist:**

The Review Worker prompt includes:
```
3. **FIRST: Read shared review context**:
   - Read `task-tracking/review-context.md` if it exists
   - Apply project conventions and style decisions to your review
   - If review-context.md does not exist, proceed without it
```

**This is Part A of the task requirements, BUT:**
- No code generates review-context.md
- The requirement says "review-context.md is generated before review workers are spawned"
- **This is NOT IMPLEMENTED** - it's just a prompt instruction

**Impact**: BUG-4 (contradictory decisions) will still occur because there's no shared context file. The Review Worker will proceed without it, and reviewers will still make contradictory decisions.

**Part A is incomplete** - this is a documentation-only change, not functional implementation.

### 5. What's missing that the requirements didn't mention?

**Missing Part A implementation:**

The requirement states:
- [ ] `review-context.md` is generated before review workers are spawned

**Actual implementation**:
- Only adds prompt instructions to Review Worker to read review-context.md IF it exists
- NO supervisor logic to actually GENERATE review-context.md

This is the opposite of the requirement. The requirement says the file SHOULD BE GENERATED. The implementation just says "read it if it exists."

**Missing serial pass execution logic:**

The requirement states:
- [ ] When file scopes overlap, reviews are serialized (not parallel)

**Actual implementation**:
- Detects overlaps
- Records them in `## Serialized Reviews` table
- Instructs to skip serialized tasks "this spawn cycle"
- **NO logic for actually handling the serial pass after parallel reviews complete**

This means serialized reviews are permanently blocked, not serialized.

**Missing File Scope validation:**

The template has `- [None]` as default, but:
- No supervisor validation that File Scope is actually populated after Build
- No supervisor validation that File Scope is a valid list
- No fallback for tasks created before this change

---

## Failure Mode Analysis

### Failure Mode 1: Supervisor structural corruption

- **Trigger**: Task_2026_027 implementation with duplicate headers
- **Symptoms**: Supervisor may execute steps twice, skip steps, or behave unpredictably
- **Impact**: CRITICAL - Supervisor behavior is undefined
- **Current Handling**: None - the corruption is in the skill file itself
- **Recommendation**: Fix all duplicate headers. Ensure unique step numbers. Remove orphaned duplicate content blocks.

**Evidence**:
```markdown
### Step 3b: Check Strategic Plan (Optional)
### Step 3b: File Scope Overlap Detection  # DUPLICATE HEADER

### Step 5: Spawn Workers  # FIRST COPY
# ... content ...
### Step 5: Spawn Workers  # DUPLICATE HEADER
# ... content ...
```

### Failure Mode 2: Serialized reviews permanently blocked

- **Trigger**: Two tasks have overlapping File Scope
- **Symptoms**: Tasks stuck in IMPLEMENTED state indefinitely
- **Impact**: CRITICAL - User cannot complete their tasks
- **Current Handling**: Tasks are marked in `## Serialized Reviews` table and skipped, but never handled
- **Recommendation**: Add explicit logic to process serialized tasks. Either:
  a. Process them after all non-serialized parallel reviews complete
  b. Process one serialized task per spawn cycle
  c. Add a "serial pass" mode that only processes serialized tasks

**Gap in logic**:
```
Step 4: Order Task Queue
**Serialization check**: Before selecting tasks from Review Queue,
check the `## Serialized Reviews` table in orchestrator-state.md.
If a task is in that table, SKIP it for this spawn cycle
(it will be handled in a serial pass after current parallel reviews complete).
```

The comment says "will be handled" but there's no step that does this.

### Failure Mode 3: File Scope not populated (empty list)

- **Trigger**: Build Worker forgets to populate File Scope, or task created before this change
- **Symptoms**: Overlap detection silently fails. Review Worker has no scope boundaries.
- **Impact**: SERIOUS - BUG-3 and BUG-4 re-occur
- **Current Handling**: None - no validation
- **Recommendation**:
  a. Add validation: If File Scope is empty or contains only `[None]`, log warning and treat as "unknown scope" (do not serialize)
  b. Require Build Worker Exit Gate to verify File Scope is populated before marking IMPLEMENTED
  c. Add migration: If task is IMPLEMENTED but has empty File Scope, Build Worker should re-scan git diff and populate it

### Failure Mode 4: review-context.md never generated

- **Trigger**: Review Worker starts (before or after this task)
- **Symptoms**: No shared context between reviewers, contradictory decisions still occur
- **Impact**: SERIOUS - Part A of requirements not met
- **Current Handling**: Review Worker is told to read it IF it exists, but it's never created
- **Recommendation**: Implement supervisor logic to generate review-context.md:
  - Before spawning Review Workers, read plan.md "decisions log" if it exists
  - Read .claude/review-lessons/ for project conventions
  - Generate review-context.md with:
    - Project tech stack constraints
    - Style decisions from plan.md
    - Recent review lessons
  - This file should be updated after each Review Worker completes

### Failure Mode 5: Prompt template duplication causes ambiguity

- **Trigger**: Supervisor generates Review Worker prompt from templates
- **Symptoms**: Review Worker receives conflicting instructions
- **Impact**: SERIOUS - Review Worker may behave unpredictably
- **Current Handling**: Duplicate content exists in First-Run Review Worker Prompt
- **Recommendation**: Remove duplicate instructions:

**Evidence of duplication**:
```markdown
2. The task is already implemented. Do NOT re-run PM, Architect,
or development phases. Start from the QA/review phase.

3. Run ALL available reviewers: style, logic, and security.
Do not ask which reviewers to run -- run all of them.
```

Appears twice with slight variations between lines 677-697.

### Failure Mode 6: orchestrator-state.md format has duplicate table headers

- **Trigger**: Supervisor reads/writes orchestrator-state.md
- **Symptoms**: Supervisor may parse wrong table, or parsing fails
- **Impact**: SERIOUS - State file corruption
- **Current Handling**: Format section shows duplicate headers
- **Recommendation**: Clean up the format example:
  - Remove duplicate `## Active Workers` header
  - Remove duplicate `## Completed Tasks` header
  - Ensure each section appears exactly once

---

## Critical Issues

### Issue 1: Duplicate step headers in auto-pilot SKILL.md

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: Supervisor reads the file to determine execution steps
- **Impact**: Supervisor may execute duplicate steps or skip steps. Behavior is undefined.
- **Evidence**:
  - Line 263: `### Step 3b: Check Strategic Plan (Optional)`
  - Line 265: `### Step 3b: File Scope Overlap Detection` (DUPLICATE - should be Step 3c)
  - Line 313: `### Step 5: Spawn Workers` (first copy)
  - Line 328: `### Step 5: Spawn Workers` (DUPLICATE)
- **Fix**: Rename the File Scope Overlap Detection to `### Step 3c` and remove the duplicate Step 5 header. Re-number all subsequent steps.

### Issue 2: No serial pass execution logic

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: Two tasks have overlapping File Scope
- **Impact**: Tasks are permanently blocked in IMPLEMENTED state, never reviewed
- **Evidence**: Step 4 says "will be handled in a serial pass" but no step does this
- **Fix**: Add explicit logic in Step 4 to handle serialized tasks:
  ```
  After all parallel reviews complete (all slots empty):
  If `## Serialized Reviews` table has entries:
    Process one serialized task (highest priority)
    After it completes, remove from table
    Repeat until table is empty
  ```

### Issue 3: Part A (review-context.md) not implemented

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: User expects review-context.md to be generated
- **Impact**: BUG-4 (contradictory decisions) still occurs. Requirement not met.
- **Evidence**: No supervisor logic generates review-context.md. Only Review Worker prompt reads it IF it exists.
- **Fix**: Add step before spawning Review Workers:
  ```
  Step X: Generate Review Context (if not exists)
  1. Check if review-context.md exists
  2. If not:
     - Read plan.md "decisions log" section if it exists
     - Read .claude/review-lessons/ for project conventions
     - Write review-context.md with conventions and style decisions
  ```

---

## Serious Issues

### Issue 4: File Scope has no validation

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: Build Worker forgets to populate File Scope
- **Impact**: Overlap detection silently fails
- **Evidence**: Step 3b extracts File Scope with no validation
- **Fix**: Add validation:
  ```
  If File Scope is empty or contains only "[None]":
    Log warning: "TASK_X: File Scope not populated, cannot detect overlaps"
    Treat as unknown scope (do not serialize)
  ```

### Issue 5: Duplicate content in Review Worker Prompt template

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: Supervisor generates Review Worker prompt
- **Impact**: Review Worker receives conflicting instructions
- **Evidence**: Lines 677-697 contain duplicate/similar instructions
- **Fix**: Remove the duplicate instructions. Ensure each numbered step appears exactly once.

---

## Moderate Issues

### Issue 6: orchestrator-state.md format has duplicate headers

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: Supervisor reads format section as reference
- **Impact**: Confusing reference for state file parsing
- **Evidence**:
  - Line 860: `## Active Workers`
  - Line 862: `## Active Workers` (duplicate)
  - Line 874: `## Completed Tasks`
  - Line 881: `## Completed Tasks` (duplicate)
- **Fix**: Remove duplicate headers from the format example.

### Issue 7: task.md File Scope default is "[None]" but no migration

- **File**: `task-tracking/task-template.md`
- **Scenario**: Existing tasks were created before this change
- **Impact**: Their File Scope is "[None]" and will be skipped
- **Evidence**: Template default is `- [None]`
- **Fix**: Add migration note in documentation or auto-populate from git diff when missing:
  ```
  Build Worker: If task.md File Scope is "[None]" or empty:
    Read git diff for this task's implementation commit
    Extract list of modified files
    Populate File Scope with that list
  ```

---

## Data Flow Analysis

```
[Current Implementation - BROKEN]

Supervisor Loop:
  Step 1: Read State
  Step 2: Read Registry and Task Folders
    --> Extract File Scope (no validation) -- GAP 1: No validation
  Step 2b: Validate Task Quality
  Step 3: Build Dependency Graph
  Step 3b: Check Strategic Plan (Optional)
  Step 3b: File Scope Overlap Detection -- GAP 2: Duplicate header
    --> Compare file scopes
    --> Log overlap warning
    --> Record in ## Serialized Reviews table
  Step 4: Order Task Queue
    --> Check ## Serialized Reviews table
    --> Skip serialized tasks -- GAP 3: No serial pass logic!
  Step 5: Spawn Workers -- GAP 4: Duplicate header!
  Step 6: Monitor Active Workers
  Step 7: Handle Completions
  Step 8: Loop Termination Check

Review Worker:
  --> Read review-context.md IF it exists -- GAP 5: Never generated!
  --> Read task.md File Scope (no validation) -- GAP 6: Empty scope possible
  --> Run reviews
  --> Fix findings (no scope enforcement in code level)
```

### Gap Points Identified:

1. **No File Scope validation**: Empty scope causes silent failure in overlap detection
2. **Duplicate headers**: Steps have ambiguous numbering and duplicates
3. **No serial pass execution**: Serialized tasks are never actually processed
4. **No review-context.md generation**: Part A is documentation-only, not implemented
5. **No scope enforcement at code level**: Review Worker prompt says "do not fix" but no mechanism enforces this
6. **No migration for existing tasks**: Old tasks with empty File Scope are not handled

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| `review-context.md` is generated before review workers are spawned | **MISSING** | Only prompt instruction to read it IF exists. No generation logic. |
| Review context includes project conventions from plan.md decisions log | **MISSING** | Depends on review-context.md generation which is not implemented. |
| Review context is updated as reviews complete (decisions feed into next reviewer) | **MISSING** | No update logic exists. |
| Task template includes `## File Scope` section | **COMPLETE** | Added to task-template.md correctly. |
| Build workers populate file scope after implementation | **COMPLETE** | Added to Build Worker prompt correctly. |
| Supervisor detects overlapping file scopes and logs a warning | **COMPLETE** | Step 3b implements this. |
| When file scopes overlap, reviews are serialized (not parallel) | **PARTIAL** | Detection works, but no serial pass execution logic exists. Tasks are permanently blocked, not serialized. |
| Review workers only fix issues within their task's file scope | **PARTIAL** | Prompt instruction exists, but no enforcement mechanism. Empty scope is possible. |

### Implicit Requirements NOT Addressed:

1. **Validation of File Scope content**: No check that scope is actually populated
2. **Migration strategy for existing tasks**: No handling of tasks created before this change
3. **Serial pass completion condition**: How does supervisor know serial pass is done?
4. **Scope enforcement at code change level**: Review Worker is told not to fix outside scope, but git blame is not reliable for determining "ownership"
5. **State file consistency**: Duplicate headers make state file parsing ambiguous

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Empty File Scope (`[None]`) | NO | N/A | Overlap detection silently fails. No validation. |
| Malformed File Scope (not a list) | NO | N/A | Parsing may fail, no error handling. |
| Missing File Scope section (old tasks) | NO | N/A | Supervisor may crash on extraction. |
| Three tasks with cyclic file overlaps | NO | N/A | Logic is pairwise, no cycle handling. |
| review-context.md exists but is malformed | NO | N/A | Review Worker proceeds with bad data. |
| All concurrent tasks are serialized | NO | N/A | No logic to handle "all serial, no parallel" case. |
| File Scope overlaps with dependencies not in review queue | NO | N/A | May serialize unnecessarily. |
| Build Worker populates scope incorrectly (wrong paths) | NO | N/A | No validation of path validity. |
| User manually removes task from `## Serialized Reviews` table | NO | N/A | No detection of manual intervention. |
| Supervisor compaction during serial pass | NO | N/A | State may be lost mid-serialization. |
| Review Worker fixes outside scope despite instruction | NO | N/A | No enforcement at code-change level. |
| Git blame cannot determine ownership (rebase, squash) | NO | N/A | `git blame` becomes unreliable for ownership. |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| File Scope extraction -> Overlap detection | LOW | MEDIUM | Logic exists, but no validation of extracted data. |
| Overlap detection -> Serialization table | HIGH | HIGH | Logic exists, but no execution mechanism. CRITICAL. |
| Serialization table -> Review Worker spawn | **CRITICAL** | **CRITICAL** | NO path from table to spawn. Tasks blocked forever. |
| Plan.md decisions -> review-context.md | N/A | N/A | Generation logic missing entirely. Part A not implemented. |
| Review Worker prompt generation | LOW | MEDIUM | Duplicate content causes ambiguity. |
| orchestrator-state.md read/write | MEDIUM | MEDIUM | Duplicate headers cause parsing confusion. |

---

## Verdict

**Recommendation**: **REVISE**
**Confidence**: **HIGH**
**Top Risk**: Serialized reviews are permanently blocked (no execution logic) and review-context.md is never generated (Part A missing)

---

## What Robust Implementation Would Include

1. **Complete Part A implementation**:
   - Supervisor generates review-context.md before spawning Review Workers
   - Reads plan.md decisions log
   - Reads .claude/review-lessons/ for conventions
   - Updates review-context.md after each Review Worker completes

2. **Complete serial pass logic**:
   - Explicit step to process `## Serialized Reviews` table
   - Define when serial pass runs (after parallel reviews empty)
   - Define completion condition (table empty)
   - Handle edge case: all tasks serialized

3. **File Scope validation**:
   - Check for empty/malformed scope
   - Log warnings for missing scope
   - Fallback: treat as unknown scope, do not serialize
   - Migration: populate from git diff for existing tasks

4. **Clean up structural issues**:
   - Remove all duplicate headers
   - Re-number steps consistently
   - Remove duplicate prompt template content

5. **Enforce scope at code change level**:
   - Pre-commit hook check: validate changes are within task's File Scope
   - Or: Review Worker uses git diff to verify only scoped files changed

6. **Handle edge cases**:
   - Cyclic file overlaps (3+ tasks)
   - Missing File Scope section (backward compatibility)
   - Git blame failures (ownership cannot be determined)
