# Code Logic Review — TASK_2026_152

## Summary

| Metric              | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| Overall Score       | 5/10                                                     |
| Assessment          | NEEDS_REVISION                                           |
| Critical Issues     | 1                                                        |
| Serious Issues      | 2                                                        |
| Moderate Issues     | 2                                                        |
| Failure Modes Found | 4                                                        |

The fix addresses all 7 violations in the source files (`.claude/skills/auto-pilot/`). However, the scaffold copies (`apps/cli/scaffold/.claude/skills/auto-pilot/`) are **not byte-for-byte identical** to the source copies — they diverge in significant ways. The sync requirement stated in the task description is not satisfied.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The scaffold divergence is a silent failure. `npx @itqanlab/nitro-fueled init` copies the scaffold, not the source. Any new project initialized after this fix will receive the **old, unpatched** SKILL.md and parallel-mode.md. The violations this task fixed will immediately re-appear in every target project. The fix ships only to the repo's own `.claude/` directory, not to the package artifact.

### 2. What user action causes unexpected behavior?

A user running `npx @itqanlab/nitro-fueled init` on a fresh project gets scaffold copies. The scaffold SKILL.md (line 335) still says "Build Worker for CREATED/IN_PROGRESS, Review Worker for IMPLEMENTED/IN_REVIEW" — the split/single/Worker-Mode awareness added by this fix is absent from the scaffold. A supervisor reading that version will not know about Prep Workers or Implement Workers and will fail to route split-mode tasks correctly.

### 3. What data makes this produce wrong results?

A task with `Complexity: Medium` or `Complexity: Complex` and no explicit `Worker Mode` field will be auto-selected as `split` mode in the source SKILL.md (principle #11), but the scaffold SKILL.md has no concept of split mode — it will treat the task as a plain Build Worker target, bypassing the Prep → Implement pipeline entirely.

### 4. What happens when dependencies fail?

The pre-flight exit gate added to `parallel-mode.md` is identical in both source and scaffold — that specific change synced correctly. But the expanded Worker-Exit Reconciliation block (Reconcile_OK / Reconcile_Discrepancy logic, duplicate spawn guard, event schema) is present only in the source parallel-mode.md. The scaffold version retains the old 3-line Step 7 handler. If a worker exits without emitting a state-change event, the scaffold supervisor has no reconciliation path — the task silently stalls in its pre-exit state.

### 5. What's missing that the requirements didn't mention?

The task description says "scaffold copies are synced" as a requirement to verify, not just a nice-to-have. The diffs show this is false. Beyond the direct violations of this task's own acceptance criteria, the scaffold is also missing:

- The `compact: true` flag on `get_tasks()` calls (source uses `get_tasks(compact: true)` throughout; scaffold uses bare `get_tasks()`)
- The `NEVER call get_tasks(status: "COMPLETE")` guard in the loop
- Principle #14 ("Supervisor is authoritative for task state on worker exit")
- The Per-Phase Output Budget row for Prep Worker completions
- The "Worker model: single vs split" section

---

## Findings — Violation-by-Violation

### Violation 1: Bash loops reading task files (HARD RULE #1)

**Status: ADDRESSED in source.**

SKILL.md HARD RULE #1 now includes an explicit "Banned Bash patterns" block with five concrete pattern examples (`for task in ...; do cat task.md`, `cat task-tracking/TASK_*/status`, `grep -r "CREATED" task-tracking/`, etc.). The rule previously said "NEVER use Bash" without examples; the new block makes the violation concrete and machine-checkable.

**Status in scaffold: ADDRESSED.** Scaffold SKILL.md lines 20-26 are identical — this block synced correctly.

### Violation 2: task.md reads during pre-flight (HARD RULE #2)

**Status: ADDRESSED in source.**

SKILL.md HARD RULE #2 now explicitly says: "Reading task.md before spawn to 'check dependencies' or 'verify type' is a pre-flight violation even if the data would be useful." The pre-flight prohibition is no longer ambiguous. The Data Access Rules table (line 125) also reinforces this with a dedicated pre-flight row.

**Status in scaffold: PARTIALLY ADDRESSED.** The scaffold Data Access Rules table row for "Task list/status during pre-flight" (line 110-111) retains the no-task.md constraint but lacks the `compact: true` flag discipline and does not carry the explicit "even if the data would be useful" wording from the source.

### Violation 3: Tangent investigations — scanning git commits (HARD RULE #7)

**Status: ADDRESSED in source.**

SKILL.md HARD RULE #7 now includes a "Banned tangent patterns" block that explicitly names git scanning: "Checking for newer tasks via `git log`, `git diff`, or any VCS command" and "Scanning git commits to find recently created task files." Previously the rule was a single sentence with no examples.

**Status in scaffold: ADDRESSED.** Scaffold SKILL.md lines 35-40 are identical — this block synced correctly.

### Violation 4: Batch reference loading of parallel-mode.md + worker-prompts.md simultaneously

**Status: ADDRESSED in source.**

The Load-on-Demand Protocol now adds: "NEVER batch-load two references in one round — one trigger event, one file load. Loading `parallel-mode.md` and `worker-prompts.md` simultaneously (or any two references in a single tool-call round) is a violation of this protocol regardless of whether both will be needed eventually."

**Status in scaffold: ADDRESSED.** Scaffold SKILL.md lines 174-176 are identical — this block synced correctly.

### Violation 5: File reads instead of MCP cortex tools

**Status: ADDRESSED in source.**

The Data Access Rules table now explicitly includes `get_tasks(status: "COMPLETE")` in the NEVER column, adds the `compact: true` discipline, and adds the note "filter to active statuses only." The parallel-mode.md Hard Constraints block (Step 2 preferred path) now uses `get_tasks(compact: true, limit=50)` instead of the old unqualified call.

**Status in scaffold: PARTIALLY ADDRESSED.** Scaffold SKILL.md still uses bare `get_tasks()` in the Data Access Rules table and in the Core Loop summary (lines 86, 109, 113). Scaffold parallel-mode.md Step 2 still uses the old full-status-list call `get_tasks(status=['CREATED', 'IMPLEMENTED', ...])` instead of the source's `get_tasks(compact: true, limit=50)`. This is a meaningful semantic difference — the source version is more context-efficient and enforces the compact discipline the violation was about.

### Violation 6: Hallucinated provider labels (HARD RULE #4)

**Status: ADDRESSED in source.**

HARD RULE #4 now includes: "Banned provider labels (any use is an instant violation): `Cloudcode`, `Codex`, `OpenCode`, `Ollama`, `GPT`, `Gemini`, or any name not returned verbatim by `get_available_providers()`." The rule previously said "NEVER hallucinate providers" with only the general statement.

**Status in scaffold: ADDRESSED.** Scaffold SKILL.md lines 29-31 are identical — this block synced correctly.

### Violation 7: Session stalled in PENDING — no workers spawned

**Status: ADDRESSED in source.**

Two complementary fixes address this:

1. SKILL.md HARD RULE #8: "NEVER end your turn after spawning workers — the sequence is: `spawn_worker` → `sleep 30` → `get_pending_events` → loop. This is the #1 cause of supervisor stalls."
2. parallel-mode.md: New "Pre-Flight Exit Gate" section at the top of the file mandates that after Steps 1-4 complete, the supervisor's VERY NEXT action must be `spawn_worker`, "all tasks blocked," or "--limit reached." No further reads or analysis are permitted between pre-flight and the first spawn.

**Status in scaffold: ADDRESSED.** HARD RULE #8 is identical. The Pre-Flight Exit Gate block in scaffold parallel-mode.md (lines 1-19) is identical — this is the only section that synced perfectly between source and scaffold parallel-mode.md.

---

## Critical Issues

### Issue 1: Scaffold copies are not synced — new projects will install unpatched files

- **Files**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`, `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`
- **Scenario**: Any `npx @itqanlab/nitro-fueled init` run after this fix is merged will copy the scaffold — not the source — into the target project. The scaffold does not contain the split Worker Mode logic, the Worker-Exit Reconciliation block, the `compact: true` discipline, or the `get_tasks(status: "COMPLETE")` guard.
- **Impact**: Every initialized project will re-exhibit violations #1-#3 (missing reconciliation path for abnormal worker exit) and violation #5 (unguarded `get_tasks()` calls without compact mode). The fix is effectively unreleased to end users.
- **Evidence**: Running `diff` between source and scaffold shows 60+ lines of divergence in SKILL.md and 80+ lines of divergence in parallel-mode.md. The scaffold parallel-mode.md Step 7 (Handle Completions) is missing the entire Worker-Exit Reconciliation subsection, the Duplicate Spawn Guard, and the RECONCILE_DISCREPANCY event schema.
- **Fix**: Overwrite both scaffold files with the source files verbatim. The task description states this was done; the diffs prove it was not.

---

## Serious Issues

### Issue 2: Scaffold parallel-mode.md Step 3 (Dependency View) lacks split-mode task states

- **File**: `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`, lines 89-96
- **Scenario**: A project using split Worker Mode has tasks in PREPPED or IMPLEMENTING state. The scaffold's Step 3 only knows READY_FOR_BUILD, BUILDING, READY_FOR_REVIEW, REVIEWING, BLOCKED, COMPLETE, CANCELLED. PREPPED tasks are unclassified and will be ignored in Step 4 slot allocation.
- **Impact**: Implement Workers are never spawned for split-mode tasks. The task queue stalls after the Prep Worker completes, because the task state is PREPPED but the scaffold has no READY_FOR_IMPLEMENT classification.
- **Fix**: Sync Step 3 from source.

### Issue 3: Scaffold SKILL.md principle #11 gives wrong routing instruction

- **File**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`, line 335
- **Current text**: "Build Worker for CREATED/IN_PROGRESS, Review Worker for IMPLEMENTED/IN_REVIEW"
- **Source text**: Full split/single Worker Mode routing with Prep → Implement → Review pipeline, data-driven defaults from 143-worker analysis (Prep → claude/claude-sonnet-4-6, Implement → glm/glm-5.1 with claude fallback)
- **Impact**: Supervisors reading the scaffold will never use Prep Workers or Implement Workers regardless of task complexity. The entire split Worker Mode feature is dead in scaffold-initialized projects.
- **Fix**: Sync principle #11 from source.

---

## Moderate Issues

### Issue 4: Scaffold Per-Phase Output Budget missing Prep Worker completion row

- **File**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`, lines 55-63
- **Scenario**: A Prep Worker completes and the supervisor needs to emit the correct one-line conversation output.
- **Impact**: The scaffold supervisor has no format spec for this event. It will either print nothing, emit an incorrect format, or fall back to printing a summary — which violates HARD RULE #9.
- **Fix**: Add `| **Completion (Prep Worker)** | ... |` row from source.

### Issue 5: Scaffold parallel-mode.md Context Budget Principle uses unqualified `get_tasks()`

- **File**: `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`, line 25
- **Scenario**: The "Context Budget Principle" section is meant to define the minimal footprint of the supervisor loop. Using `get_tasks()` without `compact: true` fetches verbose task objects.
- **Impact**: Lower-severity than issue 2, but inconsistent with the compact discipline added by this fix. Under memory pressure, verbose `get_tasks()` responses contribute to earlier compaction.
- **Fix**: Sync from source.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Violation 1 (Bash loops) — addressed in source | COMPLETE | None |
| Violation 2 (task.md pre-flight reads) — addressed in source | COMPLETE | None |
| Violation 3 (git tangents) — addressed in source | COMPLETE | None |
| Violation 4 (batch reference loading) — addressed in source | COMPLETE | None |
| Violation 5 (file reads vs MCP) — addressed in source | COMPLETE | None |
| Violation 6 (hallucinated providers) — addressed in source | COMPLETE | None |
| Violation 7 (session stall / no spawn) — addressed in source | COMPLETE | None |
| Pre-flight exit gate properly positioned | COMPLETE | Gate is at top of parallel-mode.md in both source and scaffold |
| Scaffold copies byte-for-byte identical to source | FAIL | 60+ line divergence in SKILL.md, 80+ line divergence in parallel-mode.md |

### Implicit Requirements NOT Addressed

1. The scaffold sync was listed as a deliverable but not verified before closing the task. A post-commit diff check should be part of any sync task acceptance criteria.
2. No test or smoke-check was added to assert that scaffold files match source files (e.g., a CI step or a `diff` in a check script). Without this, future edits to source files will silently re-diverge from the scaffold.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Worker exits without state-change event | YES (source) / NO (scaffold) | Source: full Worker-Exit Reconciliation block. Scaffold: missing entirely | Critical — scaffold projects silently stall |
| Split-mode task in PREPPED state | YES (source) / NO (scaffold) | Source: READY_FOR_IMPLEMENT classification in Step 3. Scaffold: unclassified | Serious — Implement Workers never spawned |
| Supervisor ends turn after spawn | YES (both) | HARD RULE #8 identical in both | None |
| git log tangent during pre-flight | YES (both) | HARD RULE #7 banned-patterns block identical | None |
| Batch reference load | YES (both) | Load-on-Demand Protocol identical | None |
| `get_tasks(status: "COMPLETE")` inside loop | YES (source) / NO (scaffold) | Source: explicit NEVER guard. Scaffold: absent | Moderate — context waste on large registries |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| `npx init` copies scaffold to new project | HIGH | All 7 violations re-appear in new projects | Overwrite scaffold files with source files |
| Supervisor running split-mode task in scaffold project | HIGH | Task stalls after Prep Worker completes | Sync Step 3 and Step 5 from source |
| Worker abnormal exit in scaffold project | HIGH | Task silently stalls in pre-exit state forever | Sync Worker-Exit Reconciliation from source |

---

## Verdict

| Verdict | Value |
|---------|-------|
| Overall | FAIL |

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The scaffold files were not overwritten with the source content. Every project initialized from the current scaffold will silently re-exhibit the violations this task was created to fix. The fix is complete and correct for the repo's own `.claude/` directory but has zero impact on end-user projects until the scaffold is properly synced.

## What Robust Implementation Would Include

- A post-fix diff assertion: `diff .claude/skills/auto-pilot/SKILL.md apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` run as part of task acceptance, with zero-exit required
- A CI check (e.g., in a pre-commit hook or GitHub Actions step) that diffs all scaffold files against their source counterparts and fails if any diverge
- The sync step performed with `cp` rather than manual editing, to guarantee byte-for-byte identity
- A note in the task handoff explicitly confirming the diff result, not just asserting "synced"
