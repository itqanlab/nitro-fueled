# Code Logic Review — TASK_2026_037

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | code-logic-reviewer |
| Overall Score | 6/10 |
| Verdict | PASS WITH NOTES |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**File-based completion detection is a silent failure trap.** The ReviewLead is considered "done" when `review-context.md` contains a `## Findings Summary` section. There is no explicit MCP `finished` state for ReviewLead — the Supervisor detects completion by polling the file system. If the ReviewLead crashes after writing `review-context.md` but before writing the Findings Summary section, the Supervisor will see the file exist but not find the section. It will then fall into the 7e retry path. This is handled. However if the ReviewLead crashes after writing a *partial* Findings Summary — enough characters to create the heading but not the counts — the Supervisor will treat the ReviewLead as done with a malformed summary. The "Both done" evaluation then reads the counts as 0, concludes no blocking findings, and spawns a CompletionWorker instead of a FixWorker. Real blocking findings would be silently skipped.

**The "Both done" verdict logic is underspecified and can produce false negatives.** The logic checks: "For each of review-code-style.md, review-code-logic.md, review-security.md: look for lines containing `blocking` or `critical` or findings count > 0. If any review file's Verdict section shows FAIL → findings exist." The word "blocking" also appears in the heading `### Blocking` and in the phrase `### Blocking\n[list or "None"]`. If the review file uses these section headers (which the review format requires) but the actual findings list says "None", the string match on "blocking" will still fire — a false positive. The Supervisor will spawn a Fix Worker unnecessarily. Conversely, if a review uses "CRITICAL" (uppercase) and the search is case-sensitive, it would miss it. The match criteria are too vague for a decision that determines whether a task passes or gets a Fix Worker.

### 2. What user action causes unexpected behavior?

**Running `/auto-pilot` with `--concurrency 1` silently drops the Test Lead.** The skill documents this (lines 68-72): "with concurrency_limit == 1, the Test Lead will likely never execute." However the user gets no warning at the time of spawning. The ReviewLead is spawned, it finishes and the Supervisor closes the task via CompletionWorker, never giving the TestLead a slot. The "Both done" logic path has a note that `test-report.md` missing is treated as "tests passed." So a concurrency-1 run silently skips all testing. This is documented, but discoverable only by reading deep into the Configuration section. A pre-flight warning should surface it.

**Single-task mode (`/auto-pilot TASK_X`) does not describe the new parallel workers in its mode definition.** The Mode table (line 159) describes single-task mode as: "spawn Review Worker... monitor until COMPLETE." This is the old language — it does not mention that Review Lead + Test Lead are spawned simultaneously, or FIXING state. A user relying on single-task mode for a task that ends up needing a Fix Worker may be confused when the task enters FIXING and the single-task mode description says nothing about it.

### 3. What data makes this produce wrong results?

**A review file that uses "blocking" as a word in a finding description will trigger a false positive.** Example: a style reviewer writes "The naming convention is blocking code readability." The "Both done" logic searches for lines containing "blocking" and would count this as a blocking finding, spawning a Fix Worker when none is needed.

**A test-report.md that contains the word "FAILED" in a non-verdict context causes a false positive.** The check looks for `"Status: FAIL"` or `"FAILED"` in the results section. A test report that writes "3 tests FAILED to initialize due to missing fixtures, but this is expected in CI" would trigger the fix path. The matching is string-based with no structural awareness.

**The Findings Summary section count format is not validated.** The ReviewLead writes:
```
## Findings Summary
- Blocking: {N}
- Serious: {N}
- Minor: {N}
```
The Supervisor detects "REVIEW_DONE" by the presence of `## Findings Summary`. But the "Both done" evaluation reads the review *files* (review-code-style.md etc.) for blocking findings, not the counts in the Findings Summary. This means the two sources of truth can disagree — the Findings Summary says "Blocking: 0" but a review file has a FAIL verdict. The Supervisor uses the review files (correct), but the Findings Summary counts are never validated and may mislead the Fix Worker or the worker logs.

### 4. What happens when dependencies fail?

**If the ReviewLead crashes without writing review-context.md at all**, Step 7e's retry path fires (no expected state transition). The Worker Recovery Protocol spawns a Cleanup Worker. The Cleanup Worker salvages uncommitted work and re-reads registry — which still shows IN_REVIEW. Next loop iteration Step 5a sees `state = IN_REVIEW`, decides to spawn "Review Lead (if no review artifacts yet)" and a new ReviewLead is spawned. This path works.

**If the ReviewLead crashes after writing review-context.md but before the Findings Summary**, the Supervisor checks for `## Findings Summary` in 7d and does not find it. The worker is treated as not-done (7e path fires). The Retry ReviewLead prompt (line 1135) checks: "review-context.md has `## Findings Summary`? → all reviews done, skip to exit gate." Since it does NOT have the summary, the retry ReviewLead resumes correctly from the last incomplete step. This path works.

**If the TestLead crashes without writing test-report.md**, Step 7e fires for the TestLead. After the Cleanup Worker, the task stays at IN_REVIEW. Step 5a sees `state = IN_REVIEW` and re-evaluates: "Task state IN_REVIEW → Review Lead (if no review artifacts yet) | Test Lead (if no test-report.md yet) | both." Since test-report.md is absent, a new TestLead is spawned. But — the ReviewLead is no longer running. The 7d logic path for TestLead says: "If ReviewLead is no longer running for this task → proceed to `Both done` evaluation." This means: **after a TestLead retry completes, if the ReviewLead already finished in a prior loop iteration, the Supervisor immediately evaluates "Both done"**. This is the intended behavior and it works, provided the ReviewLead's active workers entry was already removed. The state is tracked correctly.

**FIXING state is not covered in compaction recovery (Step 1, Case reconciliation).** Step 1 lists 5 reconcile cases: COMPLETE (Case 1), CREATED+worker (Case 2), CREATED+no worker (Case 3), IMPLEMENTED+no worker (Case 4), IN_REVIEW+no worker (Case 5). There is no `Case 6: FIXING in registry, worker NOT in MCP`. If the Supervisor compacts or crashes while a Fix Worker is running and the registry shows FIXING, the reconciliation step has no case for this state. On recovery, FIXING is not in the list at Step 2 line 335 either — Step 2 only reads tasks with status CREATED, IN_PROGRESS, IMPLEMENTED, or IN_REVIEW. A task in FIXING state after compaction recovery would be invisible to the Supervisor loop entirely. It would not be in the active workers (compaction cleared it), not be in the queue (Step 3 would classify it as FIXING but the task.md was never read), and not be picked up for a Fix Worker respawn. **The FIXING state creates a dead end on compaction.**

### 5. What's missing that the requirements didn't mention?

**The `Testing: skip` field is referenced in the task.md requirements (edge case section) but no implementation exists in the SKILL.md.** The task spec says: "Task has `Testing: skip`: Supervisor only spawns Review Lead (current behavior)." There is no code in Step 5a that reads `Testing: skip` from task.md to decide whether to spawn a TestLead. The only mechanism that skips a TestLead is if the task type is in a "no tests" category — but there is no explicit list of which task types skip tests. The log event format says `"TEST SKIP — TASK_X: task type {type} does not require tests"` implying type-based skip logic exists, but no implementation rule defines which types qualify. The `Testing: skip` field path is completely unimplemented.

**The Re-run tests after fix requirement (task spec item 12) is not implemented as a re-spawn.** The task spec says "Fix Worker completes → re-run tests → COMPLETE (or FAILED if max retries)." The Fix Worker Prompt (line 1257) says "if test failures were fixed: re-run the test suite to verify they pass" — inline inside the Fix Worker's own session. This is a valid implementation choice but means the Supervisor never sees a post-fix test result. If the inline test re-run shows regressions, the Fix Worker has no escalation path back to the Supervisor — it must either pass its own exit gate or write an exit-gate-failure.md. There is no mechanism to spawn a second Fix Worker or re-trigger testing via a new TestLead after fixing. The task spec implied the Supervisor would orchestrate a re-test loop; the implementation moves this responsibility into the Fix Worker silently.

**No "Testing: skip" field is documented in task.md template.** The supervisor references it but there is no corresponding documentation or enforcement.

---

## Findings

### Blocking

**B1: FIXING state is invisible after compaction recovery.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, Step 1 (lines 310-315) and Step 2 (line 335)
- **Scenario**: Fix Worker is running. Supervisor context compacts. On recovery, Step 1 reconciliation has no case for `FIXING in registry`. Step 2 only reads tasks with CREATED/IN_PROGRESS/IMPLEMENTED/IN_REVIEW status — FIXING is excluded. The task vanishes from the Supervisor's awareness. No Fix Worker is re-spawned. The task stalls permanently unless the user manually restarts.
- **Evidence**: Step 2 line 335: `"For each task with status CREATED, IN_PROGRESS, IMPLEMENTED, or IN_REVIEW"` — FIXING absent. Step 1 cases: Cases 1-5 cover COMPLETE, CREATED, IMPLEMENTED, IN_REVIEW but not FIXING.
- **Fix**: Add FIXING to the Step 2 task status filter. Add Case 6 to Step 1 reconciliation: "FIXING in registry, worker NOT in MCP → treat as failed Fix Worker, re-queue for Fix Worker spawn."

**B2: state.md example shows incorrect `expected_end_state` for ReviewLead.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, line 1403
- **Scenario**: The state.md format example shows `| def-456 | TASK_2026_004 | ReviewLead | ... | COMPLETE |` for the `Expected End State` column. But the spec at line 531 clearly states ReviewLead `expected_end_state="REVIEW_DONE"`. An implementation that faithfully copies the state.md example will record COMPLETE for ReviewLead workers, which means Step 7c's validation ("ReviewLead expected transitions: none — stays at IN_REVIEW. Detected by review-context.md having `## Findings Summary` section") will be bypassed — the Supervisor will look for a COMPLETE registry state instead of file-based detection, causing ReviewLead completions to never be recognized.
- **Evidence**: Line 1403: `expected_end_state = COMPLETE` for ReviewLead row. Line 531: `expected_end_state="REVIEW_DONE"`.
- **Fix**: Change the state.md example at line 1403 to show `REVIEW_DONE` for the ReviewLead row.

### Serious

**S1: "Both done" verdict matching is too broad — will produce false positives and false negatives.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, lines 651-660 (Combined completion conditions block)
- **Scenario**: The logic checks review files for lines "containing `blocking` or `critical` or findings count > 0." The review format includes a `### Blocking` heading even when findings are "None." Any review file with that section header will trigger the match. Conversely, FAIL verdicts embedded in prose rather than the Verdict section may be missed.
- **Fix**: Narrow the check to the specific `## Verdict` section's value. Accepted verdicts are `FAIL`, `PASS WITH NOTES`, `PASS`. Do not search for free-text "blocking" — search for `| Verdict | FAIL |` or a normalized verdict field.

**S2: `Testing: skip` field detection is undocumented and unimplemented.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, Step 5a (line 460-464) and the task spec (task.md lines 78-79)
- **Scenario**: The task spec explicitly lists `"Task has Testing: skip: Supervisor only spawns Review Lead"` as a required edge case. No implementation in Step 5a reads a `Testing` field from task.md. The only test-skip signal is the log event format mentioning "task type does not require tests," but no list of qualifying types is defined. The `Testing: skip` path is a dangling requirement.
- **Impact**: Tasks where the author explicitly signals no tests are needed will still get a TestLead spawned, consuming a concurrency slot and producing a test-report.md, wasting resources and potentially producing a false "no tests found" report.
- **Fix**: Define the `Testing` field in task.md schema. In Step 5a, when task state is IMPLEMENTED, read the `Testing` field. If `Testing: skip`, spawn only Review Lead and treat TestLead as pre-completed (log `TEST SKIP`).

**S3: Single-task mode description is stale and does not describe FIXING state behavior.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, line 159 (Modes table)
- **Scenario**: Single-task mode description says "spawn Review Worker... monitor until COMPLETE." It does not mention that two workers (ReviewLead + TestLead) are spawned simultaneously, that FIXING state may be entered, or that a Fix Worker or Completion Worker may be spawned. A user or an agent reading the Modes table to understand single-task behavior will have an incorrect mental model.
- **Fix**: Update single-task mode description to reflect the parallel ReviewLead+TestLead spawn, FIXING state, and conditional FixWorker/CompletionWorker.

### Minor

**M1: Findings Summary section integrity is not validated before "Both done" evaluation.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, lines 626-661
- **Scenario**: The Supervisor detects ReviewLead done by the presence of `## Findings Summary`. If the ReviewLead writes a partial summary (heading present, counts missing), the Supervisor proceeds to "Both done" evaluation and reads the review files directly. The Findings Summary is never used for the decision — only the heading presence is used for completion detection. This is architecturally fine but the counts in the summary are then never validated or used. The summary becomes documentation-only metadata that could mislead Fix Workers or humans reading it if counts are wrong.
- **Recommendation**: Either validate and use the summary counts, or add a comment noting that counts are informational and decisions are made from review files directly.

**M2: Step 2 does not read FIXING tasks — so task.md File Scope is not available for serialized review overlap detection (Step 3c) for tasks in FIXING.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, lines 331-340 (Step 2) and lines 419-433 (Step 3c)
- **Scenario**: Step 3c checks file scope overlaps between IMPLEMENTED tasks. FIXING tasks are not read in Step 2, so their file scope is absent from the overlap matrix. If a FIXING task and an IMPLEMENTED task share files, the overlap will not be detected. This is a gap but lower risk since FIXING tasks are actively being worked on and typically don't have concurrent review workers.
- **Recommendation**: This is a consequence of the B1 bug fix — once FIXING is added to Step 2's status filter, this is resolved automatically.

**M3: Cleanup Worker prompt does not handle the FIXING state.**

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, lines 1330-1374 (Cleanup Worker Prompt)
- **Scenario**: The Cleanup Worker assesses task progress and updates the registry. Its assessment logic lists: "If reviews are done and findings are fixed → Set status to COMPLETE (only for Review Worker deaths)." If a Fix Worker dies and the Cleanup Worker is spawned, it may see a completion-report.md (Fix Worker partially wrote it) and set COMPLETE incorrectly, or it may see partial fixes committed and set COMPLETE when the task is not fully fixed. The Cleanup Worker assessment does not check for FIXING state explicitly.
- **Recommendation**: Add a FIXING-specific assessment rule: "If registry shows FIXING, check whether fix commit exists. If yes and completion-report.md exists → COMPLETE. If fix commit exists but no completion-report.md → leave at FIXING. If no fix commit → leave at FIXING."

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Supervisor spawns Review Lead and Test Lead in parallel after IMPLEMENTED | COMPLETE | Implemented in Step 5a, concurrency note documented |
| Supervisor tracks multiple active workers for the same task | COMPLETE | Active Workers table supports multiple rows per task_id |
| Supervisor waits for both leads before transitioning from IN_REVIEW | COMPLETE | 7d logic waits for both before "Both done" evaluation |
| FIXING state added to state machine with proper transitions | PARTIAL | FIXING added to Step 3 dependency classification and Step 5a spawn routing, but NOT in Step 2 status filter or Step 1 reconciliation cases — invisible after compaction |
| Fix Worker spawned when findings or test failures exist | COMPLETE | "Both done" logic sets FIXING and spawns Fix Worker |
| Fix Worker addresses both review findings and test failures | COMPLETE | Fix Worker prompt reads all review files and test-report.md |
| Tasks without test framework skip Test Lead gracefully | PARTIAL | Log event exists (`TEST SKIP`) but no implementation logic in Step 5a determines when to skip. `Testing: skip` field is unimplemented |
| Pipeline documentation updated to reflect new flow | COMPLETE | Strategy Quick Reference table, Scope Note, and Review Lead Note all updated in orchestration SKILL.md |
| Exit Gate updated to require review reports + test report | COMPLETE | Review Worker Exit Gate checks for review files and test-report.md (advisory) |

### Implicit Requirements NOT Addressed

1. **Post-fix test re-run is delegated to the Fix Worker internally** with no Supervisor visibility into whether it passed. The task spec ("Fix Worker completes → re-run tests → COMPLETE or FAILED if max retries") implies a Supervisor-controlled re-test loop. The implementation moves this inside the Fix Worker — the Supervisor never knows if post-fix tests passed.

2. **`Testing: skip` is a documented field in the task spec but has no corresponding schema definition in task.md validation** (Step 2b). Tasks with this field will not be validated for it. New task authors have no guidance on what values are valid.

3. **The orchestration skill's CONTINUATION phase detection table** (orchestration SKILL.md lines 139-141) now has entries for `review-context.md` and `review-context.md + review files (no COMPLETE)` but no entry for FIXING state — a task in FIXING state would have no clear phase detection path if resumed interactively.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| ReviewLead crashes before writing any artifacts | YES | Step 7e → retry path → new ReviewLead spawned | Works correctly |
| ReviewLead crashes after review-context.md but before Findings Summary | YES | `## Findings Summary` absent → 7e retry → Retry prompt resumes from correct step | Works correctly |
| TestLead crashes without test-report.md | YES | Step 7e → retry path → new TestLead spawned | Works correctly |
| Both leads crash simultaneously | YES | Both enter retry path independently | Works, concurrency slots freed |
| ReviewLead done, TestLead still running | YES | 7d waits: "If ReviewLead still running for this task → wait" | Logic correct |
| TestLead done, ReviewLead still running | YES | 7d waits: "If ReviewLead still running for this task → wait" | Logic correct |
| Task has `Testing: skip` | NO | No implementation in Step 5a; log event defined but never triggered | UNIMPLEMENTED |
| Compaction while Fix Worker running | NO | FIXING not in Step 2 filter; no reconciliation case | Fix Worker lost, task stalls |
| concurrency=1 skips TestLead | PARTIAL | Documented in Configuration section but no pre-flight warning | Silently produces incomplete test coverage |
| Both review files and test-report.md have no findings | YES | CompletionWorker spawned | Works correctly |
| Fix Worker prompt references `file scope` but Fix Worker has no task.md context | MINOR | Fix Worker reads review files which implicitly bound scope | Low risk |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risks**:
1. **FIXING state + compaction = permanent stall** (Blocking B1). Any task that enters FIXING and then triggers a compaction becomes invisible to the Supervisor. This is a data-loss equivalent for task progress.
2. **state.md example contradicts spec for ReviewLead expected_end_state** (Blocking B2). An implementation following the example will record `COMPLETE` instead of `REVIEW_DONE`, breaking the file-based completion detection for ReviewLead workers entirely.

**What a robust implementation would also include:**

- FIXING added to Step 2 status filter and Step 1 Case 6 reconciliation
- State.md format example corrected: ReviewLead row → `REVIEW_DONE`
- Step 5a: explicit `Testing: skip` field check from task.md before spawning TestLead
- "Both done" verdict logic narrowed to structured `Verdict` section matching, not free-text search
- Pre-flight warning when `concurrency_limit == 1` that Test Lead will be skipped
- Cleanup Worker prompt: FIXING-state-aware assessment rules
- Single-task mode description updated for parallel workers and FIXING state
