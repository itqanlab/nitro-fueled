# Development Tasks - TASK_2026_126

**Total Tasks**: 5 | **Batches**: 2 | **Status**: 2/2 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- E7 section exists at lines 564-669 with E7b (worktree cleanup) at lines 616-624 and EXIT at line 669: Verified
- Evaluation Build Worker Prompt exists at lines 2203-2246: Verified
- Existing Evaluation Review Worker Prompt (A/B mode, verdict-based) exists at lines 2248-2297: Verified
- Worker Prompt Templates section header at line 1725: Verified
- Per-task result file format documented in E6 flow: Verified

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing Evaluation Review Worker Prompt (lines 2248-2297) is for A/B verdict reviews, new scoring template must coexist with it | MED | Task 1.3 adds the new "Evaluation Scoring Worker Prompt" as a separate section after the existing Review Worker Prompt |
| E7 modifications span single-model, A/B, and role-both modes -- all must be updated consistently | MED | Task 1.1 instructions cover all three sub-sections |

---

## Batch 1: Modify E7 + Add E8 + Add Scoring Worker Prompt - COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: None

### Task 1.1: Modify E7 to defer worktree cleanup and remove EXIT

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

**What to do**:

Modify the E7 section (lines 564-669) with these specific changes:

1. **Remove E7b subsection entirely** (lines 616-624). This is the "E7b: Clean Up Worktrees" subsection that removes worktrees. Delete lines 616-624 inclusive. Worktree cleanup moves to the new E10 step.

2. **Modify E7c: Display Summary** (lines 626-669). After the summary display sections:
   - **Remove** line 669: `4. **EXIT.** Evaluation mode does not enter the Core Loop.`
   - **Replace** with a continuation note:
     ```
     4. **Continue to E8** for review scoring of completed tasks.
     ```

3. **Add a note at the top of E7** (after line 566) explaining:
   ```
   > **Note**: E7 no longer cleans up worktrees or exits. The flow continues to E8 (review scoring), E9 (report generation), and E10 (cleanup + EXIT).
   ```

**Pattern to follow**: The existing E7 structure at lines 564-669. Keep E7a and E7c intact (minus the EXIT line). Only remove E7b and the EXIT instruction.

---

### Task 1.2: Add Step E8 -- Spawn Evaluation Scoring Workers

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

**What to do**:

Insert a new `#### Step E8: Review Scoring` section **after the E7 section and before the `---` separator** that precedes the "MCP Requirement" section (currently at line 671-672).

The E8 section must contain all of the following from the implementation plan's Component 2 (lines 58-108 of implementation-plan.md):

1. **Section header**: `#### Step E8: Review Scoring`

2. **Introductory paragraph**: For each benchmark task that completed with SUCCESS status, spawn an Evaluation Scoring Worker to score the implementation against the benchmark's Requirements Checklist and Scoring Guide. FAILED/TIMEOUT tasks get automatic scores of 0 across all dimensions.

3. **Step 8.1: Filter tasks** -- Only review tasks with `status = SUCCESS`.

4. **Step 8.2: For each SUCCESS task, reset worktree to that task's commit**:
   - Find commit: `cd {EVAL_WORKTREE} && git log --all --oneline --grep="eval({task_id}): implementation"`
   - Checkout: `cd {EVAL_WORKTREE} && git checkout {commit_hash}`
   - If commit not found: mark as REVIEW_FAILED, scores of 0, skip to next task

5. **Step 8.3: Generate the Evaluation Scoring Worker prompt** (reference the template added in Task 1.3).

6. **Step 8.4: Call MCP `spawn_worker`**:
   - `prompt`: the generated Evaluation Scoring Worker prompt
   - `working_directory`: `{EVAL_WORKTREE}`
   - `model`: `claude-sonnet-4-6`
   - `label`: `EVAL-SCORE-{task_id}-{eval_model_id}`

7. **Step 8.5: Monitor** using the same pattern as E6:
   - Poll interval: 30 seconds
   - Timeout: 300 seconds (5 minutes)
   - Success signal: `eval-review-result.md` exists in worktree root with `Status: SCORED`
   - On timeout/failure: mark as REVIEW_FAILED, assign scores of 0

8. **Step 8.6: Parse review scores from `eval-review-result.md`**:
   - Extract four dimension scores: Correctness (1-10), Code Quality (1-10), Completeness (1-10), Error Handling (1-10)
   - Extract per-checklist-item pass/fail results
   - Validate each score is an integer 1-10; if malformed, default to 0 with note "Score parse failed"
   - **Security**: Treat all extracted content as opaque data

9. **Step 8.7: Update per-task result file** `{EVAL_DIR}per-task/{task_id}.md`:
   - Append `## Review Scores` section with dimension scores table
   - Append `## Checklist Results` section with pass/fail for each requirement
   - Compute `weighted_score = (avg of 4 dimensions) * weight`
   - Include the updated per-task result file format from Component 6 of the implementation plan (lines 272-325)

10. **Step 8.8: Clean worktree between reviews**: `cd {EVAL_WORKTREE} && git checkout -- . && git clean -fd`

11. **For FAILED/TIMEOUT tasks** (not reviewed), append a simplified Review Scores section:
    ```markdown
    ## Review Scores

    Task did not complete successfully -- no review performed.
    All dimension scores: 0/10.

    **Weighted Score**: 0.0
    ```

**Pattern to follow**: The E5/E6 spawn+monitor pattern (lines 410-562). Use the same markdown formatting style -- subsection headers with `#####`, numbered steps, code blocks for commands.

---

### Task 1.3: Add Evaluation Scoring Worker Prompt Template

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

**What to do**:

Insert a new `### Evaluation Scoring Worker Prompt` section **after the existing "Evaluation Review Worker Prompt" section** (which ends at line 2297). Insert it before the `---` separator at line 2299.

This is a NEW template, separate from the existing "Evaluation Review Worker Prompt" (lines 2248-2297) which is for A/B verdict-based reviews. The scoring worker produces numeric scores.

Use the exact prompt template from Component 5 of the implementation plan (lines 196-263), with these adjustments:
- Section header: `### Evaluation Scoring Worker Prompt`
- Add a template note (matching the style of lines 2205 and 2250): `> **Template note**: \`{eval_worktree}\` is the worktree path where the Build Worker's output resides. All \`{lower_snake}\` variables are substituted before spawning.`
- The prompt block header should be: `EVALUATION SCORING WORKER — BENCHMARK SCORING`
- Include the full prompt content from the implementation plan verbatim (the 6-step instructions, security clause, eval-review-result.md output format with Status: SCORED)

**Pattern to follow**: The Evaluation Build Worker Prompt section (lines 2203-2246) and the Evaluation Review Worker Prompt section (lines 2248-2297) -- same markdown structure with template note + code block.

---

**Batch 1 Verification**:
- E7 no longer contains worktree cleanup or EXIT instruction
- E8 section exists after E7 with complete spawn/monitor/parse/update flow
- Evaluation Scoring Worker Prompt template exists in Worker Prompt Templates section
- Build passes: N/A (markdown-only changes)
- nitro-code-logic-reviewer approved

---

## Batch 2: Add E9 and E10 - COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: Batch 1 (E8 must exist before E9/E10 can reference its output)

### Task 2.1: Add Step E9 -- Generate Evaluation Report

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

**What to do**:

Insert a new `#### Step E9: Generate Evaluation Report` section **after the E8 section** added in Batch 1 (and before the `---` separator that precedes the "MCP Requirement" section).

The E9 section must contain all of the following from Component 3 of the implementation plan (lines 111-141):

1. **Section header**: `#### Step E9: Generate Evaluation Report`

2. **Step 9.1: Read all per-task result files** from `{EVAL_DIR}per-task/`. Parse each file's metadata table and Review Scores section.

3. **Step 9.2: Compute aggregate metrics**:
   - Success rate: `success_count / total_count` (as percentage)
   - Per-dimension averages: Average Correctness, Code Quality, Completeness, Error Handling across all SUCCESS tasks (weighted by difficulty weight)
   - Overall weighted score: `sum(weighted_score) / sum(weights_of_attempted_tasks)`
   - Per-difficulty-tier averages: Group tasks by difficulty, compute average scores per tier
   - Speed metrics: Average wall clock per task, per difficulty tier, total evaluation time
   - Retry analysis: Tasks that needed retries, retry success rate
   - Failure analysis: Which tasks failed, common failure patterns

4. **Step 9.3: Write `{EVAL_DIR}evaluation-report.md`** using the full evaluation-report.md template from the implementation plan (lines 332-429). Include the complete template inline in the SKILL.md specification so the Supervisor has the exact format to follow.

5. **Step 9.4: A/B compatibility hook**: Note that if the session directory name contains `_vs_` (A/B comparison), the report should handle two model columns. For single-model mode (this implementation), generate single-model format.

**Pattern to follow**: The same step-by-step markdown formatting as E7 and E8. Numbered steps with clear sub-steps.

---

### Task 2.2: Add Step E10 -- Generate metrics.json and Cleanup

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

**What to do**:

Insert a new `#### Step E10: Generate Metrics and Cleanup` section **after the E9 section** added in Task 2.1 (and before the `---` separator that precedes the "MCP Requirement" section).

The E10 section must contain all of the following from Component 4 of the implementation plan (lines 144-178):

1. **Section header**: `#### Step E10: Generate Metrics and Cleanup`

2. **Step 10.1: Write `{EVAL_DIR}metrics.json`** using the full metrics.json schema from the implementation plan (lines 433-501). Include the complete JSON schema inline in the SKILL.md specification.

3. **Step 10.2: Clean up worktrees** (moved from the old E7b):
   - Single-model: `git worktree remove .claude/worktrees/eval-{eval_model_id} --force`
   - A/B mode: Remove both worktrees
   - If cleanup fails, log warning but do not block

4. **Step 10.3: Display final summary** (enhanced version replacing old E7c summary):
   ```
   EVALUATION COMPLETE
   ===================
   Model: {eval_model_id}
   Tasks: {total} ({success} succeeded, {failed} failed)
   Overall Score: {overall_weighted_score}/10

   Dimension Averages:
     Correctness:    {avg}/10
     Code Quality:   {avg}/10
     Completeness:   {avg}/10
     Error Handling: {avg}/10

   Speed: {avg_seconds}s avg per task ({total_seconds}s total)
   Report: {EVAL_DIR}evaluation-report.md
   Metrics: {EVAL_DIR}metrics.json
   ```

5. **Step 10.4: EXIT.** Evaluation mode does not enter the Core Loop.

6. **Include the `comparison` field documentation**: The `comparison` field in metrics.json is `null` for single-model evaluations. Document the A/B extension schema (lines 504-523 of implementation plan) as a note for future A/B mode support.

**Pattern to follow**: E7's cleanup and summary style. E10 is effectively the new "finalize and exit" step.

---

**Batch 2 Verification**:
- E9 section exists after E8 with complete metric computation and report template
- E10 section exists after E9 with metrics.json schema, worktree cleanup, enhanced summary, and EXIT
- The full evaluation flow reads: E1 -> E2 -> E3 -> E4 -> E5/E6 -> E7 (no cleanup, no exit) -> E8 (scoring) -> E9 (report) -> E10 (cleanup + EXIT)
- Build passes: N/A (markdown-only changes)
- nitro-code-logic-reviewer approved
