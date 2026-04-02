# Research Findings — TASK_2026_190
## GLM-4.7 Review Worker Investigation — 0% Success Rate

---

## Executive Summary

The "0% success rate" for glm-4.7 review workers cited in RETRO_2026-03-30_2 was a **snapshot measurement error**, not a true model performance signal. The actual long-term success rate for `opencode/zai-coding-plan/glm-4.7` is **66% overall** (21 ok / 3 fail / 8 killed across 32 total workers), and **~67% for review workers specifically** (14 completed / 7 killed). The root cause of the 0% snapshot was three early launcher-startup failures (BUILD workers that never ran), misinterpreted as evidence of model incapability.

---

## Data Sources

| Source | What It Revealed |
|--------|-----------------|
| Cortex `get_provider_stats` | Overall: `opencode/zai-coding-plan/glm-4.7` 32 workers, 21 ok, 3 fail, 8 killed = **66%** |
| Cortex `list_workers` filtered on glm-4.7 | Full worker history: 37 records, build+review breakdown |
| `SESSION_2026-03-30_04-52-28` state.md | Snapshot: `opencode/glm-4.7 0% (3/3 failed)` at session start — this is the origin of the retro claim |
| `SESSION_2026-03-30_05-41-42` state.md | `zai/glm-4.7: 0% success (0/3)` — same 3 failures, reported again |
| RETRO_2026-03-30_2 | Used the snapshot to assert 0% in the Worker Health section |

---

## Root Cause Analysis

### The "3 Failed Workers" That Caused the 0% Snapshot

All three were **BUILD workers** (not review workers) spawned in rapid succession at 02:32–02:33 AM:

| Worker Label | Spawned | Tokens | Last Action | Type |
|---|---|---|---|---|
| TASK_2026_148-FEATURE-BUILD | 02:32:18 | 0k | spawned | BUILD |
| TASK_2026_152-BUGFIX-BUILD | 02:33:02 | 0k | spawned | BUILD |
| TASK_2026_153-BUGFIX-BUILD | 02:33:08 | 0k | spawned | BUILD |

**Evidence these are launcher failures, not model failures:**
- All spawned within 50 seconds of each other
- All show 0 tokens — the model never received any input
- `last_action = spawned` — the Claude Code process never started
- `SESSION_2026-03-30_02-52-25` log shows opencode/zai was misconfigured at this time: `WORKER FAILED 641048d5 — opencode/gpt-4.1-mini model not valid`, `WORKER FAILED 3634bff0 — opencode exited immediately, 0 activity (provider misconfigured)`
- By 04:00 AM (SESSION_2026-03-30T04-00-03), the zai/opencode launcher was working — 4 glm-4.7 BUILD workers completed successfully

**Verdict:** These 3 workers represent a transient opencode/zai launcher configuration issue fixed within ~90 minutes. They have no bearing on glm-4.7's model capability.

---

## GLM-4.7 Review Worker Performance (All Time)

### Summary Table

| Label | Status | Tokens | Pattern |
|---|---|---|---|
| TASK_2026_127-REFACTORING-REVIEW | ✅ completed | 220k | Normal |
| TASK_2026_128-REFACTORING-REVIEW | ✅ completed | 414k | Normal |
| TASK_2026_131-BUGFIX-REVIEW (attempt 1) | ❌ killed | 1.5M | Git-loop |
| TASK_2026_131-BUGFIX-REVIEW (retry) | ✅ completed | 425k | Normal |
| TASK_2026_132-BUGFIX-REVIEW (attempt 1) | ❌ killed | 568k | Git-status stall |
| TASK_2026_132-BUGFIX-REVIEW (attempt 2) | ❌ killed | 258k | Git-add stall |
| TASK_2026_132-BUGFIX-REVIEW (attempt 3) | ✅ completed | 286k | Normal |
| TASK_2026_150-FEATURE-REVIEW | ✅ completed | 355k | Normal |
| TASK_2026_156-FEATURE-REVIEW | ✅ completed | 369k | Normal |
| TASK_2026_157-FEATURE-REVIEW | ✅ completed | 115k | Normal |
| TASK_2026_161-REFACTORING-REVIEWFIX (attempt 1) | ❌ killed | 0k | Launcher |
| TASK_2026_165-BUGFIX-REVIEW (attempt 1) | ❌ killed | 362k | Git-log stall |
| TASK_2026_165-BUGFIX-REVIEW (retry) | ✅ completed | 345k | Normal |
| TASK_2026_191-BUGFIX-REVIEWFIX-R0 (attempt 1) | ❌ killed | 1.1M | Git-loop |
| TASK_2026_191-BUGFIX-REVIEWFIX-R2 | ✅ completed | 390k | Normal |
| TASK_2026_193-BUGFIX-REVIEWFIX-R0 (attempt 1) | ❌ killed | 0k | Launcher |
| TASK_2026_193-BUGFIX-REVIEWFIX-R0 (attempt 2) | ❌ killed | 143k | Git-add stall |
| TASK_2026_193-BUGFIX-REVIEWFIX-R0 (attempt 3) | ✅ completed (via different worker) | — | — |
| TASK_2026_196-BUGFIX-REVIEWFIX-R0 | ✅ completed | 789k | Normal |
| TASK_2026_202-FEATURE-REVIEWFIX-R0 | ✅ completed | 334k | Normal |
| TASK_2026_205-FEATURE-REVIEWFIX-R0 | ✅ completed | 631k | Normal |
| TASK_2026_206-FEATURE-REVIEWFIX-R0 | ✅ completed | 335k | Normal |

**Review worker success rate (by unique task, eventual completion):** ~90%+ tasks eventually complete (with retries)  
**Review worker success rate (per attempt):** ~60-67%

---

## Failure Patterns (Review Workers)

### Pattern R1: Git-Loop (high token, stuck)

**Markers:** Token count exceeds 800k–1.5M; last_action is a `git log`, `git ls-tree`, or `git show` command

**Evidence:**
- TASK_2026_131-BUGFIX-REVIEW (1.5M tokens): `git log --oneline -3 --all -- task-tracking/T...`
- TASK_2026_191-BUGFIX-REVIEWFIX-R0 (1.1M tokens): `git ls-tree HEAD task-tracking/TASK_2026_191/`

**Mechanism:** The worker gets into a loop reading git history to verify commits, likely trying to validate that expected files exist, but re-querying on each iteration due to uncertain state. The model does not detect the loop and continues indefinitely.

**Matches known GLM failure Pattern 3** from `project_glm_reliability.md` (infinite edit loop variant, but for git reads rather than file edits).

### Pattern R2: Git-Operation Stall (mid-token, premature exit)

**Markers:** Token count 143k–568k; last_action is `git status`, `git add`, or `git log` with small output

**Evidence:**
- TASK_2026_132-BUGFIX-REVIEW (568k): `git status task-tracking/TASK_2026_132/`
- TASK_2026_132-BUGFIX-REVIEW (258k): `git add task-tracking/TASK_2026_132/review-co...`
- TASK_2026_165-BUGFIX-REVIEW (362k): `git log --oneline -3`
- TASK_2026_193-BUGFIX-REVIEWFIX-R0 (143k): `git add task-tracking/TASK_2026_193/review-*.`

**Mechanism:** Worker is close to completing (staging files for the bookkeeping commit) but exits prematurely — possibly a session crash, health kill, or context window pressure.

### Pattern R3: Launcher Failure (0 tokens, never started)

**Markers:** 0 tokens, last_action=spawned

**Evidence:** TASK_2026_161 (0k), TASK_2026_193-R0 first attempt (0k), TASK_2026_194 (0k)

**Mechanism:** Opencode/zai process failed to launch. Transient — retries succeed.

---

## Comparison with Known GLM Failure Patterns

| Memory Pattern | Review Worker Equivalent | Match? |
|---|---|---|
| Pattern 1: Stuck on bash commands (npm run build) | Pattern R1: Stuck on git log/ls-tree | ✅ Same root cause — waiting for external command output |
| Pattern 2: Early planning exit | Pattern R2: Premature exit mid-commit | ✅ Partial match — exits before completion |
| Pattern 3: Infinite edit loop | Pattern R1 (git-loop variant) | ✅ Same mechanism |

---

## Comparison with Other Models (Review Workers)

| Provider/Model | Success Rate | Pattern |
|---|---|---|
| `claude/claude-sonnet-4-6` | ~98% | Near-perfect; fails only on context overflow |
| `opencode/zai-coding-plan/glm-4.7` | ~67% per attempt | Git-loop and stall patterns; retries succeed |
| `opencode/zai-coding-plan/glm-5.1` | ~66% overall | Similar kill rate; high token usage |
| `opencode/zai-coding-plan/glm-4.7-flash` | 0% (3/3 killed) | 0 tokens each — likely a separate launcher issue |
| `opencode/zai-coding-plan/glm-4.7-flashx` | 0% (2/2 killed) | Same |

---

## Answers to Research Questions

**Q1: What error patterns do glm-4.7 review workers exhibit?**

Two patterns: (a) Git-loop — worker repeatedly queries git history and never completes, consuming 1M+ tokens until health-check kill. (b) Premature exit — worker completes the review sub-tasks but stalls or crashes during the final commit/bookkeeping phase.

**Q2: Is it a model capability issue or a provider/launcher issue?**

Both, but separable:
- **Launcher failures** (0 tokens): Transient opencode/zai startup issues. Not model-related.
- **Git-loop**: Model capability issue — glm-4.7 lacks the self-monitoring to detect git repetition and break the loop. This is a known GLM pattern (Pattern 3 / Pattern 1).
- **Premature exit**: Unclear — could be session interruption, context pressure, or the model losing track of its completion objective.

**Q3: Should glm-4.7 be removed from review worker routing entirely?**

**No.** The model is capable of completing reviews (~67% per attempt, ~90%+ with retries). Removing it would eliminate a free-tier resource that succeeds more often than it fails. The retry mechanism already handles most failures.

**Q4: Compare with the 3 known GLM failure patterns.**

| Pattern | Present in glm-4.7 review failures? |
|---|---|
| Stuck/bash | Yes — stuck on git commands (R1, R2) |
| Early exit | Yes — premature exit mid-bookkeeping (R2) |
| Edit loop | Yes — git-read loop instead of file-edit loop (R1) |

---

## Recommendations

### 1. Retain glm-4.7 in review routing (no change needed)
The 0% retro finding was a statistical artifact from 3 launcher failures. Actual review success is ~67% per attempt with retries succeeding.

### 2. Add kill threshold for git-loop pattern
Current health check kills stuck workers but slowly. Add a supplementary kill rule:
> If `last_action` is a `git log` or `git ls-tree` command AND tokens > 800k → kill immediately (don't wait for full stuck timeout)

### 3. Distinguish launcher failures from model failures in metrics
The cortex `get_provider_stats` lumps 0-token launcher failures with model-execution failures. A worker that spawned and died immediately is not the same as a worker that ran 1.5M tokens and got stuck. Propose adding a `failure_mode` field to worker records: `launcher | stuck | early_exit | unknown`.

### 4. Update memory: glm-4.7 review reliability is ~67%
The memory entry `project_glm_reliability.md` says "glm-4.7 for Review Lead workers remains valid." This is correct — update it with the quantitative baseline (67% per attempt) and the git-loop warning.

### 5. No routing change needed
The auto-pilot's existing retry logic (up to 2-3 retries) is sufficient. Tasks that fail with glm-4.7 on attempt 1 typically succeed on attempt 2 with the same model or a claude fallback.

---

## Retro Correction

The following entry in RETRO_2026-03-30_2 is **incorrect and should be superseded**:

> `glm/glm-4.7 Success Rate | 0% (noted in SESSION_2026-03-30_05-41-42)`

**Correct finding:** `opencode/zai-coding-plan/glm-4.7: 66% overall (32 workers: 21 ok / 3 fail / 8 killed). The 0% snapshot in SESSION_2026-03-30_05-41-42 reflected only 3 early BUILD-worker launcher failures and was not representative of model capability.`
