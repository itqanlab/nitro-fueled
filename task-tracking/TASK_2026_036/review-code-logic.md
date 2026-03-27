# Code Logic Review — TASK_2026_036

## Verdict
APPROVE WITH MINOR ISSUES

## Score
7/10

## Findings

### Finding 1: Skip logic omits DOCUMENTATION and RESEARCH from the decision matrix table — MINOR
**File**: `.claude/agents/test-lead.md`
**Section**: Phase 1, Step 6 — Test type decision matrix
**Issue**: The decision matrix table (Step 6) documents FEATURE, BUGFIX, REFACTORING, CREATIVE, and DEVOPS but omits DOCUMENTATION and RESEARCH rows entirely. The skip logic in Step 3 correctly exits early for DOCUMENTATION and RESEARCH before reaching the matrix, so in practice the matrix is never evaluated for those types. However, the omission is inconsistent — a future reader scanning the matrix to understand all supported types will find it incomplete and may incorrectly assume those types fall through to framework detection. The task spec explicitly listed both in the matrix as "No / No / No".
**Fix**: Add DOCUMENTATION and RESEARCH rows to the matrix table showing "No / No / No" for all columns, with a note that these types exit before reaching this step. This documents the full intent without changing behavior.

---

### Finding 2: Unit Test Writer prompt missing the `## Results Section` heading requirement — BLOCKING
**File**: `.claude/agents/test-lead.md`
**Section**: Sub-Worker Prompt Templates — Unit Test Writer Prompt
**Issue**: The Unit Test Writer and Integration Test Writer prompts embedded in `test-lead.md` (the inline prompt templates passed to `spawn_worker`) instruct the sub-worker to "Write your results to test-unit-results.md / test-integration-results.md" but do NOT state the `## Results Section` heading is required. Contrast with the E2E prompt which explicitly says "Write results to … with ## Results Section heading". The Test Lead's continuation check (Phase 2) looks for `## Results Section` to determine if a writer completed. If a Unit or Integration writer completes without writing that heading, the Test Lead will incorrectly re-spawn the writer on retry, potentially doubling the tests.

The `unit-tester.md` agent definition does correctly document this requirement (Step 6 example output shows the heading and Step 6 text says "The `## Results Section` heading is required"). Similarly `integration-tester.md` documents this in Step 6. However the inline prompts in `test-lead.md` do not mention it, and the inline prompts are what actually get passed to `spawn_worker`. An agent running against its agent file alone — not the inline prompt — will see the requirement; but if any drift occurs between the agent file and the prompt, the heading can be omitted silently.
**Fix**: Add an explicit instruction to both the Unit Test Writer Prompt and Integration Test Writer Prompt sections inside `test-lead.md`: "Your results file MUST contain a `## Results Section` heading — the Test Lead uses this to detect that you completed successfully."

---

### Finding 3: Retry Test Lead Prompt does not include the `test-context.md` check in the "skip to exit gate" continuation branch — MINOR
**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: Retry Test Lead Prompt
**Issue**: The Retry Test Lead Prompt continuation check lists five conditions:
1. test-context.md exists? -> context done
2. test-unit-results.md with Results section? -> unit tests done
3. test-integration-results.md with Results section? -> integration tests done
4. test-e2e-results.md with Results section? -> e2e tests done
5. test-report.md with Results section? -> report done

But condition 5 uses "with Results section?" while the First-Run prompt says "test-report.md exists with Results section? -> skip to exit gate". These are consistent. However, the Retry prompt does not instruct the agent to "skip to exit gate" upon finding test-report.md — it says "report done" with no explicit routing instruction. A strict reader might continue executing "Complete all remaining phases: execution, report, exit gate" even when the report already exists. The First-Run prompt is unambiguous ("-> skip to exit gate") but the Retry prompt uses the vaguer "-> report done". Under the "Resume from the first incomplete step" rule, a complete report means no incomplete step, so the agent should exit — but the routing is implicit rather than explicit.
**Fix**: Change the Retry prompt's step 1.5 line from "test-report.md with Results section? -> report done" to "test-report.md with Results section? -> skip directly to Exit Gate".

---

### Finding 4: `concurrency_limit == 1` handling silently delays Test Lead indefinitely — SERIOUS
**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: Configuration note — "Concurrency and Review+Test phase"
**Issue**: The note says "If `concurrency_limit == 1`: spawn Review Lead first. Spawn Test Lead only after Review Lead finishes or a slot opens." This is correct for slot management, but the handling of the slot-opens condition has a silent failure mode: if the Supervisor spawns the Review Lead (1 slot used, 0 left), and the Review Lead completes and sets the task COMPLETE, the Supervisor's completion handler (Step 7d, COMPLETE branch) immediately moves the task to the completed list and removes all workers for that task — without checking whether a Test Lead was deferred and needs to be spawned. Under `concurrency_limit == 1`, the "spawn Test Lead after Review Lead" intent is never fulfilled if Review Lead crosses the finish line first, because the COMPLETE state causes the Supervisor to consider the task done.

The SKILL.md confirms "Test Lead does NOT block COMPLETE" — so formally the behavior is correct per spec. But the note about spawning Test Lead "after Review Lead finishes or a slot opens" creates a misleading implication that the Test Lead will eventually run even with `concurrency_limit == 1`. In practice it will never run in that configuration because the task is already COMPLETE by the time a slot opens.
**Fix**: Update the concurrency note to state explicitly: "With `concurrency_limit == 1`, the Test Lead may never execute — Review Lead completes the task before a slot opens. Users with `concurrency_limit == 1` should accept that test coverage is skipped for that run."

---

### Finding 5: Worker type enum in auto-pilot state table is inconsistent — MINOR
**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: Step 5e — worker_type recording
**Issue**: Step 5e specifies `worker_type="Build"|"Review"|"ReviewLead"|"TestLead"`. The worker log format in Step 7h (worker-logs section) shows `Worker Type | Build \| Review \| Cleanup` with no mention of "ReviewLead" or "TestLead". A reader writing tooling to parse worker logs would encounter a value that isn't listed in the documented enum. This also means the worker log template does not capture Test Lead outcomes in its Outcome field or Review Verdicts section — the "Review Verdicts (Review Workers)" section omits Test Lead workers, which is correct, but there is no "Test Results (Test Lead Workers)" section defined for the worker log format.
**Fix**: Either add "ReviewLead" and "TestLead" to the `Worker Type` field allowed values in the worker log template, or explicitly note in Step 7h that Test Lead workers use `Worker Type = TestLead` and skip the Review Verdicts section.

---

### Finding 6: Integration Test Writer `test-integration-results.md` FINAL action ordering is inverted — MINOR
**File**: `.claude/agents/integration-tester.md`
**Section**: CRITICAL OPERATING RULES + Step 6/7 ordering
**Issue**: The CRITICAL OPERATING RULES header states "Write `test-integration-results.md` as the FINAL action before the commit." But Step 6 writes the results file and Step 7 commits. This means the results file is written before the commit, making the commit the actual final action, not the results file. This is the same ordering as `unit-tester.md`. The rule text says "FINAL action before the commit" which is technically correct (it is the last action before the commit), but the wording is confusing — it implies results file is the very last thing, when in fact the commit follows. Compare to the Review Lead which says "Write the registry update (COMPLETE) as the FINAL action before exit" — there the FINAL action really is the absolute last thing. The misleading wording in the tester agents could cause a future editor to swap the order in a refactor, creating results files that are committed before the content is complete.
**Fix**: Reword to "Write `test-integration-results.md` immediately before the commit — the commit is the final action."

---

### Finding 7: DEVOPS task type has no framework detection path — MINOR
**File**: `.claude/agents/test-lead.md`
**Section**: Phase 1, Step 3 — Apply skip decisions
**Issue**: The skip logic explicitly exits for DOCUMENTATION, RESEARCH, and (conditionally) CREATIVE. DEVOPS tasks fall through to framework detection. However, DEVOPS tests (pipeline/infra tests) typically use shell scripts, Dockerfile linting, or CI configuration — not vitest/jest/pytest/go test. The 7 detection methods listed will all return NONE for a typical DEVOPS task. Step 5 says: "If no framework detected and type is not CREATIVE → write test-report.md noting 'no test framework detected — recommend setup' and EXIT." So a DEVOPS task with no detected test framework exits cleanly — the decision matrix row for DEVOPS (which requires integration tests) is never reached. This means DEVOPS integration tests are silently skipped for most DEVOPS tasks without the test-report noting the correct reason (which should be "no test framework suitable for DEVOPS tasks detected" rather than the generic "no test framework").

This is a design gap rather than a hard bug — the spec's 7 detection methods don't cover DEVOPS-specific tooling. The behavior (skip) matches the task spec's intent for projects without a test framework, but the reported reason in test-report.md will be misleading for DEVOPS tasks.
**Fix**: Add an explicit DEVOPS check to Step 3: if Type is DEVOPS and no framework detected, write test-report.md noting "DEVOPS task — no test framework detected. Recommend manual pipeline test verification."

---

### Finding 8: test-report.md uses `## Results` but continuation check looks for `## Results Section` — BLOCKING
**File**: `.claude/agents/test-lead.md` + `.claude/skills/auto-pilot/SKILL.md`
**Section**: Phase 5 test-report format vs. Phase 2 continuation check
**Issue**: The continuation check in `test-lead.md` Phase 2 says:
> If `test-report.md` already exists with a `## Results` section → skip to Exit Gate.

The auto-pilot First-Run prompt says:
> test-report.md exists with Results section? -> skip to exit gate

However, the test-report.md template in Phase 5 defines these sections: `## Summary`, `## Tests Written`, `## Test Results`, `## Coverage Delta`, `## Implementation Issues Found`, `## Notes`. There is NO `## Results` or `## Results Section` heading in the test-report.md template. The continuation detection heading that Phase 2 looks for (`## Results`) does not appear in the output format that Phase 5 defines.

This means: if the Test Lead completes and writes test-report.md following the Phase 5 template, then is retried (e.g., due to a transient MCP error after writing the report), the continuation check in Phase 2 will NOT detect that test-report.md is complete, and will re-execute the entire pipeline — re-spawning sub-workers, re-running tests, and overwriting test-report.md.

Contrast this with the sub-worker results files: `test-unit-results.md` and `test-integration-results.md` templates both include an explicit `## Results Section` heading, so their continuation checks work correctly.
**Fix**: Either (a) add a `## Results` heading to the test-report.md template (e.g., rename `## Summary` to `## Results` or add a `## Results` section), or (b) change the continuation check from looking for `## Results` to looking for `## Test Results` which is already in the template. Option (b) is lower risk — `## Test Results` is a heading unique to test-report.md.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The most serious silent failure is Finding 8: the test-report.md continuation check looks for `## Results` but the template never writes that heading. On a retry, the Test Lead silently re-runs all test phases from scratch. The sub-workers write duplicate test files; test suite runs twice; the second test-report.md overwrites the first. The Supervisor sees normal behavior — test-report.md eventually exists — and never detects the double execution. Cost doubles, commits are duplicated.

A secondary silent failure (Finding 4): with `concurrency_limit == 1`, the Test Lead never runs at all. The Supervisor logs no error and the task is marked COMPLETE. Test coverage is zero. No warning appears in the completion-report.md because the Test Lead never ran to write a "skipped" test-report.md.

### 2. What user action causes unexpected behavior?

A user who sets `concurrency_limit=1` to run conservatively will discover that all tasks complete with zero test coverage. The documentation implies Test Lead will run "after Review Lead finishes" but the COMPLETE transition closes the task before that can happen.

A user who retries a stuck Test Lead (via the Retry prompt) where the previous run completed the test-report.md but had no `## Results` heading will trigger full re-execution of all test writers and test suite run. This could take 30+ minutes and overwrite previously-written test files.

### 3. What data makes this produce wrong results?

- A task.md with `Testing: skip` that also has Type FEATURE will skip correctly (skip field takes priority in Phase 1 Step 3). This is correct.
- A task.md where the Testing field is present but misspelled (e.g., `Testing: SKIP` with capital letters) is not guarded. The Phase 1 Step 3 check performs a case-sensitive string comparison. "SKIP" != "skip" → the skip logic fails silently and the test phase runs. The task template uses lowercase ("required | optional | skip") but the guard in test-lead.md should normalize or document case sensitivity.
- A task.md with CREATIVE type and a vitest framework detected will proceed to the decision matrix, which says "No / No / Optional (only if Playwright/Cypress detected and UI files in scope)". If the detected framework is vitest (not Playwright/Cypress), unit and integration tests are No, and E2E is conditional on Playwright/Cypress — so no workers are spawned. The Test Lead will then call Phase 3 monitoring with an empty spawned list, proceed to Phase 4 (run test suite), and run `npm test` against zero new test files. This is not harmful but produces a noisy test-report.md that implies the test suite ran as part of this task when it wasn't.

### 4. What happens when dependencies fail?

- MCP unavailable: the First-Run prompt handles this (write test-report.md noting "MCP unavailable"). The test-lead.md agent definition does NOT have this check — the agent instructions assume MCP is available. If the agent is invoked directly (not via the prompt), it will hit MCP errors without the graceful exit.
- Sub-worker spawn fails for Unit Test Writer: exit-gate-failure.md is written and the Test Lead exits. The Supervisor sees no test-report.md → treats Test Lead as failed → retries. On retry, the Retry prompt doesn't re-check the exit-gate-failure.md condition and will attempt to spawn again. No infinite loop protection specific to spawn failure (the general retry limit handles this, but the retry limit is shared with Build Worker retries).
- Test command unavailable (no node_modules): Phase 4 Step 6 handles this gracefully — writes note in test-report.md and skips execution. Correct.
- Concurrent git commits from Unit Test Writer + Integration Test Writer: both commit test files independently. If both finish at nearly the same time and both run `git add ... && git commit`, the second commit may hit a lock or conflict on the working tree. No coordination mechanism is defined between sub-workers for git operations.

### 5. What's missing that the requirements didn't mention?

- **Commit conflict coordination**: Two test writers committing simultaneously with no lock or sequencing instruction. Git will serialize via its own locking, but if one worker does `git add -A` style staging, it may pick up the other's files.
- **Test execution environment assumption**: Phase 4 assumes `node_modules` exist or handles the "unavailable" case. But it does not handle the case where tests exist but the environment is CI-like with no display (E2E Playwright requires a display or `--headed=false`). This produces misleading failures.
- **Coverage delta baseline**: Phase 4 Step 5 mentions "coverage delta" but there is no mechanism to establish a baseline (coverage before this task's tests). Without a before/after comparison, "delta" is just the current coverage total, which may already include many existing tests.
- **File placement when no existing tests exist**: unit-tester.md Step 4 says "Find 2-3 existing test files" but if there are none (greenfield project), it falls back to co-location. The fallback is documented, but the `Glob(**/*.spec.ts)` returning zero results must not block Step 5. The agent instructions don't explicitly handle the zero-results case with a continue instruction — a literal reader might stop at "Find 2-3 existing test files" if none are found.

---

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| Test Lead agent created with framework detection and test type decision matrix | PASS — all 7 detection methods present; decision matrix implemented (with minor gap on DOCUMENTATION/RESEARCH rows) |
| Test Lead spawns parallel test writers via MCP with appropriate models | PASS — parallel spawn, correct model routing (Sonnet for unit+e2e, Opus for integration) |
| Unit Test Writer produces tests following project conventions | PASS — convention discovery via Glob, pattern-matching steps documented |
| Integration Test Writer produces cross-boundary tests | PASS — real in-memory DB requirement, boundary interaction scope documented |
| Test Lead executes test suite after writers complete | PASS — Phase 4 executes test command, handles unavailable runner |
| `test-report.md` written to task folder with results and coverage | PASS — template defined with all required sections |
| Test Lead runs in parallel with Review Lead (not sequential) | PASS — auto-pilot spawns both simultaneously; concurrency note in SKILL.md |
| Tasks with `Testing: skip` or CREATIVE type skip test phase gracefully | PASS — skip logic in Phase 1 Step 3 covers both cases |
| Implementation issues found by tests are flagged for fix phase | PASS — Phase 4 Step 4 distinguishes test bugs vs implementation bugs; implementation bugs go to test-report.md under "Implementation Issues Found" |
| Test framework auto-detected from project config | PASS — 7 detection methods implemented covering all task spec targets |

---

## Summary

The core design is sound and most of the specified logic is correctly implemented. The two blocking findings are: (1) the Unit Test Writer and Integration Test Writer inline prompts do not mention the `## Results Section` heading requirement, creating a continuation detection gap; and (2) the test-report.md template does not include a `## Results` heading, so the continuation check that looks for that heading will always fail, causing unnecessary full re-execution on every retry. The `concurrency_limit == 1` behavior is not a logic error but creates a misleading documented behavior where the Test Lead "will run after Review Lead" in practice never happens, resulting in silent zero test coverage. These issues should be addressed before relying on the Test Lead in production auto-pilot runs.
