# Development Tasks - TASK_2026_264

**Total Tasks**: 9 | **Batches**: 3 | **Status**: 0/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- `write_handoff` accepts a `notes` field: Verified — plan.md line 178 confirms using `notes` field as the DECOMPOSED signal carrier.
- `bulk_create_subtasks` tool exists (from TASK_2026_263): Verified — plan.md line 34 cites TASK_2026_263 handoff confirmation.
- Supervisor reads `read_handoff()` before spawning Implement Workers: Verified — parallel-mode.md Step 4/5 structure confirmed.
- Subtask IDs use `TASK_YYYY_NNN.M` dotted format: Verified — plan.md line 34.
- Scaffold copies exist at `apps/cli/scaffold/`: Verified — file exists at apps/cli/scaffold/.claude/skills/nitro-auto-pilot/references/worker-prompts.md.

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Supervisor loop `notes` field check must handle absent field gracefully (non-decomposed tasks have no `notes`) | MED | Task 2.2 spec explicitly calls this out — developer must guard with null/absent check |
| Scaffold sync: pre-commit hook enforces parity, but developer must edit scaffold files in same commit | MED | Tasks 1.5 and 2.5 are dedicated scaffold sync tasks |

---

## Batch 1: Prep Worker Prompt — Decomposition Analysis COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 5 | **Dependencies**: None
**Commit**: 15ea85d

### Task 1.1: Add decomposition decision tree to First-Run Prep Worker Step 3 COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
**Spec Reference**: plan.md lines 104–155
**Location in File**: Lines 293–298 (current Step 3 inside First-Run Prep Worker Prompt block)

**Quality Requirements**:
- Replace the single Step 3 block with the branching version (3a–3d) exactly as specified
- Branches: Simple → 3c, Medium/single concern → 3c, Medium/multi-concern → 3d, Complex → 3d
- Step 3d must include: bulk_create_subtasks call, fallback to Step 3c on failure, capture returned IDs
- Step 3c must end with: "Stop after Team Leader MODE 1. Do NOT enter MODE 2 (dev loop)."
- Both branches must set the decomposed flag for write_handoff in Step 4

**Implementation Details**:
- The block is inside a fenced code block (``` ``` ```) — preserve that fencing
- After `Architect phase → produces plan.md`, insert the `After plan.md is written, run DECOMPOSITION ANALYSIS:` block
- The existing "Team Leader MODE 1" line moves into the 3c branch

---

### Task 1.2: Update Step 4a write_handoff call with DECOMPOSED notes field COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
**Spec Reference**: plan.md lines 157–179
**Location in File**: Lines 300–307 (current Step 4 write_handoff call)

**Quality Requirements**:
- Add `batches=["DECOMPOSED — see subtasks: TASK_YYYY_NNN.1, TASK_YYYY_NNN.2, ..."]` conditional note
- Add `notes="DECOMPOSED: subtask_ids=[TASK_YYYY_NNN.1, TASK_YYYY_NNN.2, ...]"` field — omit if not decomposed
- The `notes` field is the Supervisor's signal — must use exact prefix `"DECOMPOSED:"` for reliable detection

---

### Task 1.3: Update Step 5 Exit Gate with decomposed/non-decomposed conditional checks COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
**Spec Reference**: plan.md lines 181–194
**Location in File**: Lines 313–320 (current Step 5 EXIT GATE block)

**Quality Requirements**:
- Replace the two existing `tasks.md` and `plan.md` checks with the conditional version from spec
- IF decomposed path: check subtask existence via get_task_context("TASK_YYYY_NNN.1")
- IF NOT decomposed path: check tasks.md exists with at least 1 batch
- Retain all existing checks (read_handoff, commits, get_task_context PREPPED)

---

### Task 1.4: Update Retry Prep Worker Step 3 with decomposition resume detection COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
**Spec Reference**: plan.md lines 197–216
**Location in File**: Lines 363–370 (current Step 3 inside Retry Prep Worker Prompt block)

**Quality Requirements**:
- Add two new resume checkpoints after the `tasks.md` check:
  1. `read_handoff(...) notes contains "DECOMPOSED"? -> Decomposition already done`
  2. `get_task_context("TASK_YYYY_NNN.1") succeeds? -> Subtasks already created`
- Keep the existing four checkpoints in place, in order
- The "Resume from the earliest incomplete step." line must remain at the end

---

### Task 1.5: Sync Batch 1 changes to scaffold copy COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/scaffold/.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
**Spec Reference**: Plan note on scaffold sync (enforced by pre-commit hook)

**Quality Requirements**:
- Apply the identical changes from Tasks 1.1–1.4 to the scaffold copy
- The two files must be byte-for-byte identical after this task
- Do NOT just copy the whole file — make targeted edits to the scaffold copy matching what was done to the source

---

**Batch 1 Verification**:
- All 5 files exist (source + scaffold are both the same path pattern)
- First-Run Prep Worker Step 3 has the 3a–3d branching decision tree
- Step 4a write_handoff shows conditional `notes` and `batches` fields
- Step 5 EXIT GATE has IF decomposed / IF NOT decomposed conditional checks
- Retry Prep Worker Step 3 has the two new decomposition resume checkpoints
- Scaffold copy matches source file exactly
- nitro-code-logic-reviewer approved

---

## Batch 2: Supervisor Loop — Decomposed Task Routing IMPLEMENTED

**Developer**: nitro-systems-developer
**Tasks**: 4 | **Dependencies**: Batch 1 complete (conceptually independent, but same developer flow)

### Task 2.1: Add subtask ID pattern recognition and DECOMPOSED_PARENT classification to Step 3 IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md lines 224–236
**Location in File**: After the classification list ending at line ~96 (after the `CANCELLED` bullet)

**Quality Requirements**:
- Add a `**Subtask-aware classification**:` subsection after the existing classification bullets
- Regex for subtask ID: `^TASK_\d{4}_\d{3}\.\d+$`
- Define DECOMPOSED_PARENT: a task at PREPPED with subtasks in DB — do NOT spawn Implement Worker for it
- State that subtasks follow the same state machine as top-level tasks
- Note: parent progresses when all subtasks reach COMPLETE (cross-reference Step 4)
- The dependency-validation regex on line 80 (`^TASK_\d{4}_\d{3}$`) must be updated or noted to allow subtask IDs through — subtask dependencies use the dotted format

**Validation Notes**:
- The existing regex `^TASK_\d{4}_\d{3}$` on line 80 validates dependency tokens and will REJECT subtask IDs (`TASK_YYYY_NNN.M`). The developer must update that validation line to allow both formats: `^TASK_\d{4}_\d{3}(\.\d+)?$`

---

### Task 2.2: Add decomposed parent handling + subtask routing + parent auto-promotion to Step 4 IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md lines 238–261
**Location in File**: After the priority strategy section (after the `balanced` strategy block, before Step 5)

**Quality Requirements**:
- Add `**Decomposed Parent Handling**:` subsection with the two-case logic:
  - Notes contain "DECOMPOSED" → skip implement_candidates, route subtasks to build_candidates/implement_candidates
  - Notes absent or no "DECOMPOSED" → add to implement_candidates as before
- The `notes` field check MUST be a null-safe guard: treat absent/null notes as non-decomposed
- Add `**Subtask completion → parent auto-promotion**:` subsection:
  - update_task(parent, IMPLEMENTED) when all subtasks COMPLETE
  - emit log_event: PARENT_AUTO_PROMOTED
  - parent enters READY_FOR_REVIEW in next Step 3 pass
- Reference: use `get_subtasks(parent_task_id)` if available, else match TASK_YYYY_NNN.M pattern

---

### Task 2.3: Add subtask completion detection hook to Step 7 IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md lines 263–273
**Location in File**: After item 4 in Step 7 (line ~210, after the Review/Fix completion bullet)

**Quality Requirements**:
- Add item `4b.` (not a new numbered item — keep it as 4b to preserve existing numbering)
- Pattern check: task_id matches `TASK_YYYY_NNN.M` pattern → subtask completion path
- Call `get_parent_status_rollup(parent_task_id)` to check sibling completion
- Cross-reference Step 4 auto-promotion logic when all siblings COMPLETE and parent still PREPPED

---

### Task 2.4: Add subtask row to Worker-Exit Reconciliation table + post-reconciliation note IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/nitro-auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md lines 275–289
**Location in File**: Worker-Exit Reconciliation table (around line 235–241)

**Quality Requirements**:
- Add new row to the Expected-state mapping table: `| Subtask Build/Implement Worker | IN_PROGRESS or IMPLEMENTING | IMPLEMENTED |`
- Add post-table note: `**Subtask reconciliation**: After reconciling a subtask, call get_parent_status_rollup to check whether this subtask's completion finishes the parent's decomposition. Apply parent auto-promotion if all siblings are COMPLETE.`
- Table formatting must match existing table style (pipe-delimited, aligned)

---

### Task 2.5: Sync Batch 2 changes to scaffold copy IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/scaffold/.claude/skills/nitro-auto-pilot/references/parallel-mode.md`
**Spec Reference**: Plan note on scaffold sync (enforced by pre-commit hook)

**Quality Requirements**:
- Apply the identical changes from Tasks 2.1–2.4 to the scaffold copy
- The two files must be byte-for-byte identical after this task

---

**Batch 2 Verification**:
- Step 3 has `**Subtask-aware classification**:` subsection with DECOMPOSED_PARENT definition
- Step 3 dependency-token regex updated to `^TASK_\d{4}_\d{3}(\.\d+)?$`
- Step 4 has `**Decomposed Parent Handling**:` and `**Subtask completion → parent auto-promotion**:` subsections
- Step 4 notes-field check is null-safe
- Step 7 has item 4b for subtask completion detection
- Worker-Exit Reconciliation table has the subtask row
- Post-reconciliation rollup note present
- Scaffold copy matches source file exactly
- nitro-code-logic-reviewer approved

---

## Batch 3: Team-Leader Agent Clarification Note PENDING

**Developer**: nitro-systems-developer
**Tasks**: 1 | **Dependencies**: None (independent of Batches 1 and 2)

### Task 3.1: Add MODE 1 bypass note to nitro-team-leader.md PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/nitro-team-leader.md`
**Spec Reference**: plan.md lines 292–303
**Location in File**: MODE 1 section, after the `**Trigger**: Orchestrator invokes you, plan.md exists, tasks.md does NOT exist` line (line 39)

**Quality Requirements**:
- Insert a `**Note**:` block immediately after the Trigger line
- Exact content per spec:
  > This mode is bypassed when the Prep Worker decomposes a Complex (or eligible Medium) task into subtasks via bulk_create_subtasks. In that case, each subtask becomes an independent task with its own Prep/Build Worker — MODE 1 runs within each subtask's worker, not the parent.
- Do NOT modify any other part of the agent file
- nitro-team-leader.md does NOT have a scaffold copy — no sync needed

---

**Batch 3 Verification**:
- `**Note**:` block present immediately after the MODE 1 Trigger line
- Note text matches spec exactly
- No other changes to the file
- nitro-code-logic-reviewer approved

---

## Task Status Summary

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Add decomposition decision tree to First-Run Prep Worker Step 3 | COMPLETE |
| 1.2 | Update Step 4a write_handoff with DECOMPOSED notes field | COMPLETE |
| 1.3 | Update Step 5 Exit Gate with conditional checks | COMPLETE |
| 1.4 | Update Retry Prep Worker Step 3 with decomposition resume detection | COMPLETE |
| 1.5 | Sync Batch 1 changes to scaffold copy | COMPLETE |
| 2.1 | Add subtask classification to parallel-mode.md Step 3 | IMPLEMENTED |
| 2.2 | Add decomposed parent handling to parallel-mode.md Step 4 | IMPLEMENTED |
| 2.3 | Add subtask completion detection to parallel-mode.md Step 7 | IMPLEMENTED |
| 2.4 | Add subtask row to Worker-Exit Reconciliation table | IMPLEMENTED |
| 2.5 | Sync Batch 2 changes to scaffold copy | IMPLEMENTED |
| 3.1 | Add MODE 1 bypass note to nitro-team-leader.md | PENDING |
