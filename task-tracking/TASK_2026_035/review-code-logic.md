# Code Logic Review — TASK_2026_035

## Review Summary

| Metric              | Value                  |
| ------------------- | ---------------------- |
| Overall Score       | 6/10                   |
| Assessment          | NEEDS_REVISION         |
| Critical Issues     | 2                      |
| Serious Issues      | 5                      |
| Moderate Issues     | 4                      |
| Failure Modes Found | 8                      |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Fix commit detection in Exit Gate and continuation logic is broken.** The Exit Gate check in `review-lead.md` reads: "Fix commit exists in `git log` (message: `fix(TASK_[ID]): address review findings`)". This is the only mechanism to detect whether the fix phase ran. A Review Lead that has no findings to fix — entirely valid for a clean implementation — will never produce this commit, and will therefore always fail the Exit Gate. The agent will loop attempting to fix an unfixable check, or write `exit-gate-failure.md` on a perfectly clean task. There is no "no findings" path through the fix phase that still passes the Exit Gate.

**Model string mismatch between files is silent.** `review-lead.md` and the auto-pilot prompts specify `claude-opus-4-5` for the Logic Reviewer. The auto-pilot Supervisor's Provider Routing Table (line ~458) specifies `claude-opus-4-6` for deep-reasoning review work. No reconciliation is documented. If `spawn_worker` rejects an unrecognized model string, the Logic Reviewer silently fails to spawn with no retry path.

### 2. What user action causes unexpected behavior?

A task that produces zero findings across all three reviews will cause the Review Lead to fail its own Exit Gate. The fix commit check has no conditional branch for "no findings — skip fix commit but still pass gate." The developer who ships a clean implementation gets a failed review cycle.

A Supervisor retry on a crashed Review Lead re-enters via the Retry Review Lead Prompt, which tells the agent to "resume from the first incomplete step." But the Retry Prompt does not instruct the agent to re-verify MCP availability (step 2 of the First-Run Prompt). If MCP was the reason for the crash, the retry will silently proceed to Phase 2, attempt to spawn sub-workers without MCP, and fail again without writing `exit-gate-failure.md` — resulting in a stuck rather than a documented failure.

### 3. What data makes this produce wrong results?

A task whose implementation commit message does not match the pattern `feat(TASK_[ID]):` will cause Phase 1 Step 2/3 to identify the wrong commit. The instruction says "look for the commit with message matching `feat(TASK_[ID]):` or similar" — "or similar" is an undefined pattern for an autonomous agent. A commit like `fix(TASK_2026_035): address build issue` will match ambiguously, and the resulting `git diff` will produce a wrong or empty diff. The review-context.md will then contain incorrect scope information, and reviewers will either review the wrong diff or review nothing.

A task whose `task.md` does not have a clearly delineated "File Scope" section will cause Phase 1 Step 1 to silently produce an empty or malformed scope boundary. The Scope Boundary section in `review-context.md` is populated from this section — if the section is missing, sub-workers get no scope restriction and may review unrelated files.

### 4. What happens when dependencies fail?

**MCP unavailability**: The First-Run Prompt correctly checks MCP availability (step 2) and stops with `exit-gate-failure.md`. However, the Retry Prompt omits this check entirely. If MCP fails between the first run and the retry, the Retry Review Lead will reach Phase 2, call `spawn_worker`, fail, and have no documented behavior for that scenario (the retry prompt says only "spawn a sub-worker via MCP" with no error branch).

**Sub-worker spawning failure in Phase 2**: The failure path says "log the failure, continue spawning remaining reviewers, mark as skipped." However, there is no instruction to persist which reviewers were skipped. After two minutes of polling, the Review Lead calls `get_worker_activity` on worker IDs that were never successfully created. The behavior of calling `get_worker_activity` on a null/invalid worker ID is unspecified and will likely produce an error that halts the polling loop.

**All three sub-workers fail**: The exit condition in Phase 3 says "if BOTH style and logic reports are missing, write exit-gate-failure.md." If all three fail, the same path applies — this is handled. But if only style and logic fail but security succeeds, the Review Lead proceeds to fix phase with only a security report and no style/logic reports. The fix priority order (critical > serious > minor) is preserved, but the exit gate still requires "at least style + logic review files exist" — so the Review Lead will fail the gate even though it had at least one valid report. The condition should arguably be "at least 2 of 3" not specifically "style + logic," but the gate contradicts the phase 3 text which correctly says "at least 2 of 3."

### 5. What's missing that the requirements didn't mention?

**Concurrent lessons writes**: All three sub-workers are instructed to "Append new lessons to `.claude/review-lessons/review-general.md`" simultaneously. Three parallel workers appending to the same file with no coordination will produce interleaved content, duplicate lessons, or lost writes (last-write-wins on file I/O). The registry write safety section in auto-pilot covers this for `registry.md` but there is no equivalent protection for `review-lessons/review-general.md`.

**Review Lead lesson update step is absent**: The Review Lead's Phase 5 (Completion) has no instruction to update `.claude/review-lessons/`. The sub-workers update lessons, the Review Lead does not. This means findings that the Review Lead itself discovers during the fix phase (e.g., patterns noticed while applying fixes) are never captured. More importantly, if sub-workers failed and produced no reports, no lessons are added at all.

**No timeout on the monitoring loop**: Phase 3 polls every 2 minutes indefinitely ("continue polling until all sub-workers reach finished or failed state"). The Supervisor's two-strike stuck detection will eventually kill a stuck Review Lead, but the Review Lead itself has no internal timeout. A sub-worker that hangs in `healthy` (never progressing but never triggering the MCP `stuck` health state) would block the Review Lead indefinitely. The Supervisor monitors the Review Lead at 5-minute intervals, so the outer kill will eventually fire — but this is undocumented and leaves a window where the Review Lead holds an active Supervisor slot with no internally enforced deadline.

**AC for wall-time and cost reduction are not mechanically testable**: Two acceptance criteria — "~40% faster" and "~30-40% cheaper" — have no verification mechanism in the Exit Gate or completion report. They depend on empirical measurement across multiple runs, not on any check the Review Lead can perform. These ACs will always be "assumed met" without any production data.

---

## Failure Mode Analysis

### Failure Mode 1: Exit Gate Blocks Clean Tasks

- **Trigger**: A task with zero review findings (all three reviewers produce APPROVE with no issues) completes all phases but has no fix commit.
- **Symptoms**: Review Lead enters a loop trying to satisfy the Exit Gate, eventually writes `exit-gate-failure.md`, and the Supervisor retries the entire Review Lead. The task never reaches COMPLETE despite being clean.
- **Impact**: Every well-written task is blocked at review completion. This is a systemic correctness failure, not an edge case.
- **Current Handling**: None. The Exit Gate check is unconditional: "Fix commit exists in git log."
- **Recommendation**: Change the Exit Gate check to: "Fix commit exists in git log OR all review reports show APPROVE with zero findings." Also add an explicit step in Phase 4 that handles the no-findings case: "If the unified finding list is empty, write a note in completion-report.md: 'No findings — fix commit skipped.' Do not attempt to commit."

### Failure Mode 2: Polling Loop Crashes on Null Worker IDs

- **Trigger**: One or more `spawn_worker` calls fail in Phase 2. The Review Lead marks the reviewer as "skipped" but proceeds to the polling loop with only the successfully spawned worker IDs.
- **Symptoms**: If the implementation iterates all three expected worker IDs and calls `get_worker_activity` on a null/invalid ID for the skipped reviewer, the MCP call will error. The error handling for this scenario is not specified.
- **Impact**: Polling loop halts or produces an unhandled error. Review Lead gets stuck. Supervisor eventually kills it. Retry restarts Phase 2 (correct) but the same spawn failure may recur.
- **Current Handling**: Spawn failure handling says "mark as skipped." There is no instruction to exclude skipped worker IDs from the polling loop.
- **Recommendation**: Phase 2 should maintain a `spawned_workers` list containing only successfully spawned worker IDs. Phase 3 should poll only the workers in that list, not a hardcoded list of three.

### Failure Mode 3: Wrong Commit Identified for Git Diff

- **Trigger**: Implementation commits use a non-standard message prefix, or the task had multiple fix/documentation commits after the main implementation commit.
- **Symptoms**: Phase 1 Step 2 runs `git log --oneline -10` and looks for "feat(TASK_[ID]): or similar." The Review Lead selects the wrong commit. The diff in `review-context.md` covers different files or is empty.
- **Impact**: Sub-workers review the wrong changes or review nothing. The review pass produces irrelevant or empty reports. The Review Lead cannot detect this error.
- **Current Handling**: The implementation plan's design note says "look for the commit with message matching `feat(TASK_[ID]):` or similar." No fallback for when this pattern does not match.
- **Recommendation**: Define a deterministic fallback: if no commit matching `feat(TASK_[ID]):` is found in the last 10, use `git diff HEAD -- [files_in_scope]` (diff against working tree) or `git log --all --oneline -- [files_in_scope]` to find any commit touching those files.

### Failure Mode 4: Concurrent Review-Lessons Writes Corrupt the File

- **Trigger**: All three sub-workers complete their reviews at approximately the same time and simultaneously attempt to append to `.claude/review-lessons/review-general.md`.
- **Symptoms**: Interleaved content, duplicate entries, or one worker's append silently overwriting another's (depending on OS file-write atomicity). The corruption is silent — no worker reports it.
- **Impact**: Lesson accumulation is degraded or corrupted. The entire value-add of the parallel review pattern (lessons learned) is damaged.
- **Current Handling**: None. The sub-worker prompts instruct all three to append to the same file with no coordination.
- **Recommendation**: Only one writer should update review-lessons. The cleanest solution is to remove the lessons-update step from sub-worker prompts and add it to the Review Lead's Phase 5 (Completion Phase), which runs after all sub-workers have exited.

### Failure Mode 5: Registry Shows IN_REVIEW If Completion Commit Fails

- **Trigger**: The completion commit (`docs: add TASK_[ID] completion bookkeeping`) fails (e.g., git hook error, merge conflict).
- **Symptoms**: The registry was updated to COMPLETE (the "FINAL action before exit") but the commit failed. The registry file on disk shows COMPLETE but the commit history does not include the change. After a Supervisor restart, the Supervisor reads the file as COMPLETE and considers the task done. But the uncommitted change is in the working tree and will be swept up by the next worker.
- **Impact**: Task appears COMPLETE to the Supervisor but the bookkeeping commit is missing. Orphaned registry state.
- **Current Handling**: Phase 5 Step 3 says "Update registry.md — set status to COMPLETE. This is the FINAL action before exit." Step 4 says "Commit." There is no verification that the commit succeeded before exit.
- **Recommendation**: The commit and the registry update should be in the same atomic operation, or the Exit Gate should verify that `registry.md` shows COMPLETE in a committed state (not just in working tree).

### Failure Mode 6: Sonnet Review Lead Cannot Fix Complex Logic Issues

- **Trigger**: The Logic Reviewer (Opus) produces a Critical finding in a complex file. The Review Lead (Sonnet) reads the finding and attempts to apply the fix.
- **Symptoms**: Sonnet applies an incorrect or partial fix to a complex logic issue. The fix commit contains the wrong change. The task is marked COMPLETE with a bad fix silently applied.
- **Impact**: Incorrect fix applied to implementation files. Worse than no fix — introduces a new bug while masking the original finding.
- **Current Handling**: The design note says "if the Review Lead is Sonnet and cannot confidently fix a complex logic issue, it should document the finding as 'unable to fix — requires manual review'." This relies entirely on the model's self-awareness of its own limitations.
- **Recommendation**: Add an explicit instruction in Phase 4: "For any finding classified as Critical or Blocking by the Logic Reviewer, apply only trivially mechanical fixes (typos, missing fields, obvious omissions). For any fix that requires understanding algorithm correctness or control flow, document as 'requires manual review' regardless of confidence."

### Failure Mode 7: Exit Gate Contradiction Between Phase 3 and Gate Check

- **Trigger**: Style and Logic sub-workers both fail. Security sub-worker succeeds and writes its report.
- **Symptoms**: Phase 3 says "do not halt if only one or two reviewers produced reports" and the minimum is "style + logic." But if only security produced a report, Phase 3 says to continue. Then the Exit Gate check requires "at least style + logic review files exist" — which fails. The Review Lead tries to fix this check, cannot, writes `exit-gate-failure.md`, and exits. Supervisor retries. On retry, all three reviewers re-run (security was already done but retry may skip it via continuation check). If style and logic succeed on retry, the task completes. This path works — but it requires a full Supervisor retry and re-spawning of sub-workers.
- **Impact**: Not a correctness failure but an efficiency failure — an unnecessary retry loop when the minimum viable condition should be "2 of 3 any type" not "specifically style + logic."
- **Current Handling**: Phase 3 text says "minimum viable: style + logic reports." Exit Gate says "at least style + logic review files." These are consistent with each other but contradict the AC which says "2 of 3 minimum viable" logic without specifying which 2.
- **Recommendation**: The AC in task.md says "Review Lead handles sub-worker failures (retry or document failure)." The implementation's choice of "style + logic minimum" is a valid policy decision, but it should be explicitly documented as a design choice (not just implicit from the two files agreeing) so future maintainers understand why security-only is insufficient.

### Failure Mode 8: Retry Prompt Omits MCP Availability Check

- **Trigger**: A Review Lead crashes because MCP was unavailable. The Supervisor retries it using the Retry Review Lead Prompt.
- **Symptoms**: Retry Prompt has no step to verify MCP availability before proceeding. The retry reaches Phase 2, calls `spawn_worker`, gets an MCP error, and the error handling path in Phase 2 (spawn failure for individual reviewer) applies — it marks all reviewers as "skipped" and continues. The Review Lead then polls an empty worker list, concludes all are "done," and proceeds to fix and completion with zero reports.
- **Impact**: A task with zero review reports gets a fix phase (nothing to fix), a completion report with N/A scores for all reviews, and is marked COMPLETE. The task was never reviewed.
- **Current Handling**: The Retry Prompt lacks the MCP check that the First-Run Prompt has.
- **Recommendation**: Add step 1.5 to the Retry Prompt: "Verify MCP is available: call `mcp__session-orchestrator__list_workers`. If MCP is unavailable, write `exit-gate-failure.md` and exit. Do not proceed without MCP."

---

## Critical Issues

### Issue 1: Exit Gate Fails on Clean Tasks — No "Zero Findings" Path

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Exit Gate section (line 289)
- **Scenario**: Any task where all three reviewers produce APPROVE with zero issues. No fix commit is generated because there is nothing to fix. The Exit Gate check "Fix commit exists in git log (message: `fix(TASK_[ID]): address review findings`)" fails unconditionally.
- **Impact**: Every clean task loops at the Exit Gate or exits with `exit-gate-failure.md`. The task is permanently blocked from reaching COMPLETE without a spurious commit.
- **Evidence**: Phase 4 Steps 1-6 process findings. If the unified finding list is empty, none of the steps produce a commit. The Exit Gate has no conditional branch for this case.
- **Fix**: Change Exit Gate check 3 to: "Fix commit exists in git log OR completion-report.md contains a 'No findings' note." Add an explicit branch to Phase 4: "If unified finding list is empty, write 'No findings — fix commit skipped' to completion-report.md and proceed to Phase 5. Do not commit."

### Issue 2: Retry Prompt Missing MCP Availability Check Enables Ghost Completion

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` — Retry Review Lead Prompt (line 1007)
- **Scenario**: Review Lead crashes due to MCP unavailability. Supervisor retries. Retry Prompt proceeds without MCP check, reaches Phase 2, gets spawn failures for all three reviewers, marks all as "skipped," polls empty worker list, proceeds to completion with zero reports, marks task COMPLETE.
- **Impact**: A task is marked COMPLETE without any review having occurred. This is the most dangerous failure mode — the system's primary correctness guarantee (review before COMPLETE) is silently bypassed.
- **Evidence**: Retry Prompt has 5 steps. No step checks MCP availability. First-Run Prompt Step 2 does this check. The retry path copied the core logic but omitted the safety check.
- **Fix**: Add after Retry Prompt Step 1: "1.5. Verify MCP is available: call `mcp__session-orchestrator__list_workers`. If MCP is unavailable, write `exit-gate-failure.md` and exit. Do not proceed without MCP."

---

## Serious Issues

### Issue 3: Concurrent Lesson Writes from Three Parallel Sub-Workers

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Sub-Worker Prompt Templates (lines 144, 168, 194)
- **Scenario**: All three sub-workers complete within seconds of each other and all attempt to append to `.claude/review-lessons/review-general.md` simultaneously.
- **Impact**: File corruption ranging from interleaved content to silent last-write-wins overwrite of one worker's lessons. The review-lessons accumulation mechanism — a core project value — is damaged for every parallel review.
- **Fix**: Remove the lessons-update step from sub-worker prompts. Add it to Phase 5 of review-lead.md with instruction: "After writing completion-report.md, read all three review reports and append any new lessons they identified to `.claude/review-lessons/review-general.md`."

### Issue 4: Polling Loop Calls get_worker_activity on Null Worker IDs

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Phase 3 (line 205)
- **Scenario**: One or two `spawn_worker` calls fail in Phase 2. Phase 3 polls "each sub-worker via MCP `get_worker_activity`." No instruction excludes failed spawns from the poll list.
- **Impact**: MCP call on invalid/null worker ID produces an error. Phase 3 polling loop halts. Review Lead becomes stuck. Supervisor eventually kills it and retries.
- **Fix**: Phase 2 should explicitly maintain a `spawned_worker_ids` list. Phase 3 should reference this list: "Poll each worker ID in `spawned_worker_ids`."

### Issue 5: Model String Mismatch — claude-opus-4-5 vs claude-opus-4-6

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` (line 74) and `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` Provider Routing Table (line 458)
- **Scenario**: review-lead.md and auto-pilot prompts specify `claude-opus-4-5` for Logic Reviewer. The Supervisor's Provider Routing Table specifies `claude-opus-4-6` for logic review workers. If these are different real model identifiers, `spawn_worker` may fail or route to the wrong model.
- **Impact**: Logic Reviewer spawns with wrong model (reduced reasoning quality) or spawn fails silently. No mechanism to detect this.
- **Fix**: Reconcile to a single canonical model string. Update the implementation plan's "Model string to use" section to match the Provider Routing Table. One of the two files needs to be updated.

### Issue 6: No Deterministic Fallback for Implementation Commit Identification

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Phase 1 Step 2 (line 31)
- **Scenario**: Implementation commit uses a non-standard message, or multiple commits exist with messages containing the task ID.
- **Impact**: Review Lead selects wrong commit. `git diff` produces wrong or empty diff. `review-context.md` contains incorrect scope. Sub-workers review nothing meaningful.
- **Fix**: Add a fallback: "If no commit matching `feat(TASK_[ID]):` is found in the last 10 commits, fall back to `git diff HEAD -- [files_in_scope]` to capture all uncommitted or recently committed changes to in-scope files."

### Issue 7: No Handling for Zero-Report State After Phase 3

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Phase 3, After All Sub-Workers Finish (line 222)
- **Scenario**: All three sub-workers fail. Per Phase 3: "If BOTH style and logic reports are missing, write exit-gate-failure.md and exit." But if security also fails (all three fail), this condition triggers correctly. However, if a sub-worker "finishes" without writing a report (exited cleanly but produced no file), the health check shows `finished` and the worker is marked complete — but the report is missing. The Review Lead then enters Phase 4 with an empty finding list and no reports to read.
- **Impact**: With zero reports, Phase 4 produces no findings, no fix commit. Exit Gate fails (no fix commit). Supervisor retries. No root cause is documented beyond the generic "both style and logic missing" message, which may not capture the "all three finished but wrote nothing" case.
- **Fix**: Add an explicit check after verifying report files: "If all three report files are missing and all sub-workers showed `finished` (not `failed`), this indicates a systematic sub-worker configuration error. Write `exit-gate-failure.md` with message 'All sub-workers exited without writing reports — likely prompt or agent configuration error.' Do not retry."

---

## Moderate Issues

### Issue 8: Fix Volume Limit (20 Changes) Has No Escalation Path

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Phase 4, Fix Volume Limit (line 254)
- **Scenario**: Reviews produce 25 findings. Review Lead applies 20, stops, and notes "applied what it could."
- **Impact**: 5 findings are silently left unfixed. The completion report notes this, but the Exit Gate does not check for unfixed critical/blocking issues. A Critical finding left unfixed because of the volume limit still allows the task to complete.
- **Recommendation**: The Exit Gate should check: "If completion-report.md contains unfixed Critical findings, recommend REJECTED rather than APPROVED in the report verdict."

### Issue 9: Retry Prompt Does Not Re-Read Agent Instructions

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` — Retry Review Lead Prompt (line 1007)
- **Scenario**: The Retry Prompt does not include "Read your full instructions from: `.claude/agents/review-lead.md`" (which the First-Run Prompt does at line 954). On retry, the Review Lead may operate from its loaded context rather than the latest agent file.
- **Impact**: If `review-lead.md` was updated between the first run and the retry (e.g., a hotfix was applied), the retry session runs stale instructions.
- **Recommendation**: Add to Retry Prompt Step 0: "Read `.claude/agents/review-lead.md` for your full phase instructions."

### Issue 10: Exit Gate in review-lead.md Diverges from orchestration SKILL.md Exit Gate Table

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Exit Gate (line 283); `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md` — Review Worker Exit Gate (line 425)
- **Scenario**: Two separate Exit Gate definitions exist. The review-lead.md gate has 6 checks. The orchestration SKILL.md gate has 7 checks (includes "Findings fixed — all blocking/serious items resolved"). The review-lead.md gate omits the "findings fixed" check.
- **Impact**: A task with unfixed blocking findings can pass the review-lead.md Exit Gate and be marked COMPLETE. This is the known duplicate-spec-drift anti-pattern documented in review-general.md.
- **Recommendation**: review-lead.md Exit Gate should reference orchestration SKILL.md rather than duplicate the checks. Or explicitly note which checks it extends/replaces.

### Issue 11: Completion Phase Order Contradicts orchestration SKILL.md

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — Phase 5 (line 260)
- **Scenario**: Phase 5 Step 3 says "Update registry.md — set status to COMPLETE. This is the FINAL action before exit." Step 4 says "Commit: `docs: add TASK_[ID] completion bookkeeping`." So the registry is updated, THEN committed. If the commit fails, the registry shows COMPLETE on disk but the change is not committed. Orchestration SKILL.md says "commit all bookkeeping changes" as the final step — same ordering issue exists there — but the Review Lead's note that registry update is "FINAL action before exit" is misleading: the commit is actually the final action.
- **Impact**: On git commit failure after registry update, the task appears COMPLETE to any subsequent file reader but the commit is missing.
- **Recommendation**: Reword to: "Update registry.md to COMPLETE, then commit all bookkeeping changes together. The commit is the true final action — the registry update is staged but not persisted until the commit succeeds."

---

## Data Flow Analysis

```
Supervisor
  |
  | spawns Review Lead (claude-sonnet-4-6)
  | via MCP spawn_worker
  v
Review Lead Session
  |
  | Phase 1: reads task.md, git log, CLAUDE.md, review-lessons
  | writes review-context.md
  |
  | [RISK: wrong commit identified — see Issue 4]
  | [RISK: missing File Scope section — empty scope boundary]
  v
  | Phase 2: spawn_worker x3 (without waiting)
  | -> Style (sonnet), Logic (opus-4-5?), Security (sonnet)
  |
  | [RISK: opus model string mismatch — see Issue 5]
  | [RISK: spawn failure leaves null IDs in poll list — see Issue 2]
  v
  | Phase 3: poll every 2 minutes
  | for each worker: get_worker_activity -> finished/failed/stuck
  |
  | [RISK: no timeout — indefinite if worker stays "healthy" — see question 5]
  | [RISK: null worker ID poll error — see Issue 2]
  v
  | Three sub-workers run in parallel:
  | Style -> review-code-style.md + lessons append
  | Logic -> review-code-logic.md + lessons append
  | Security -> review-security.md + lessons append
  |
  | [RISK: concurrent lessons file writes — see Issue 3]
  | [RISK: sub-worker exits without writing report — see Issue 7]
  v
  | Phase 4: read reports, build unified finding list
  | apply fixes to in-scope files
  | git add + commit "fix(TASK_[ID])..."
  |
  | [RISK: zero findings = no commit = Exit Gate fails — CRITICAL Issue 1]
  | [RISK: Sonnet applies wrong fix to Complex logic finding — see FM 6]
  | [RISK: 20-change limit leaves critical issues unfixed — Issue 8]
  v
  | Phase 5: write completion-report.md
  | update plan.md, update registry.md
  | commit bookkeeping
  |
  | [RISK: commit fails after registry updated — see Issue 11]
  v
  | Exit Gate: 6 checks
  |
  | [RISK: fix commit check blocks clean tasks — CRITICAL Issue 1]
  | [RISK: gate diverges from orchestration SKILL.md gate — Issue 10]
  v
Supervisor reads registry.md -> COMPLETE
```

### Gap Points Identified

1. No path from "zero findings" to "fix commit exists" — Exit Gate permanently fails for clean tasks.
2. No coordination on concurrent `review-lessons` file writes between three parallel sub-workers.
3. No MCP availability check on retry path — enables ghost completion without review.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Supervisor spawns Review Lead instead of monolithic Review Worker | COMPLETE | Implemented in auto-pilot SKILL.md with new prompt templates |
| Review Lead generates `review-context.md` before spawning reviewers | COMPLETE | Phase 1 is well-specified |
| Review Lead spawns 3 parallel review sub-workers via MCP | COMPLETE | Phase 2 spawns all three without waiting |
| Style and Security use Sonnet, Logic uses Opus | COMPLETE | Hard-coded routing table in Phase 2 |
| All 3 reviews run in parallel and produce independent report files | COMPLETE | Sub-workers write separate files |
| Review Lead collects results and runs fix phase after all reviews complete | COMPLETE | Phase 3 + Phase 4 |
| Review Lead handles sub-worker failures | PARTIAL | Spawn failure and stuck handling exist; null ID poll and zero-report-but-finished cases missing |
| Completion report, registry update, and lessons captured | PARTIAL | Completion report and registry: yes. Lessons: sub-workers write them concurrently (race condition) and Review Lead has no lesson-update step |
| Sub-workers respect task file scope | COMPLETE | Scope boundary in review-context.md, "do not review outside scope" in prompts |
| Total review phase wall time reduced (~40% faster) | NOT VERIFIABLE | No measurement mechanism; no Exit Gate check |
| Total review phase cost reduced (~30-40% cheaper) | NOT VERIFIABLE | No measurement mechanism; no Exit Gate check |

### Implicit Requirements NOT Addressed

1. **Zero-findings tasks must complete cleanly** — the fix commit Exit Gate check assumes findings always exist.
2. **Review-lessons writes must be serialized or deduplicated** — three concurrent appends to one file need coordination.
3. **Retry path must be as safe as first-run path** — MCP check omitted from retry, enabling ghost completion.
4. **Model strings must be consistent across all files** — `opus-4-5` vs `opus-4-6` conflict is unresolved.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Zero review findings | NO | No "no findings" path in Phase 4 | Exit Gate permanently fails — Critical |
| All three sub-workers fail | YES | write exit-gate-failure.md | Correct |
| Two of three sub-workers fail (security only succeeds) | PARTIAL | Phase 3 says "do not halt if only 1 or 2 produced reports" | But Exit Gate requires style+logic — Review Lead writes failure.md unnecessarily |
| Sub-worker spawns then exits without writing report | PARTIAL | Report file check after polling | Doesn't distinguish "exited clean but no report" from "failed" |
| Concurrent lessons file writes | NO | None | Race condition on every parallel review |
| MCP unavailable on retry | NO | Retry prompt lacks MCP check | Enables ghost completion |
| Implementation commit not found by pattern | PARTIAL | "or similar" is undefined | Wrong diff in review-context.md |
| Fix commit fails (git hook, merge conflict) | NO | No verification after commit | Registry shows COMPLETE, commit missing |
| Review Lead runs out of context mid-phase | PARTIAL | Continuation support detects completed phases via file existence | Works for phases 1-3; fix phase has no checkpoint artifact |
| Fix exceeds 20 changes | PARTIAL | Noted in completion report | Critical findings left unfixed can still COMPLETE |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| Supervisor -> Review Lead (MCP spawn) | LOW | High | First-run prompt checks MCP; retry prompt does not |
| Review Lead -> Style/Logic/Security (MCP spawn x3) | MED | Medium | Spawn failure handled; null ID polling not handled |
| Phase 3 polling loop (MCP get_worker_activity) | MED | High | No timeout; null ID crash unhandled |
| review-lessons concurrent writes | HIGH | Medium | No coordination; three writers, one file |
| Exit Gate -> fix commit check | HIGH | Critical | Fails on clean tasks unconditionally |
| Completion commit (git) | LOW | Medium | No verification after commit |

---

## Coherence Analysis: review-lead.md vs auto-pilot Prompts

The First-Run Review Lead Prompt in auto-pilot SKILL.md is a correct high-level summary of `review-lead.md` phases. All 10 steps map to phases in the agent file. Ordering is preserved.

The Retry Review Lead Prompt is a compressed version. It correctly captures continuation logic (check existing artifacts, skip completed phases). However:

1. It omits the MCP availability check (Critical Issue 2).
2. It does not instruct the agent to read `review-lead.md` (Moderate Issue 9).
3. It does not include its own Exit Gate checklist — it says "complete all remaining phases: fixes, completion, exit gate" which relies on the agent knowing the Exit Gate from `review-lead.md`. This is acceptable if the agent reads `review-lead.md`, but since that read step is missing, the retry has no Exit Gate.

The auto-pilot Prompt correctly notes "Full sub-worker prompts are in `.claude/agents/review-lead.md`" rather than duplicating them, which is correct practice. The orchestration SKILL.md changes (phase detection table entry for `review-context.md`, Review Lead Note in Completion Phase) are coherent and correctly placed.

---

## Acceptance Criteria Coverage

| AC from task.md | Implementation | Status | Gap |
|---|---|---|---|
| Supervisor spawns Review Lead | New prompt templates in auto-pilot | MET | — |
| Review Lead generates review-context.md before spawning | Phase 1 + continuation check | MET | Wrong commit identification risk |
| Review Lead spawns 3 parallel sub-workers via MCP | Phase 2 with immediate successive calls | MET | Null ID in poll list on spawn failure |
| Style + Security = Sonnet, Logic = Opus | Hard-coded routing table | MET | Model string version conflict (4-5 vs 4-6) |
| All 3 produce independent report files | Separate file paths per sub-worker | MET | Concurrent lessons writes |
| Review Lead collects and runs fix phase | Phase 3 + 4 | MET | Zero-findings path missing; fix commit Exit Gate fails |
| Review Lead handles sub-worker failures | Kill stuck, continue with partial | PARTIAL | Null ID polling; all-finished-no-report case |
| Completion report, registry, lessons | Phase 5 | PARTIAL | Lessons owned by sub-workers (race); Review Lead has no lesson step |
| Sub-workers respect file scope | review-context.md + prompt instruction | MET | Scope source reliability (missing File Scope section) |
| Wall time ~40% faster | Parallel execution | NOT VERIFIED | No measurement; no Exit Gate check |
| Cost ~30-40% cheaper | 2/3 Sonnet | NOT VERIFIED | No measurement; no Exit Gate check |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The Exit Gate unconditionally requires a fix commit, which means every task with zero findings fails the gate and can never reach COMPLETE. Combined with the Retry Prompt's missing MCP check (which enables ghost completion), the two Critical issues represent opposite ends of the same correctness spectrum: clean tasks are blocked forever, while MCP-failed tasks slip through as complete. Both must be fixed before this pattern is safe to use in production.

---

## What Robust Implementation Would Include

- A "zero findings" branch in Phase 4 that writes a note to completion-report.md and skips the fix commit, with a corresponding conditional Exit Gate check.
- A single `spawned_worker_ids` list maintained in Phase 2 that Phase 3 uses for polling (excluding failed spawns).
- Lessons-update step moved exclusively to Review Lead Phase 5, removing it from all three sub-worker prompts.
- MCP availability check in the Retry Prompt mirroring the First-Run Prompt.
- Reconciled model strings across review-lead.md and auto-pilot SKILL.md (single canonical source for model identifiers).
- A deterministic fallback for implementation commit identification when the `feat(TASK_[ID]):` pattern does not match.
- An explicit instruction that the final action before exit is the completion commit (not the registry write), with a note that an uncommitted registry update must be staged and committed atomically with the bookkeeping commit.
- A monitoring loop timeout in Phase 3 (e.g., "if any sub-worker remains non-finished after 30 minutes, apply two-strike kill logic regardless of health state").
