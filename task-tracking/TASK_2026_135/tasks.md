# Development Tasks — TASK_2026_135

**Total Tasks**: 5 | **Batches**: 1 | **Status**: 0/1 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- Step 2 lines 76-101: Verified — section exists, correct location for cache header and roster write insertion.
- Step 3b lines 191-216: Verified — unconditional plan.md read section exists, correct candidate for full replacement.
- Step 2 fallback lines 87-101: Verified — fallback path exists, step 4 is the correct insertion point for Status Map caching.
- Step 3 line 127: Verified — "Use the file-based parsing below (original logic — unchanged)." text confirmed, correct replacement target.
- Step 7f lines 727-729: Verified — the loop-back paragraph exists verbatim at that location.
- Step 3d / Step 4 boundary line ~243: Verified — Step 3d ends, Step 4 begins after line 243.

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Changes 3 and 4 are logically coupled — Change 4's Step 7f incremental update references the `## Cached Status Map` introduced by Change 3. If implemented in isolation, the spec would be internally inconsistent. | LOW | Developer must implement all 5 changes in a single editing session. Task 1.3 explicitly notes this dependency. |

---

## Batch 1: Cache Registry and Spec Edits to parallel-mode.md IMPLEMENTED

**Developer**: nitro-systems-developer
**Tasks**: 5 | **Dependencies**: None

---

### Task 1.1: Add Cache Behaviour Header and Roster Write to Step 2 IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md — Change 1 (lines 76-101 of parallel-mode.md)
**Edit Type**: Insert (two insertions into Step 2)

**Quality Requirements**:
- Insert the "Cache behaviour" block immediately after the `### Step 2: Read Registry` heading (before the "Preferred path" heading).
- Insert the "Writing the Cached Task Roster" block after the "Do not re-check per loop" note (after line 101 of the current file, before `### Step 2b`).
- Preserve all existing Step 2 content — these are additions, not replacements.
- Both insertions must match the exact wording in plan.md Change 1 verbatim.

**Implementation Details**:
- First insertion location: immediately after `### Step 2: Read Registry` heading.
- Second insertion location: after `fall back. Do not re-check per loop — the flag persists for the session.` and before `### Step 2b: Task Quality Validation`.
- The roster write table format: `| Task ID | Status | Type | Priority | Dependencies |`.
- Session flag to document: `task_roster_cached = true`.

---

### Task 1.2: Replace Step 3b Entirely with Startup-Cache Pattern IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md — Change 2 (lines 191-216 of parallel-mode.md)
**Edit Type**: Replace (full section replacement)

**Quality Requirements**:
- Replace the entire existing `### Step 3b: Check Strategic Plan (Optional)` section with the new version from plan.md Change 2.
- The new section runs from the `### Step 3b` heading through the recovery note ending with "no re-read needed unless `Supervisor Guidance = REPRIORITIZE`."
- Do NOT carry over any text from the old Step 3b — it is a complete replacement.
- The new section must include: Cache behaviour block, Refresh triggers, Full read procedure, Cached Plan Guidance write format, Apply guidance table (updated), Security note, Plan-aware tie-breaking note, and on-recovery note.

**Implementation Details**:
- Old section boundary: from `### Step 3b: Check Strategic Plan (Optional)` through `Continue to Step 4 with default ordering (Priority then Task ID). No consultation needed.`
- New section: exact text from plan.md Change 2 (the fenced markdown block).
- Session flag to document: `plan_guidance_cached = true`.
- State.md section: `## Cached Plan Guidance`.

---

### Task 1.3: Add Status Map Caching to Step 2 Fallback Path and Update Step 3 IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md — Change 3 (lines 87-101 and 125-128 of parallel-mode.md)
**Edit Type**: Insert + Replace (two targeted edits)

**Quality Requirements**:
- In the Step 2 fallback path: append a new step 5 (Status Map build and cache) after the existing step 4 of the fallback path.
- In the Step 2 preferred path (cortex): append the cortex-path note after the `get_tasks()` call paragraph, before the "Cortex availability detection" heading.
- In Step 3 fallback path: replace `Use the file-based parsing below (original logic — unchanged).` with the new text directing the supervisor to use `## Cached Status Map` from state.md instead of re-reading individual status files.
- Also add the note about updating the Cached Status Map row when writing BLOCKED (in the dependency validation section of Step 3).

**Validation Notes**:
- DEPENDENCY: Task 1.4 (Step 7f incremental update) references the `## Cached Status Map` created here. Implement this task first and verify the section name is exactly `## Cached Status Map` so Task 1.4's text is consistent.

**Implementation Details**:
- Step 2 fallback insertion: after `"[warn] TASK_YYYY_NNN: registry row missing Priority/Dependencies — treating as P2-Medium, no deps"` paragraph.
- New step 5 table format: `| Task ID | Status | Last Updated |`.
- State.md section: `## Cached Status Map`.
- Step 3 fallback path replacement target: `Use the file-based parsing below (original logic — unchanged).`
- Step 3 BLOCKED write addition: append note after each BLOCKED write block in dependency validation ("After writing BLOCKED, also update that task's row in the `## Cached Status Map` in state.md.").

---

### Task 1.4: Replace Step 7f Loop-Back Paragraph with Incremental Update Procedure IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md — Change 4 (lines 727-729 of parallel-mode.md)
**Edit Type**: Replace (single paragraph replacement)

**Quality Requirements**:
- Replace the current Step 7f paragraph (current text: "**7f. After processing all completions**, immediately re-evaluate: A completed task may unblock downstream tasks. Go back to **Step 2** (read registry, rebuild dependency graph).") with the new 4-step incremental update procedure from plan.md Change 4.
- The new procedure must include all 4 numbered steps verbatim.
- "Go to **Step 4** (NOT Step 2)" must be preserved exactly — this is the behavioral change.

**Validation Notes**:
- DEPENDENCY: References `## Cached Status Map` introduced in Task 1.3. Verify Task 1.3 is complete before finalizing this task's wording.

**Implementation Details**:
- Replacement target: the full paragraph starting with `**7f. After processing all completions**, immediately re-evaluate:` through `Go back to **Step 2** (read registry, rebuild dependency graph).`
- New text: exact 4-step procedure from plan.md Change 4.

---

### Task 1.5: Insert New "Cache Invalidation Rules" Section Between Step 3d and Step 4 IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md — Change 5 (after line 243 of parallel-mode.md)
**Edit Type**: Insert (new top-level section)

**Quality Requirements**:
- Insert the new `### Cache Invalidation Rules` section immediately after the Step 3d section ends and before the `### Step 4: Order Task Queue` heading.
- The section must include: the three-row cache table, Task Roster invalidation detail, Plan Guidance invalidation detail, Status Map invalidation detail, and Compaction recovery paragraph.
- Do NOT modify the Step 4 heading or any Step 3d content.

**Implementation Details**:
- Insertion location: after `(Original Step 3d logic applies verbatim.)` and before `### Step 4: Order Task Queue`.
- New section: exact text from plan.md Change 5 (the fenced markdown block).
- The three caches documented: `## Cached Task Roster`, `## Cached Plan Guidance`, `## Cached Status Map`.

---

**Batch 1 Verification**:

- File exists at `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
- All 5 edits applied without losing existing content
- Cache behaviour header appears in Step 2 before "Preferred path" heading
- Step 3b is fully replaced (old unconditional read is gone)
- Step 2 fallback path now has step 5 (Status Map build)
- Step 3 fallback path uses Cached Status Map (not "original logic — unchanged")
- Step 7f goes to Step 4 (NOT Step 2)
- Cache Invalidation Rules section exists between Step 3d and Step 4
- nitro-code-logic-reviewer approved
