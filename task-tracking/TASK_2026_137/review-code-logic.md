# Code Logic Review — TASK_2026_137

## Score: 4/10

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Build Worker writes `handoff.md` to task folder after dev phase, before IMPLEMENTED status | PASS |
| handoff.md includes: files changed (with line counts), commit hashes, key decisions, known risks | PASS |
| Review Worker reads handoff.md as first action — uses it to scope review instead of re-discovering | FAIL |
| review-context.md generation removed (handoff.md replaces it) | FAIL |
| Phase detection table updated to recognize handoff.md | PASS |
| Single orchestration mode (`/orchestrate`) also writes handoff.md (same flow) | PARTIAL |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `nitro-review-lead` agent still writes `review-context.md` as Phase 1 and instructs all three sub-worker prompts to read `review-context.md` as their first action. The `handoff.md` change is invisible to the Review Worker because the agent that runs review (`nitro-review-lead.md`) was not updated. The Supervisor will spawn a Review Worker, it will generate `review-context.md` the old way (running git diff, burning 50-100KB of context), and complete successfully — nobody detects that the feature did not activate.

### 2. What user action causes unexpected behavior?

A user who runs `/orchestrate TASK_X` on a task that was IMPLEMENTED under the new flow will see the Review Worker ignore `handoff.md` entirely. The Review Worker reads `review-context.md`, which it generated itself from scratch. The stated goal — Review Worker reads handoff.md as its first action — never executes.

Additionally, the Review Lead Exit Gate in `nitro-review-lead.md` at line 367 checks:
```
- [ ] `task-tracking/TASK_{TASK_ID}/review-context.md` exists
```
This means the Review Lead actively rejects any session that did NOT generate `review-context.md`. `handoff.md` is not present in that checklist, so the old artifact is still required for the Exit Gate to pass.

### 3. What data makes this produce wrong results?

Tasks that entered IMPLEMENTED state before this change ship without `handoff.md`. The SKILL.md phase detection table has no fallback row for `tasks.md (all COMPLETE)` without `handoff.md`. A Review Worker re-entering such a task will see `tasks.md (all COMPLETE)` and be directed to `team-leader MODE 3 OR QA choice` — the same row that existed before. There is no detection gap for those tasks. However, the more immediate problem is that any new task going through the updated Build Worker flow (which writes `handoff.md`) will then be picked up by the unchanged Review Worker (`nitro-review-lead.md`) which ignores `handoff.md` and regenerates `review-context.md` anyway.

### 4. What happens when dependencies fail?

The Review Lead's sub-worker prompts at lines 150, 162, 173, 185, 196, and 208 all direct sub-workers to `review-context.md` as the source of file scope and conventions. If `handoff.md` had replaced `review-context.md`, a missing `handoff.md` (Build Worker crashed before writing it) would cause sub-workers to fail immediately with no useful fallback. As implemented, `review-context.md` is still the operative document — meaning the feature's resilience story is unchanged and handoff.md adds zero fault tolerance to the review pipeline.

### 5. What's missing that the requirements didn't mention?

**Scaffold sync**: `apps/cli/scaffold/.claude/skills/orchestration/SKILL.md` and `apps/cli/scaffold/.claude/agents/nitro-review-lead.md` are the files copied to target projects on `npx @itqanlab/nitro-fueled init`. Both are unchanged. New projects initialized after this change ship with the old `review-context.md` architecture. The CLAUDE.md explicitly states: "The `.claude/` directory here is the scaffold — it is always in sync with what `npx @itqanlab/nitro-fueled init` copies into a target project."

---

## Failure Mode Analysis

### Failure Mode 1: Review Worker Continues to Burn 50-100KB Context

**Trigger**: Any task reaches IMPLEMENTED status and the Supervisor spawns a Review Worker.

**Symptoms**: `review-context.md` is still generated in Phase 1 of `nitro-review-lead.md`. Sub-workers read `review-context.md`, not `handoff.md`. Token savings goal is not achieved.

**Impact**: The entire stated purpose of the task — eliminating the ~50-100KB rediscovery cost — is never realized.

**Current Handling**: `nitro-review-lead.md` Phase 1 is completely unchanged. It generates `review-context.md` unconditionally before spawning reviewers.

**Recommendation**: Phase 1 of `nitro-review-lead.md` must be rewritten. The new Phase 1 should: (1) Read `handoff.md` and validate it has the expected sections. (2) If `handoff.md` is present and well-formed, pass its content to sub-workers as context instead of running git diff. (3) If `handoff.md` is absent (backward compatibility for old tasks), fall back to the existing git diff approach. The sub-worker prompts must be updated to read `handoff.md` instead of `review-context.md`.

### Failure Mode 2: Review Lead Exit Gate Blocks on Missing review-context.md

**Trigger**: A Review Worker finishes without generating `review-context.md` (e.g., if someone manually updated the Review Lead to use `handoff.md`).

**Symptoms**: The Review Lead Exit Gate at line 367 checks `review-context.md exists` — it will fail the gate if `review-context.md` was not created.

**Impact**: The Review Worker writes `exit-gate-failure.md` and exits, signaling failure to the Supervisor. The task stalls at IN_REVIEW.

**Current Handling**: Exit Gate in `nitro-review-lead.md` lists `review-context.md` as a required artifact. `handoff.md` is not mentioned.

**Recommendation**: Update the Exit Gate to check `handoff.md` instead of (or alongside) `review-context.md` depending on the migration strategy chosen.

### Failure Mode 3: Scaffold Copies Are Stale — New Projects Get Old Architecture

**Trigger**: A user runs `npx @itqanlab/nitro-fueled init` after this change ships.

**Symptoms**: The copied scaffold files (`apps/cli/scaffold/.claude/skills/orchestration/SKILL.md`, `apps/cli/scaffold/.claude/agents/nitro-review-lead.md`) still reference `review-context.md`. New projects initialize with the old flow.

**Impact**: All new projects skip the handoff.md feature entirely. The token savings benefit is not delivered to any new project.

**Current Handling**: The scaffold directory was not in the file scope for TASK_2026_137 and was not updated.

**Recommendation**: The task's file scope must be expanded to include the scaffold copies of every modified file, or a separate sync task must be created and tracked as a follow-on. Given CLAUDE.md's explicit statement that `.claude/` and `apps/cli/scaffold/.claude/` must stay in sync, this is a blocking gap.

---

## Critical Issues

### Issue 1: nitro-review-lead.md Not Updated — Review Worker Still Uses review-context.md

**File**: `.claude/agents/nitro-review-lead.md` (lines 26, 40, 150, 162, 173, 185, 196, 208, 268, 367)

**Scenario**: Every time a Review Worker runs for any task after this change, it executes the old Phase 1: generates `review-context.md` by running git diff and reading CLAUDE.md conventions. Sub-workers receive prompts that tell them to read `review-context.md` as step 1.

**Impact**: Acceptance criterion "Review Worker reads handoff.md as first action" never passes. Acceptance criterion "review-context.md generation removed" never passes. Token savings never materialize.

**Evidence**: `nitro-review-lead.md` line 26 — `Before spawning any sub-workers, generate task-tracking/TASK_{TASK_ID}/review-context.md` — is unchanged. Line 367 — `review-context.md exists` — is still a required Exit Gate check.

**Fix**: Update `nitro-review-lead.md` Phase 1 to read `handoff.md` as the first action. Update all three sub-worker prompt templates to reference `handoff.md` instead of `review-context.md`. Update the Exit Gate to check `handoff.md` instead of `review-context.md`.

### Issue 2: Scaffold Copies Not Updated — New Projects Ship Old Flow

**File**: `apps/cli/scaffold/.claude/skills/orchestration/SKILL.md` (no handoff.md mentions), `apps/cli/scaffold/.claude/agents/nitro-review-lead.md` (10+ review-context.md references)

**Scenario**: Running `npx @itqanlab/nitro-fueled init` on a fresh project copies these files. The installed files describe the old `review-context.md` flow.

**Impact**: The feature is dead-on-arrival for every new project. The scaffold is the primary distribution mechanism of this library.

**Evidence**: `Grep(handoff.md, apps/cli/scaffold/.claude/skills/orchestration/SKILL.md)` returns no matches.

**Fix**: Apply all changes from the `.claude/` directory to the corresponding `apps/cli/scaffold/.claude/` files. This should be an invariant enforced at review time for any change touching `.claude/`.

### Issue 3: nitro-code-security-reviewer.md Also Still References review-context.md

**File**: `.claude/agents/nitro-code-security-reviewer.md` (lines 34, 54)

**Scenario**: Security reviewers spawned directly (not via Review Lead) still read `review-context.md` for scope context.

**Impact**: Partial execution of the feature — the file is still referenced as the scope authority by the security reviewer agent.

**Evidence**: Grep confirmed `review-context.md` at lines 34 and 54 in `nitro-code-security-reviewer.md`.

**Fix**: Update these references to `handoff.md`.

---

## Serious Issues

### Issue 4: auto-pilot worker-prompts.md Still References review-context.md

**File**: `.claude/skills/auto-pilot/references/worker-prompts.md` (lines 191, 196, 207, 218, 269, 273)

**Scenario**: The Supervisor uses `worker-prompts.md` to build the prompt it injects into Review Workers. That prompt template still instructs the Review Worker to check `review-context.md` for context generation status, generate `review-context.md` if absent, and look for a `## Findings Summary` section in `review-context.md`.

**Impact**: The Supervisor's retry/completion detection logic is based on `review-context.md` presence and content. Even if `nitro-review-lead.md` were updated to use `handoff.md`, the Supervisor would still expect `review-context.md` artifacts.

**Evidence**: Lines 191 (`review-context.md exists? -> skip context generation`), 269 (`review-context.md exists? -> context generation done`), 273 (`review-context.md has ## Findings Summary`).

**Fix**: Update `worker-prompts.md` references from `review-context.md` to `handoff.md` for the read-context step, and update the Review Lead completion detection signal to match the new state indicator.

### Issue 5: parallel-mode.md Completion Detection Tied to review-context.md

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md` (lines 22, 435, 454, 644, 666)

**Scenario**: The Supervisor's `expected_end_state` for a Review Lead worker is `REVIEW_DONE`, detected by checking `review-context.md` having a `## Findings Summary` section. If `review-context.md` no longer exists, the Supervisor can never detect review completion.

**Impact**: The Supervisor would loop indefinitely polling for a `## Findings Summary` in `review-context.md` that never gets written. Tasks get stuck in IN_REVIEW until the Supervisor kills the worker as stuck.

**Evidence**: Line 454 — `file_contains | task-tracking/TASK_X/review-context.md | ## Findings Summary | REVIEW_DONE`.

**Fix**: Update the completion detection signal. The new Review Lead writes `handoff.md` + review files; a viable new signal could be checking that `review-code-logic.md` and `review-code-style.md` both exist and have Verdict sections.

### Issue 6: Phase Detection Table Missing Backward Compatibility Row

**File**: `.claude/skills/orchestration/SKILL.md` (line 210), `.claude/skills/orchestration/references/task-tracking.md` (line 198)

**Scenario**: Tasks that reached IMPLEMENTED status before this change ship without `handoff.md`. The phase detection table now has a row for `tasks.md (all COMPLETE)` which leads to "Team-leader MODE 3 OR QA choice", but there is no explicit row for `tasks.md (all COMPLETE)` without `handoff.md` plus existing `status = IMPLEMENTED`. A Build Worker resuming such a task may not correctly identify the right starting phase.

**Impact**: Ambiguous phase detection for tasks in the IMPLEMENTED→IN_REVIEW transition that predate this change. The new `handoff.md` row in the phase detection table becomes the canonical entry point, but old tasks lack the file that triggers it.

**Fix**: Add a note or fallback row: "tasks.md (all COMPLETE), no handoff.md, status = IMPLEMENTED → Dev complete without handoff artifact; Review Worker should treat as if handoff.md is absent and fall back to git diff exploration."

---

## Minor Issues

### Issue 7: SKILL.md Placement of handoff.md Instructions Is Counterintuitive

**File**: `.claude/skills/orchestration/SKILL.md` (lines 570-591)

**Scenario**: The `handoff.md` write instruction appears under the heading `## Completion Phase (MANDATORY — DO NOT SKIP)`, which is described as the Review Worker / Fix Worker / Completion Worker phase. A Build Worker reading this section might reasonably assume it is not their responsibility.

**Impact**: A Build Worker that reads only the "Build Worker Exit Gate" section (which correctly lists `handoff.md written` as a check) may not find the write instructions because they are buried in a section named for the opposite phase.

**Recommendation**: Add a dedicated `## handoff.md` section in the "Dev Phase" area of SKILL.md, or add a forward reference from the Build Worker section to line 570.

### Issue 8: Commit Order Instructions Place handoff.md in First (Implementation) Commit — But SKILL.md Section Title Misleads

**File**: `.claude/skills/orchestration/SKILL.md` (lines 570, 593-609)

**Scenario**: The text at line 570 says "Before the first commit — write handoff.md" but this appears inside the `## Completion Phase` section header. The Completion Phase scope note at lines 556-559 says "this phase runs in the Review Worker session only" and "Build Workers stop after implementation and do NOT execute this phase." This creates a direct contradiction: the `handoff.md` write step is inside the Completion Phase section, which says Build Workers do not execute it.

**Impact**: A Build Worker reading the Completion Phase scope note at line 556 would correctly infer "I skip this entire section." The `handoff.md` write step would then be skipped, making the Exit Gate check at line 753 fail unexpectedly.

**Recommendation**: Move the `handoff.md` write instructions out of the Completion Phase section and into a `## Dev Phase Handoff` section that explicitly targets Build Workers.

---

## Data Flow Analysis

```
Current (intended) flow after this change:
  Build Worker
    -> dev batches complete
    -> [NEW] write handoff.md (SKILL.md line 572)
    -> first commit: implementation + handoff.md (SKILL.md line 594)
    -> write status = IMPLEMENTED
    -> Exit Gate checks handoff.md present (SKILL.md line 753) ← PASS
    -> EXIT

  Supervisor detects IMPLEMENTED
    -> spawns Review Worker via worker-prompts.md ← UNCHANGED (still review-context.md)
    -> Review Worker starts nitro-review-lead.md
       -> Phase 1: generate review-context.md ← UNCHANGED — handoff.md ignored
       -> Sub-worker prompts: read review-context.md ← UNCHANGED
       -> Sub-workers complete
       -> Review Lead updates review-context.md with Findings Summary ← UNCHANGED
    -> Supervisor polls parallel-mode.md: looks for review-context.md ## Findings Summary ← UNCHANGED

  Actual outcome: handoff.md is written but never read.
  review-context.md is still generated. Token savings = 0.
```

### Gap Points Identified

1. `nitro-review-lead.md` — Phase 1 still generates `review-context.md` unconditionally.
2. Sub-worker prompt templates — still direct reviewers to `review-context.md` for scope.
3. `parallel-mode.md` — Supervisor completion detection tied to `review-context.md ## Findings Summary`.
4. `worker-prompts.md` — Review Worker prompt still references `review-context.md` throughout.
5. `apps/cli/scaffold/` — Not updated; scaffold is the delivery mechanism for new projects.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Build Worker writes `handoff.md` before IMPLEMENTED status | COMPLETE | Write instruction exists in SKILL.md; Exit Gate verifies it |
| handoff.md includes files changed, commits, decisions, risks | COMPLETE | Template in SKILL.md matches task spec exactly |
| Review Worker reads handoff.md as first action | MISSING | nitro-review-lead.md Phase 1 still writes review-context.md; sub-workers still read review-context.md |
| review-context.md generation removed | MISSING | 10+ references in nitro-review-lead.md; 2 in nitro-code-security-reviewer.md; present in auto-pilot |
| Phase detection table updated to recognize handoff.md | COMPLETE | New rows added in both SKILL.md and task-tracking.md |
| Single orchestration mode (`/orchestrate`) also writes handoff.md | PARTIAL | SKILL.md covers this path; but commit order note inside Completion Phase section contradicts Build Worker scope note |

### Implicit Requirements NOT Addressed

1. **Scaffold sync**: `apps/cli/scaffold/.claude/` files must mirror `.claude/` changes. This is stated as an invariant in CLAUDE.md but was not part of the task's file scope. All scaffold copies remain on the old flow.
2. **Backward compatibility signal**: Tasks reaching IMPLEMENTED before this change (no handoff.md) need an explicit fallback in phase detection and in the Review Lead's Phase 1, so the Supervisor can handle mixed-era tasks without getting stuck.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Build Worker crashes before writing handoff.md | NO | Exit Gate catches it, but no retry instruction | Worker exits cleanly via exit-gate-failure.md; Supervisor retries from scratch |
| Old task (IMPLEMENTED, no handoff.md) picked up by new Review Worker | NO | No fallback in Review Lead | Review Lead Phase 1 generates review-context.md anyway (no regression, but feature inactive) |
| handoff.md has wrong/missing sections | PARTIAL | Exit Gate checks `## Files Changed` and `## Commits` exist | Does not check `## Decisions` or `## Known Risks` |
| Sub-worker reads stale handoff.md from previous retry | NO | No version or attempt marker in handoff.md format | Could scope review against wrong commit |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Build Worker writes handoff.md | LOW | handoff.md present in task folder | Exit Gate enforces it |
| Review Worker reads handoff.md | HIGH | Review Worker never executes the read step | nitro-review-lead.md not updated |
| Supervisor detects review completion | HIGH | parallel-mode.md still polls review-context.md | Not updated; REVIEW_DONE signal broken if review-context.md removed |
| Scaffold delivers feature to new projects | HIGH | Scaffold not updated | 0% of new projects get the feature |

---

## Verdict

**Recommendation**: FAIL — REVISE

**Confidence**: HIGH

**Top Risk**: The primary consumer of `handoff.md` — the Review Worker (`nitro-review-lead.md`) — was not updated. The feature exists as an inert artifact: Build Workers write `handoff.md`, but nobody reads it. The token savings motivation for this task is not delivered.

**Minimum viable fix requires changes to**:
1. `.claude/agents/nitro-review-lead.md` — Phase 1 must read `handoff.md` instead of generating `review-context.md`; sub-worker prompts must reference `handoff.md`; Exit Gate must check `handoff.md`
2. `.claude/agents/nitro-code-security-reviewer.md` — remove `review-context.md` references
3. `.claude/skills/auto-pilot/references/worker-prompts.md` — update Review Worker prompt template
4. `.claude/skills/auto-pilot/references/parallel-mode.md` — update REVIEW_DONE completion signal
5. `apps/cli/scaffold/.claude/` — sync all changed files to scaffold

**Also recommended**:
6. Move `handoff.md` write instructions out of the `Completion Phase` section in SKILL.md to avoid the contradiction with the "Build Workers do not run this phase" scope note.

## What Robust Implementation Would Include

- `nitro-review-lead.md` Phase 1 rewritten to read `handoff.md` as first action, with explicit fallback to git diff if `handoff.md` is absent (backward compatibility for pre-feature tasks)
- Sub-worker prompts updated: "Read `handoff.md` (files changed, commits, scope)" instead of "Read `review-context.md`"
- `parallel-mode.md` REVIEW_DONE detection updated to check `review-code-logic.md` Verdict section (or similar stable signal) instead of `review-context.md ## Findings Summary`
- `worker-prompts.md` review prompt template updated throughout
- Scaffold sync enforced — all `.claude/` changes applied to `apps/cli/scaffold/.claude/`
- Backward compatibility row in phase detection table for IMPLEMENTED tasks without `handoff.md`
- `handoff.md` write step placed in a dedicated Build Worker section, not inside the Completion Phase
