# Code Style Review — TASK_2026_137

## Score: 5/10

## Summary

| Metric          | Value        |
|-----------------|--------------|
| Overall Score   | 5/10         |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3            |
| Serious Issues  | 2            |
| Minor Issues    | 2            |
| Files Reviewed  | 3            |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `handoff.md` instruction is placed inside the **Completion Phase** heading in SKILL.md (line 570), which opens with a scope note saying "Review Workers run this phase — Build Workers do NOT." A Build Worker reading this section top-to-bottom sees the scope note first (telling it to stop), then the `handoff.md` write instruction after. The instruction will be silently skipped by Build Workers following the documented intent of that section.

### 2. What would confuse a new team member?

The Review Lead Exit Gate (`SKILL.md:788`) says the check is "Review Worker reads this as first action to scope review" — but this is an **explanation**, not an enforceable check. The Command column says `Read task-tracking/TASK_[ID]/handoff.md` and the Expected column says `File exists — Review Worker reads this as first action`. The Exit Gate format requires Command/Expected pairs that can be mechanically verified. The Expected here mixes a machine-checkable condition (file exists) with a behavioral instruction ("reads this as first action") that cannot be verified at exit time. A new team member following the Exit Gate literally will pass this check simply because the file exists, with no guarantee the Review Worker actually used it.

### 3. What's the hidden complexity cost?

The acceptance criterion "review-context.md generation removed" is **not met** in the reviewed files. `nitro-review-lead.md` still generates `review-context.md` in at least 8 places (including its own Exit Gate checklist at line 367). This task's scope explicitly excluded agent files (File Scope lists only 3 SKILL files), but the task's own acceptance criterion says "review-context.md generation removed" without that scope constraint. The result is a split-brain state: SKILL.md says Review Workers read `handoff.md` instead of `review-context.md`, but `nitro-review-lead.md` still writes and requires `review-context.md`. The orchestration skill and the agent it spawns now disagree on the protocol.

### 4. What pattern inconsistencies exist?

`handoff.md` was added only to the **FEATURE** flow in `strategies.md` (line 57). The BUGFIX and REFACTORING flows still show `[QA agents] --> Git --> nitro-modernization-detector` with no mention of `handoff.md`. Per SKILL.md, ALL task types go through the Build Worker / Review Worker split in Supervisor mode. BUGFIX and REFACTORING tasks running in Supervisor mode will have Build Workers with no instruction to write `handoff.md`, and Review Workers with no instruction to read it.

### 5. What would I do differently?

Move the `handoff.md` write instruction out of the Completion Phase section and into a dedicated **Build Worker Completion** section (or the section immediately after team-leader MODE 3). The instruction belongs to the Build Worker lifecycle, not the Completion Phase, which is explicitly owned by the Review Worker. Additionally, split the acceptance criterion — "review-context.md generation removed" should be a separate task scoped to the agent files.

---

## Blocking Issues

### Issue 1: handoff.md instruction is buried inside a Review-Worker-scoped section

- **File**: `.claude/skills/orchestration/SKILL.md:554-570`
- **Problem**: The `handoff.md` write instruction (line 570) appears after the Completion Phase heading (line 554), which opens with: "In Supervisor mode, this phase runs in the Review Worker session only. Build Workers stop after implementation and do NOT execute this phase." The instruction that follows is addressed to Build Workers, but it is physically inside a section explicitly scoped to Review Workers. A Build Worker reading the Completion Phase scope note will stop reading and miss the `handoff.md` instruction entirely.
- **Impact**: `handoff.md` will not be written. The Build Worker Exit Gate (line 753) checks for it, so the Exit Gate will fail — but the worker may not reach the Exit Gate if it exits after the scope note tells it to stop.
- **Fix**: Move the `handoff.md` instruction block (lines 570-594) to a section clearly owned by the Build Worker, such as immediately after the team-leader MODE 3 description, or create a dedicated `## Build Worker Completion` section before the Completion Phase.

### Issue 2: Agent files still generate review-context.md — accepted criterion not met

- **File**: `.claude/agents/nitro-review-lead.md` (lines 26, 40, 150, 162, 173, 185, 196, 208, 268, 367 and more)
- **Problem**: The task acceptance criterion states "review-context.md generation removed (handoff.md replaces it)". `nitro-review-lead.md` still writes `review-context.md` as its primary first action, passes it to all sub-worker spawns, and requires it in its own Exit Gate. This is the agent that SKILL.md's Review Lead Exit Gate now says reads `handoff.md`. The two files now describe contradictory protocols for the same worker.
- **Impact**: In production, the Review Worker will follow `nitro-review-lead.md` (its direct instruction file) and generate `review-context.md`, ignoring `handoff.md`. The SKILL.md instruction to "read handoff.md as first action" will be overridden by the agent's own contradictory instructions.
- **Fix**: Either update `nitro-review-lead.md` to replace `review-context.md` with `handoff.md` (completing the migration), or revise the acceptance criterion to scope it to SKILL files only and track agent migration as a separate task.

### Issue 3: BUGFIX and REFACTORING strategies missing handoff.md step

- **File**: `.claude/skills/orchestration/references/strategies.md:78-128`
- **Problem**: The `handoff.md` write step was added only to the FEATURE flow (line 57). BUGFIX and REFACTORING flows end with `[QA agents] --> Git --> nitro-modernization-detector` with no `handoff.md` step. In Supervisor mode, all task types use the Build Worker / Review Worker split. Build Workers on BUGFIX and REFACTORING tasks have no instruction to write `handoff.md`, and their Review Workers have no instruction to read it.
- **Impact**: Review Workers on BUGFIX and REFACTORING tasks will either fail the Exit Gate check (because `handoff.md` is absent) or proceed without it, negating the token-savings benefit for those task types.
- **Fix**: Add the `handoff.md` write step to BUGFIX (after team-leader MODE 3) and REFACTORING (after team-leader MODE 3) flows.

---

## Serious Issues

### Issue 1: Review Lead Exit Gate mixes a behavioral instruction into an Expected column

- **File**: `.claude/skills/orchestration/SKILL.md:788`
- **Problem**: The row `handoff.md read | Read task-tracking/TASK_[ID]/handoff.md | File exists — Review Worker reads this as first action to scope review` embeds "Review Worker reads this as first action" inside the Expected column. Per the review-general.md lesson (TASK_2026_028): "Exit Gate / checklist table Expected columns must match what the Command column actually checks." The Command only verifies file existence; the second clause in Expected is a behavioral assertion that cannot be mechanically verified at exit time. It will be silently ignored by any worker running the Exit Gate.
- **Recommendation**: Split into two rows — one checking file existence (machine-verifiable), one as a prose instruction block outside the table directing the Review Worker to read it as the first action.

### Issue 2: handoff.md absent from Phase Detection Table in SKILL.md

- **File**: `.claude/skills/orchestration/SKILL.md:200-213`
- **Problem**: The SKILL.md Phase Detection Table (the abbreviated version at line 200) was updated to include `handoff.md` rows. However, the `task-tracking.md` Phase Detection Table (line 187-203) was also updated. These two tables serve the same purpose for different audiences (SKILL.md for orchestrators, task-tracking.md for continuation detection). The two tables are now inconsistent: SKILL.md line 210 says "Dev complete — Review Worker reads handoff.md to scope review" while task-tracking.md line 198 says "Handoff written | Review Worker reads handoff.md first". The Phase Status column in task-tracking.md uses the value "Handoff written" which is not part of the canonical phase status vocabulary elsewhere in the document ("Initialized", "PM done", "Architect done", etc.). This looks like a new value was invented for this row without confirming it matches any other phase vocabulary.
- **Recommendation**: Verify the Phase Status label is intentional and consistent with other tables that use phase status values.

---

## Minor Issues

1. **strategies.md line 57**: The `handoff.md` step appears between Phase 5 and Phase 6 as a plain line (not a phase). The surrounding flow uses `Phase N:` labels. The inserted step has no phase number, which breaks the sequential phase numbering. Consider `Phase 5.5:` or restructure as a sub-bullet under Phase 5.

2. **SKILL.md line 591**: The sentence "it does NOT re-run git diff exploration or generate a separate review-context.md" uses implementation-era language ("generate a separate review-context.md"). Per review-general.md (TASK_2026_064): "Implementation-era language must be removed before merge." Once review-context.md is fully removed from the system, this sentence references a defunct artifact as if it is still an active concern. Rewrite as: "it does NOT re-run git diff exploration."

---

## File-by-File Analysis

### `.claude/skills/orchestration/SKILL.md`

**Score**: 4/10
**Issues Found**: 2 blocking, 1 serious, 1 minor

**Analysis**: The handoff.md format template is present and complete (lines 574-589). The Build Worker Exit Gate row is correctly defined. The critical structural flaw is placement: the write instruction is inside the Completion Phase section, which opens with an explicit scope boundary excluding Build Workers. The Review Lead Exit Gate row conflates verification with instruction.

**Specific Concerns**:
1. Lines 554-570: Completion Phase scope note excludes Build Workers, but handoff.md instruction immediately follows — Build Workers will miss it
2. Line 788: Expected column contains unverifiable behavioral text ("reads this as first action")

### `.claude/skills/orchestration/references/task-tracking.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: The folder structure entry (line 36), Document Ownership table (line 153), and Phase Detection Table (line 198) are all updated consistently. No residual `review-context.md` references. The only concern is the "Handoff written" phase status label — it is grammatically inconsistent with other phase status labels in the same table (which use noun phrases like "PM done", "Architect done").

**Specific Concerns**:
1. Line 198: "Handoff written" as a Phase Status does not follow the `[Role] done` / `[Role] complete` pattern used by surrounding rows

### `.claude/skills/orchestration/references/strategies.md`

**Score**: 4/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The handoff.md step was added to FEATURE only. BUGFIX and REFACTORING flows were not updated. The step insertion itself is clear and unambiguous in the FEATURE flow, but the incomplete coverage means the change is half-deployed.

**Specific Concerns**:
1. Lines 78-128: BUGFIX and REFACTORING flows have no handoff.md step
2. Line 57: Missing phase numbering for the inserted step

---

## Pattern Compliance

| Pattern                            | Status | Concern                                                                    |
|------------------------------------|--------|----------------------------------------------------------------------------|
| Single source of truth             | FAIL   | SKILL.md and nitro-review-lead.md now describe contradictory protocols     |
| Exit Gate Expected matches Command | FAIL   | Review Lead Exit Gate row mixes behavioral instruction into Expected column |
| Consistent phase vocabulary        | PARTIAL | "Handoff written" doesn't follow existing phase status naming pattern      |
| Cross-file consistency             | FAIL   | handoff.md step missing from BUGFIX and REFACTORING strategies             |
| Implementation-era language removed| FAIL   | Line 591 references review-context.md as if it is still a live alternative |

---

## Technical Debt Assessment

**Introduced**: A protocol split between SKILL.md (handoff.md) and nitro-review-lead.md (review-context.md). Workers reading SKILL.md will expect one protocol; workers running the Review Lead agent will follow the other.

**Mitigated**: None — the full migration is incomplete.

**Net Impact**: Negative. The partial migration creates more confusion than the prior single-protocol state.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `handoff.md` write instruction is placed inside a section that explicitly tells Build Workers to stop reading. The instruction will be silently skipped in Supervisor mode, which is the primary use case for handoff.md. This defeats the feature's purpose.

## What Excellence Would Look Like

A 9/10 implementation would:
1. Place the `handoff.md` write instruction in a dedicated **Build Worker Completion** section before the Completion Phase, with no ambiguity about which worker executes it
2. Update BUGFIX and REFACTORING strategies with the handoff.md step
3. Either migrate `nitro-review-lead.md` to use `handoff.md` (completing the acceptance criterion) or explicitly scope the acceptance criterion to SKILL files only with a follow-on task tracked
4. Fix the Exit Gate Expected column to separate machine-verifiable checks from behavioral instructions
5. Remove implementation-era language from line 591
