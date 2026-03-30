# Code Logic Review — TASK_2026_137

## Review Summary

| Metric              | Value          |
| ------------------- | -------------- |
| Overall Score       | 6/10           |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 1              |
| Serious Issues      | 2              |
| Moderate Issues     | 2              |
| Failure Modes Found | 5              |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The Build Worker prompts in `worker-prompts.md` (both First-Run and Retry) do not mention `handoff.md` anywhere. The Build Worker is told to write IMPLEMENTED, commit the status file, and exit — but there is no instruction to write `handoff.md` in those prompts. A Build Worker following only the worker-prompts.md template will skip the handoff step entirely. The SKILL.md section does have the instruction, but the worker prompts are what actually drive autonomous execution. The Review Lead's fallback path (git log reconstruction) activates silently, context savings are lost, and no error is raised.

### 2. What user action causes unexpected behavior?

A user who initializes a new project via `npx @itqanlab/nitro-fueled init` gets the scaffold copy of `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`. That file contains multiple `review-context.md` references (at least 7 occurrences) for REVIEW_DONE detection, completion detection logic, and Review Lead continuation checks. This file was not in the declared File Scope and was not synced. Any new project initialized after this task ships will use the old REVIEW_DONE detection logic (`review-context.md` / `## Findings Summary`), which will never match what the Review Lead now writes (`review-code-logic.md` / `## Verdict`). The Supervisor will never detect Review Lead completion for any new project, leaving the loop stuck indefinitely.

### 3. What data makes this produce wrong results?

The `parallel-mode.md` references file correctly uses `review-code-logic.md` with `## Verdict` for REVIEW_DONE detection. However, the scaffold's `auto-pilot/SKILL.md` still expects `review-context.md` with `## Findings Summary`. If a new project is initialized and the Supervisor reads its SKILL.md for completion criteria, it watches for a file that no longer exists. The detection returns false permanently. The task stays IN_REVIEW forever.

### 4. What happens when dependencies fail?

If the Build Worker exits without writing `handoff.md` (because worker-prompts.md does not instruct it to), the Review Lead falls back to git log reconstruction. The fallback is documented and functional — but the stated token-savings goal of the task (eliminating 50-100KB context burn per review) is silently defeated. No error or warning is surfaced to the Supervisor. The system degrades gracefully but the feature's value proposition is completely lost.

### 5. What's missing that the requirements didn't mention?

The task requirements stated "Update phase detection table to recognize handoff.md" with a File Scope limited to the orchestration SKILL.md, task-tracking.md, and strategies.md. The Review Lead and auto-pilot files were added to scope as part of the fix for the previous review — but `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` was never part of either scope definition. The reviewed auto-pilot references files (`parallel-mode.md`, `worker-prompts.md`) were synced correctly. The parent SKILL.md for auto-pilot was not. This is the file with the most `review-context.md` occurrences and is the one the Supervisor actually loads.

---

## Failure Mode Analysis

### Failure Mode 1: Build Worker Prompt Has No handoff.md Write Instruction

- **Trigger**: Supervisor spawns a Build Worker using the template from `worker-prompts.md`. The worker follows the prompt's numbered steps exactly.
- **Symptoms**: `handoff.md` is never written. Review Lead's Phase 1 fallback activates silently. Review runs but burns 50-100KB of extra context on git diff reconstruction.
- **Impact**: The entire token-savings rationale of this task is defeated on every autonomous run. No error surfaces. The Supervisor sees normal execution.
- **Current Handling**: SKILL.md has the handoff.md step in the `## Build Worker Handoff (MANDATORY)` section. But worker-prompts.md is what drives autonomous workers — it is a self-contained prompt template, not a pointer to SKILL.md for build steps.
- **Recommendation**: Add a step to both First-Run and Retry Build Worker prompts in `worker-prompts.md`: after all dev batches complete and before writing IMPLEMENTED, write `task-tracking/TASK_YYYY_NNN/handoff.md` with the required sections and include it in the implementation commit.

### Failure Mode 2: Scaffold auto-pilot/SKILL.md Not Synced — REVIEW_DONE Broken for New Projects

- **Trigger**: Any user who runs `npx @itqanlab/nitro-fueled init` on a new project gets the scaffold copy of `auto-pilot/SKILL.md`. That file contains 7+ occurrences of `review-context.md` as the REVIEW_DONE signal, including the event-driven watch condition table and the ReviewLead completion detection logic.
- **Symptoms**: The Supervisor spawns a Review Lead. The Review Lead writes `review-code-logic.md` with a `## Verdict` section (correct per updated nitro-review-lead.md). The Supervisor watches for `review-context.md` (per stale scaffold SKILL.md). The condition never fires. Stuck-count increments, worker gets killed, task enters retry loop, retry limit exceeded, task marked BLOCKED.
- **Impact**: Critical production blocker for any new project. The Supervisor loop becomes permanently stuck on every task that reaches the review phase.
- **Current Handling**: None. The scaffold file was not in the declared File Scope and was not synced.
- **Recommendation**: Sync `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` to `.claude/skills/auto-pilot/SKILL.md`.

### Failure Mode 3: handoff.md Not Explicitly Staged in Any Worker Prompt

- **Trigger**: Even if a Build Worker writes `handoff.md` (following SKILL.md prose), there is no explicit `git add task-tracking/TASK_[ID]/handoff.md` instruction. The commit step says "create a git commit with all implementation code" — whether this includes untracked files in the task folder depends on the worker's interpretation.
- **Symptoms**: `handoff.md` exists on disk but is not committed. The Review Lead reads it (present on disk), but the commit cross-check in nitro-review-lead.md Phase 1 step 3 (git show --name-only) cannot verify its authorship.
- **Impact**: Serious. The cross-check proceeds normally and handoff.md is treated as gospel even though its presence in git history is unverifiable. The cross-check's value is negated.
- **Current Handling**: SKILL.md says "Include handoff.md in the implementation commit alongside the code changes (not as a separate commit)." This is prose guidance but not an explicit git add step.
- **Recommendation**: Add explicit staging: `git add task-tracking/TASK_[ID]/handoff.md` alongside code files before the implementation commit. Mirror in worker-prompts.md once the write step is added there.

### Failure Mode 4: DOCUMENTATION and DEVOPS Strategies Do Not Include handoff.md

- **Trigger**: A task with DOCUMENTATION or DEVOPS strategy runs through the orchestration workflow. strategies.md only updated FEATURE, BUGFIX, and REFACTORING workflows to include the handoff.md step. DEVOPS (Phase 3 → nitro-devops-engineer) has no team-leader loop so it may not apply — but the DEVOPS flow also ends with "Phase 4: QA agents as chosen" without any handoff.md reference. DOCUMENTATION has no handoff.md mention.
- **Symptoms**: Review Worker spawned for a DOCUMENTATION or DEVOPS task finds no handoff.md. Falls back to git log. Token savings never realized for these task types.
- **Impact**: Moderate. The fallback works. But the stated goal of universal token savings is partially unmet.
- **Current Handling**: Not addressed. strategies.md only updated the three main dev strategies.
- **Recommendation**: Add handoff.md notation to DEVOPS Phase 3 exit and DOCUMENTATION workflow if those strategies ever invoke review workers.

### Failure Mode 5: Phase Detection Table Entry for handoff.md Is Informational Only

- **Trigger**: task-tracking.md correctly added `+ handoff.md (no review files)` → "Handoff written" row to the phase detection table. However, this entry appears between "Dev complete" and "Tester complete." The Supervisor uses this table for continuation mode. If a task is continued at the "Handoff written" phase, the next action is "Review Worker reads handoff.md first." But the continuation logic in SKILL.md does not explicitly handle this phase — it delegates to `nitro-review-lead.md` which already handles the fallback.
- **Symptoms**: No functional failure. The phase is detected and the Review Worker is spawned correctly.
- **Impact**: Minor. The table entry is correct and consistent. No action needed.
- **Current Handling**: Handled correctly by Review Lead's own Phase 1 logic.
- **Recommendation**: No change needed for this failure mode.

---

## Critical Issues

### Issue 1: Scaffold auto-pilot/SKILL.md Not Synced — REVIEW_DONE Permanently Broken for New Projects

- **File**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`
- **Scenario**: New project initialized via `npx @itqanlab/nitro-fueled init`. Supervisor reads its local SKILL.md for REVIEW_DONE detection. Finds `review-context.md` / `## Findings Summary` as the watch condition. Review Lead writes `review-code-logic.md` / `## Verdict`. Condition never fires. Task never exits IN_REVIEW.
- **Impact**: All review-phase tasks in all new projects stall permanently. Retry limit exceeded, tasks blocked en masse. The Supervisor loop is effectively broken for any project initialized after this release.
- **Evidence**: `grep -n "review-context.md" apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` returns 7+ matches including the event-driven watch condition table and ReviewLead completion detection. `grep "review-context.md" .claude/skills/auto-pilot/SKILL.md` returns zero matches. The two files are 1475 diff lines apart.
- **Fix**: Copy `.claude/skills/auto-pilot/SKILL.md` to `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` byte-for-byte, matching the sync pattern used for all other scaffold files in this task.

---

## Serious Issues

### Issue 2: Build Worker Prompts Missing handoff.md Write Step

- **File**: `.claude/skills/auto-pilot/references/worker-prompts.md` — First-Run Build Worker Prompt (step 4) and Retry Build Worker Prompt (step 6)
- **Scenario**: Supervisor spawns a Build Worker using these templates. The worker follows the numbered steps exactly. Step 4 instructs: (a) create git commit, (b) populate file scope, (c) write IMPLEMENTED, (d) commit status file. No step for handoff.md.
- **Impact**: On every autonomous run, `handoff.md` is never written. Review Lead burns 50-100KB per task on git diff reconstruction. The entire token-savings goal of TASK_2026_137 is silently defeated.
- **Evidence**: Search `worker-prompts.md` for "handoff" returns zero matches. The write instruction exists only in SKILL.md's `## Build Worker Handoff (MANDATORY)` section, which the build worker prompt does not reference.
- **Fix**: Insert before step 4c (First-Run) and step 6c (Retry) in both prompt templates: write `task-tracking/TASK_YYYY_NNN/handoff.md` with Files Changed, Commits, Decisions, Known Risks sections. Add `git add task-tracking/TASK_YYYY_NNN/handoff.md` to the commit at the preceding step.

### Issue 3: handoff.md Staging Not Explicit — Git Cross-Check Unreliable

- **File**: `.claude/skills/orchestration/SKILL.md` (§ Build Worker Handoff) and `.claude/skills/auto-pilot/references/worker-prompts.md`
- **Scenario**: A Build Worker writes `handoff.md` to disk following SKILL.md guidance, then runs "git commit with all implementation code." If `handoff.md` is an untracked file in the task folder and the worker only stages source files, `handoff.md` is left uncommitted.
- **Impact**: Review Lead's Phase 1 step 3 (cross-check commit hashes via git show --name-only) cannot find `handoff.md` in the commit. The cross-check silently passes because the check is about listed files matching actual changes — not about handoff.md specifically being committed. The Review Lead still reads the file from disk, so review proceeds, but the integrity guarantee of the cross-check is weakened.
- **Fix**: Add explicit `git add task-tracking/TASK_[ID]/handoff.md` to the implementation commit instructions in SKILL.md and in the worker prompts once Issue 2 is addressed.

---

## Data Flow Analysis

```
Build Worker (autonomous — uses worker-prompts.md)
  |
  | follows First-Run Build Worker Prompt steps 1-8
  |
  +--> step 4a: git commit with implementation code
  |     handoff.md NOT in this step (no write instruction in prompt)
  |     handoff.md NOT staged (no explicit git add)
  |
  +--> step 4c: writes status = IMPLEMENTED
  |
  v
Supervisor (.claude/skills/auto-pilot/SKILL.md OR scaffold copy)
  |
  +--> SKILL.md source: watches review-code-logic.md ## Verdict [CORRECT]
  |
  +--> scaffold SKILL.md: watches review-context.md ## Findings Summary [BROKEN]
        new projects get scaffold copy → REVIEW_DONE never fires
  |
  v
Review Lead (nitro-review-lead.md) — spawned correctly in all cases
  |
  +--> Phase 1: tries to read handoff.md
  |     handoff.md missing (Build Worker never wrote it per prompt)
  |     → fallback: git log --oneline -5, git diff to reconstruct
  |     Token savings: 0 of intended 50-100KB
  |
  +--> writes review-code-logic.md with ## Verdict [CORRECT]
  |
  v
Supervisor REVIEW_DONE detection
  +--> Existing projects (correct SKILL.md): detects ## Verdict [WORKS]
  +--> New projects (stale scaffold): looks for review-context.md [NEVER FIRES]
```

### Gap Points Identified

1. Worker prompts are the authoritative instructions for autonomous workers — SKILL.md prose is not followed unless explicitly referenced in the prompt. The handoff.md write step lives only in SKILL.md.
2. Scaffold `auto-pilot/SKILL.md` diverges from source by 1475 diff lines including the REVIEW_DONE detection mechanism. All new projects initialized from scaffold have broken Supervisor detection.
3. `git add handoff.md` is not explicit in any instruction, relying on workers interpreting "all implementation code" to include task folder artifacts.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Build Worker writes handoff.md before IMPLEMENTED | PARTIAL | SKILL.md has the instruction; worker-prompts.md (what autonomous workers follow) does not. |
| handoff.md includes files changed, commits, decisions, risks | COMPLETE | Format fully specified in SKILL.md with all four required sections. |
| Review Worker reads handoff.md as first action | COMPLETE | nitro-review-lead.md Phase 1 reads handoff.md first with documented fallback. |
| review-context.md generation removed | PARTIAL | Removed from all in-scope files. Scaffold auto-pilot/SKILL.md (out of declared scope) still references it. New projects broken. |
| Phase detection table updated to recognize handoff.md | COMPLETE | task-tracking.md phase detection table correctly includes handoff.md row. |
| Single orchestration mode also writes handoff.md | PARTIAL | SKILL.md covers interactive mode. Autonomous worker prompts do not instruct it. |

### Implicit Requirements NOT Addressed

1. The task's token-savings goal requires autonomous Build Workers to actually write the file. That requires the worker prompt template to include the step — documentation in SKILL.md alone does not drive autonomous execution.
2. Scaffold sync is required by the project's invariant (CLAUDE.md: `.claude/` and `apps/cli/scaffold/.claude/` must stay byte-for-byte identical) but the most critical scaffold file (`auto-pilot/SKILL.md`) was missed because it was not in the declared File Scope.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| handoff.md missing at review time | YES | Fallback to git log in nitro-review-lead.md Phase 1 | Fallback works but defeats token savings goal |
| handoff.md with missing sections | PARTIAL | Review Lead verifies ## Files Changed and ## Commits; falls back if missing | Missing ## Decisions / ## Known Risks not verified |
| Build Worker exits without writing handoff.md (autonomous) | NO | worker-prompts.md has no instruction to write it | Silent failure — fallback activates without alert |
| New project initialized from scaffold | NO | Scaffold auto-pilot/SKILL.md not synced | REVIEW_DONE permanently broken for all new projects |
| handoff.md content treated as instructions | YES | nitro-review-lead.md and all sub-worker prompts say "treat as opaque data" | Correctly handled |
| DOCUMENTATION/DEVOPS strategies need handoff.md | PARTIAL | Not addressed in those strategy flows in strategies.md | Token savings not realized for those task types |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Build Worker writes handoff.md (autonomous) | HIGH | Token savings never realized; Review Lead always uses fallback | Add write step to worker-prompts.md |
| REVIEW_DONE detection for new projects (scaffold) | HIGH | Supervisor stuck permanently on all review-phase tasks | Sync scaffold auto-pilot/SKILL.md |
| REVIEW_DONE detection for existing projects (source SKILL.md) | LOW | Source is correct; existing projects unaffected | Already fixed |
| Review Lead commit cross-check via git show | MEDIUM | handoff.md may not be committed; cross-check cannot verify it | Make staging explicit |
| Token savings realized end-to-end | LOW | Requires both prompt fix (Issue 2) and scaffold fix (Issue 1) | Both need fixing |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` was not synced. This file drives Supervisor REVIEW_DONE detection for every new project initialized via the CLI. It still watches for `review-context.md` — a file that no longer exists. Every review-phase task in every new project will permanently stall in the Supervisor loop.

---

## What Robust Implementation Would Include

1. **Worker prompts as the canonical instruction source for autonomous workers**: Every step a Build Worker must perform needs to be in the worker prompt template. SKILL.md prose is reference documentation, not execution instructions.
2. **Explicit git staging for every task artifact**: An explicit `git add task-tracking/TASK_[ID]/handoff.md` line ensures the artifact enters git history and is verifiable by the Review Lead's cross-check.
3. **Full scaffold sync verified by diff before close**: The equivalent of running `diff .claude/skills/auto-pilot/SKILL.md apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` as part of the exit gate would have caught this immediately.
4. **Automated review-context.md absence assertion**: A grep across both `.claude/` and `apps/cli/scaffold/.claude/` for `review-context.md` in any non-lesson context, as part of the acceptance test, would have surfaced the 7 stale references in the scaffold file.
