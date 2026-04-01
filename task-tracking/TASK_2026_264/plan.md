# Implementation Plan — TASK_2026_264
# Prep Worker: Task Decomposition into Subtasks

---

## Codebase Investigation Summary

### Files Analyzed

- `.claude/skills/nitro-auto-pilot/references/worker-prompts.md` — Prep Worker prompt at lines 273–345 (First-Run) and 347–395 (Retry)
- `.claude/skills/nitro-auto-pilot/references/parallel-mode.md` — Full Supervisor loop: Steps 1–8, Worker-Exit Reconciliation, Pre-Exit Guard
- `.claude/agents/nitro-team-leader.md` — Team-Leader agent: MODE 1 (DECOMPOSITION), 2 (VERIFY+COMMIT), 3 (COMPLETION)
- `task-tracking/TASK_2026_263/handoff.md` — Confirms `bulk_create_subtasks` MCP tool was delivered with subtask IDs as `TASK_YYYY_NNN.M`

### MCP Tool Schema — `bulk_create_tasks`

From live tool inspection, the `bulk_create_tasks` MCP tool accepts:

```
tasks[]: {
  title         (required, string)
  description   (required, string)
  type          (required, enum: FEATURE|BUGFIX|REFACTORING|DOCUMENTATION|...)
  priority      (required, enum: P0-Critical|P1-High|P2-Medium|P3-Low)
  complexity    (optional, enum: Simple|Medium|Complex)
  dependencies  (optional, string[])
  fileScope     (optional, string[])
  model         (optional, string)
  parallelism   (optional, string)
  acceptanceCriteria (optional, string[])
}
```

Note: The task.md says `bulk_create_subtasks` but TASK_2026_263 actually delivered a tool called `bulk_create_subtasks` (separate from `bulk_create_tasks`). The handoff confirms subtask IDs use a dotted format `TASK_YYYY_NNN.M` stored in the existing `id` TEXT column. The Prep Worker should call `bulk_create_subtasks`, not `bulk_create_tasks`.

### Key Patterns Identified

**Current Prep Worker 6-step flow** (worker-prompts.md lines 285–320):
1. `update_task` → `emit_event` (IN_PROGRESS)
2. Auto-approve all checkpoints
3. Run PM → Researcher → Architect → Team-Leader MODE 1 → produces tasks.md
4. `write_handoff` + `stage_and_commit` + `update_task(PREPPED)`
5. Exit Gate verification
6. Stop — no code, no MODE 2/3

**Supervisor task-state classifications** (parallel-mode.md Step 3):
- `PREPPED` → `READY_FOR_IMPLEMENT` — Supervisor spawns an Implement Worker
- No intermediate state between PREPPED and IMPLEMENTING currently exists

**Worker-Exit Reconciliation table** (parallel-mode.md lines 235–241):
- Prep Worker: IN_PROGRESS → PREPPED (expected post-exit state)
- No subtask-aware case currently exists

---

## Architecture Design

### Core Design Question: How Does Decomposition Fit the Prep Worker Flow?

The Prep Worker currently produces `tasks.md` (Team-Leader MODE 1 artifact) and sets the task to `PREPPED`. The Supervisor's response to `PREPPED` is always: spawn one Implement Worker.

After decomposition, there is no single implement worker to spawn — instead the Supervisor must schedule 2–5 subtasks as independent units. This means decomposition must:

1. Happen **before** the current tasks.md step — replacing the Team-Leader MODE 1 call for complex tasks
2. Produce subtasks in the DB via `bulk_create_subtasks`
3. Signal the Supervisor via the handoff (no new task status needed — see rationale below)

### Decision: No New Intermediate Task Status

**Rationale**: Adding a new status (e.g., `DECOMPOSED`) would require changes across the DB schema, `get_tasks()` filters, Step 3 classification logic, and reconciliation tables — a large blast radius. Instead:

- The parent task still moves to `PREPPED` as today
- The `write_handoff` call includes a new boolean field: `decomposed: true` and a `subtask_ids: ["TASK_YYYY_NNN.1", ...]` list
- In Step 3 (Build Dependency View), the Supervisor already treats `PREPPED` → `READY_FOR_IMPLEMENT`
- The Supervisor checks for subtasks **before spawning an Implement Worker** — if subtasks exist in the DB for this parent, it routes to subtask scheduling instead of spawning one Implement Worker for the parent

This keeps the task state machine unchanged and localizes all new logic to two places: the Prep Worker prompt and Step 4/5 of the Supervisor loop.

### Decision: Where Decomposition Happens in the Prep Worker Flow

**For Complex tasks** (and Medium tasks when the analysis determines spanning concerns):

- Step 3 is replaced: instead of invoking Team-Leader MODE 1 to produce `tasks.md`, the Prep Worker runs a **Decomposition Analysis** section
- The Decomposition Analysis invokes the **nitro-software-architect** (Architect phase) to produce a `plan.md` as today, but then instead of passing plan.md to Team-Leader for tasks.md, the Prep Worker calls `bulk_create_subtasks` to create subtasks in the DB
- `tasks.md` is NOT produced for a decomposed parent — the subtasks ARE the implementation plan decomposition, tracked in the DB
- The `write_handoff` call carries `decomposed: true` and the subtask IDs

**For Simple tasks and Medium tasks with single concerns**:

- The flow is completely unchanged — Team-Leader MODE 1 runs, tasks.md is produced, PREPPED, one Implement Worker spawned

### Decision: Decomposition Analysis Is Part of Architect Phase, Not a New Agent

The Architect phase already produces `plan.md` with component specifications. The decomposition analysis reads `plan.md` and decides whether to split. This keeps the Prep Worker prompt self-contained without requiring a new agent invocation.

---

## Detailed Specification

### File 1: `.claude/skills/nitro-auto-pilot/references/worker-prompts.md`

#### Change: Add Decomposition Section to First-Run Prep Worker Prompt (Step 3)

Current Step 3 (lines 293–298):
```
3. Run the planning phases of the orchestration flow:
   - PM phase → produces task-description.md
   - Researcher phase (if task type requires it) → produces research-report.md
   - Architect phase → produces plan.md
   - Team Leader MODE 1 → produces tasks.md with batched tasks (all PENDING)
   Stop after Team Leader MODE 1. Do NOT enter MODE 2 (dev loop).
```

New Step 3 — add a branching decision after Architect phase completes:

```
3. Run the planning phases of the orchestration flow:
   - PM phase → produces task-description.md
   - Researcher phase (if task type requires it) → produces research-report.md
   - Architect phase → produces plan.md

   After plan.md is written, run DECOMPOSITION ANALYSIS:

   3a. Read the task's complexity from the DB: get_task_context("TASK_YYYY_NNN").
   3b. Read plan.md and count distinct concerns/layers (e.g., DB schema, service layer,
       API handler, frontend component — each is a separate concern).

   DECOMPOSITION DECISION:
   - Simple complexity → NO decomposition. Proceed to Step 3c (Team-Leader MODE 1).
   - Medium complexity, single concern or single file → NO decomposition. Proceed to Step 3c.
   - Medium complexity, 2+ distinct concerns spanning multiple files → DECOMPOSE. Proceed to Step 3d.
   - Complex complexity → DECOMPOSE. Proceed to Step 3d.

   3c. NO DECOMPOSITION PATH — proceed as before:
   - Team Leader MODE 1 → produces tasks.md with batched tasks (all PENDING)
   - Stop after Team Leader MODE 1. Do NOT enter MODE 2 (dev loop).
   - Set decomposed = false for write_handoff in Step 4.

   3d. DECOMPOSITION PATH:
   - Do NOT invoke Team-Leader MODE 1. Do NOT produce tasks.md.
   - From plan.md, identify 2–5 scoped subtasks. Each subtask must:
     * Target exactly one concern or layer
     * Have complexity Simple or Medium (never Complex)
     * Have a title scoped to that concern (e.g., "Add parent_task_id column to schema")
     * List only the files it touches in fileScope
     * Declare dependencies on other subtasks within this parent
       (e.g., subtask 2 depends on subtask 1 if it builds on subtask 1's output)
     * Have a suggested model matching its complexity:
       Simple → "glm-5.1", Medium → "claude-sonnet-4-6"
   - Call bulk_create_subtasks(parent_task_id="TASK_YYYY_NNN", subtasks=[...])
     with all subtasks at once. Capture the returned subtask IDs.
   - If bulk_create_subtasks fails, log the error, fall back to NO DECOMPOSITION
     (Step 3c — invoke Team-Leader MODE 1 and produce tasks.md instead).
   - Set decomposed = true and subtask_ids = [returned IDs] for write_handoff in Step 4.
```

#### Change: Update Step 4 (write_handoff call)

Current Step 4a:
```
a. Call write_handoff(task_id="TASK_YYYY_NNN", worker_type="prep",
   files_to_touch=[...], batches=[...], key_decisions=[...],
   implementation_plan_summary="...", gotchas=[...]).
```

New Step 4a — add two new fields when decomposed:
```
a. Call write_handoff(task_id="TASK_YYYY_NNN", worker_type="prep",
   files_to_touch=[...],
   batches=["DECOMPOSED — see subtasks: TASK_YYYY_NNN.1, TASK_YYYY_NNN.2, ..."]
     (or the normal batch list if not decomposed),
   key_decisions=[...],
   implementation_plan_summary="...",
   gotchas=[...],
   notes="DECOMPOSED: subtask_ids=[TASK_YYYY_NNN.1, TASK_YYYY_NNN.2, ...]"
     (omit this field if not decomposed)).
```

Note: `write_handoff` does not have a dedicated `decomposed` boolean field — use the `notes` field (or `implementation_plan_summary` addendum) to carry the decomposition signal. The Supervisor reads `read_handoff` and checks for this marker.

#### Change: Update Step 5 Exit Gate

Add new exit gate check for decomposed path:
```
5. EXIT GATE — Before exiting, verify:
   - [ ] plan.md exists with implementation approach
   - [ ] IF decomposed: bulk_create_subtasks succeeded and at least 1 subtask exists
         (verify via get_task_context("TASK_YYYY_NNN.1") or equivalent)
   - [ ] IF NOT decomposed: tasks.md exists with at least 1 batch (all PENDING)
   - [ ] read_handoff("TASK_YYYY_NNN", worker_type="prep") returns a non-empty record
   - [ ] Planning artifacts are committed (plan.md, task-description.md, and
         tasks.md if produced)
   - [ ] get_task_context("TASK_YYYY_NNN") shows status PREPPED
```

#### Change: Update Retry Prep Worker Prompt (Step 3 resume logic)

Current Step 3 (retry prompt):
```
3. Check the task folder for existing deliverables:
   - task-description.md exists? -> PM phase already done
   - plan.md exists? -> Architecture already done
   - tasks.md exists? -> Team Leader MODE 1 already done
   - read_handoff(...) returns data? -> Prep handoff already done
```

New Step 3 (retry prompt) — add decomposition check:
```
3. Check the task folder and DB for existing deliverables:
   - task-description.md exists? -> PM phase already done
   - plan.md exists? -> Architecture already done
   - tasks.md exists? -> Team Leader MODE 1 already done (no decomposition)
   - read_handoff(...) notes contains "DECOMPOSED"? -> Decomposition already done
   - get_task_context("TASK_YYYY_NNN.1") succeeds? -> Subtasks already created
   - read_handoff(...) returns full data? -> Prep handoff already done
   Resume from the earliest incomplete step.
```

---

### File 2: `.claude/skills/nitro-auto-pilot/references/parallel-mode.md`

#### Change 1: Step 3 (Build Dependency View) — Add Subtask Classification

After the existing classification list (lines 82–96), add:

```
**Subtask-aware classification**:
- A task whose `id` matches `^TASK_\d{4}_\d{3}\.\d+$` is a subtask.
  Subtasks follow the same state machine as top-level tasks (CREATED → PREPPED or
  CREATED → IMPLEMENTED depending on worker_mode).
- A parent task at PREPPED with subtasks in the DB is treated as
  READY_FOR_IMPLEMENT only if NO subtasks exist for it. If subtasks exist,
  classify the parent as DECOMPOSED_PARENT — do not spawn an Implement Worker
  for it. The parent progresses when all its subtasks reach COMPLETE (see Step 4).
```

#### Change 2: Step 4 (Select Spawn Candidates) — Subtask Routing

After the priority strategy description, add a new subsection:

```
**Decomposed Parent Handling**:

Before populating implement_candidates, for each task classified as PREPPED:
1. Call get_task_context(task_id) (or read from cached get_tasks result).
2. Check whether the handoff notes contain "DECOMPOSED".
   - If YES: this parent has subtasks. Do NOT add it to implement_candidates.
     Instead, identify its subtasks (IDs matching TASK_YYYY_NNN.M pattern, or
     returned by get_subtasks(parent_task_id) if that tool is available).
     Add each CREATED subtask (with all intra-parent deps satisfied) to
     build_candidates or implement_candidates based on its own worker_mode.
   - If NO: add to implement_candidates as before — spawn one Implement Worker.

**Subtask completion → parent auto-promotion**:
When all subtasks of a parent reach COMPLETE:
1. Call update_task(parent_task_id, fields=JSON.stringify({status: "IMPLEMENTED"}))
   so the parent enters the review queue normally.
2. Emit a log_event: PARENT_AUTO_PROMOTED — parent=TASK_YYYY_NNN, subtasks=[...].
3. The parent then becomes READY_FOR_REVIEW in the next Step 3 pass.
```

#### Change 3: Step 7 (Handle Completions) — Subtask Completion Detection

After item 4 (line 211), add:

```
4b. For subtask completions (task_id matches TASK_YYYY_NNN.M pattern):
    After recording the subtask completion, call get_parent_status_rollup(parent_task_id)
    to check whether all sibling subtasks are now COMPLETE.
    If all siblings are COMPLETE and parent is still PREPPED:
    apply Subtask completion → parent auto-promotion (see Step 4 Decomposed Parent Handling).
```

#### Change 4: Worker-Exit Reconciliation Table

Add a subtask row to the Expected-state mapping table:

```
| Subtask Build/Implement Worker | IN_PROGRESS or IMPLEMENTING | IMPLEMENTED |
```

And add a note:
```
**Subtask reconciliation**: After reconciling a subtask, call get_parent_status_rollup
to check whether this subtask's completion finishes the parent's decomposition.
Apply parent auto-promotion if all siblings are COMPLETE.
```

---

### File 3: `.claude/agents/nitro-team-leader.md`

The nitro-team-leader agent is invoked by Build Workers and Implement Workers — not by Prep Workers in decomposition mode (the Prep Worker bypasses Team-Leader MODE 1 when decomposing). Therefore, **no changes are required to nitro-team-leader.md for the core decomposition flow**.

However, one clarification note should be added to the agent's MODE 1 section to avoid confusion:

After the "Trigger" line in MODE 1:
```
**Note**: This mode is bypassed when the Prep Worker decomposes a Complex (or eligible Medium)
task into subtasks via bulk_create_subtasks. In that case, each subtask becomes an independent
task with its own Prep/Build Worker — MODE 1 runs within each subtask's worker, not the parent.
```

---

## Batching Strategy

### Batch 1: Prep Worker Prompt — Decomposition Analysis (worker-prompts.md)

- Modify Step 3 of First-Run Prep Worker Prompt — add decomposition decision tree
- Modify Step 4a write_handoff call — add `notes` field with DECOMPOSED marker
- Modify Step 5 Exit Gate — add decomposed/non-decomposed conditional checks
- Modify Retry Prep Worker Prompt Step 3 — add decomposition resume detection

**Files**: `.claude/skills/nitro-auto-pilot/references/worker-prompts.md`
**Why together**: All Prep Worker prompt changes are in one file and logically form one coherent unit — the decomposition feature as seen from the worker side.

### Batch 2: Supervisor Loop — Decomposed Task Routing (parallel-mode.md)

- Step 3: Add subtask ID pattern recognition and DECOMPOSED_PARENT classification
- Step 4: Add decomposed parent handling + subtask candidate routing + parent auto-promotion on all-subtasks-COMPLETE
- Step 7: Add subtask completion detection hook → trigger parent auto-promotion
- Worker-Exit Reconciliation table: Add subtask row + post-reconciliation rollup check

**Files**: `.claude/skills/nitro-auto-pilot/references/parallel-mode.md`
**Why together**: All changes live in one file and form one coherent unit — the Supervisor's subtask-aware scheduling logic. These changes are dependent on each other (Step 7 references Step 4 auto-promotion logic).

### Batch 3: Team-Leader Clarification Note (nitro-team-leader.md)

- Add one-sentence note to MODE 1 Trigger clarifying that decomposed tasks bypass MODE 1

**Files**: `.claude/agents/nitro-team-leader.md`
**Why separate**: Minimal change. Can be done independently of Batches 1 and 2. Low risk of conflict.

---

## Integration Architecture

### Data Flow — Decomposed Task

```
Supervisor detects CREATED task (Complex/Medium)
  → spawns Prep Worker
  → Prep Worker: PM → Architect → plan.md
  → Decomposition Analysis: Complex or multi-concern Medium?
      YES → bulk_create_subtasks → subtask IDs returned
           → write_handoff(notes="DECOMPOSED: subtask_ids=[...]")
           → update_task(PREPPED)
      NO  → Team-Leader MODE 1 → tasks.md
           → write_handoff (standard)
           → update_task(PREPPED)

Supervisor next tick: parent at PREPPED
  → read_handoff: notes contains "DECOMPOSED"?
      YES → skip Implement Worker for parent
           → find CREATED subtasks → add to build_candidates
           → spawn Build/Prep Workers for each subtask (respecting concurrency)
      NO  → spawn one Implement Worker for parent (existing behavior)

Subtask workers execute independently
  → each subtask: CREATED → IMPLEMENTED → COMPLETE (own review cycle)
  → on each subtask COMPLETE: get_parent_status_rollup
      all siblings COMPLETE? → update_task(parent, IMPLEMENTED)
      → parent enters review queue → Review+Fix Worker → COMPLETE
```

### Dependency Handling

- Intra-parent subtask dependencies (subtask 2 depends on subtask 1) are expressed as standard `dependencies` fields in the subtask DB records
- The Supervisor's existing dependency graph logic in Step 3 handles these naturally — subtask 2 is BLOCKED until subtask 1 is COMPLETE
- No special-casing needed beyond the DECOMPOSED_PARENT classification

### Fallback Strategy

- If `bulk_create_subtasks` fails during Prep Worker execution: fall back to NO DECOMPOSITION (run Team-Leader MODE 1, produce tasks.md, proceed as single Implement Worker)
- This fallback is stated explicitly in the Prep Worker prompt Step 3d
- The Supervisor never sees a partial decomposition — either the handoff says DECOMPOSED (and subtasks exist) or it doesn't (and tasks.md exists)

---

## Quality Requirements

### Non-Functional Requirements

- **Backward compatibility of task state machine**: No new status values. PREPPED still means PREPPED. The decomposition signal travels through the handoff `notes` field, not task status.
- **Simple tasks unchanged**: The decomposition decision tree must explicitly gate on complexity. Simple tasks must not be affected by any code path change.
- **Supervisor loop stays thin**: The DECOMPOSED_PARENT check in Step 4 must use the cached `get_tasks()` result plus a `read_handoff()` call — no additional file reads inside the loop.
- **Subtask IDs are opaque to the Supervisor**: The Supervisor identifies subtasks by the `TASK_YYYY_NNN.M` ID pattern, not by reading task folders.
- **Fallback must be atomic**: A failed `bulk_create_subtasks` must leave zero partial state. The tool's behavior (from TASK_2026_263 handoff) shows it does not auto-commit — if it errors mid-way, the Prep Worker re-runs Team-Leader MODE 1 cleanly.

---

## Files Affected Summary

| File | Action | Scope of Change |
|------|--------|-----------------|
| `.claude/skills/nitro-auto-pilot/references/worker-prompts.md` | MODIFY | First-Run Prep Worker Steps 3, 4a, 5; Retry Prep Worker Step 3 |
| `.claude/skills/nitro-auto-pilot/references/parallel-mode.md` | MODIFY | Steps 3, 4, 7; Worker-Exit Reconciliation table |
| `.claude/agents/nitro-team-leader.md` | MODIFY | One clarification note in MODE 1 Trigger |

---

## Developer Type Recommendation

**Recommended Developer**: nitro-systems-developer
**Rationale**: All changes are to orchestration prompt specifications and Supervisor loop documentation — no application code. This is a pure systems/orchestration task.

## Complexity Assessment

**Complexity**: Medium
**Estimated Effort**: 2–3 hours

The changes are textual (prompt/doc edits to markdown files) but require precise logic — the decomposition decision tree, the Supervisor routing change, and the parent auto-promotion are each small but must interlock correctly. The biggest risk is the read_handoff notes-field check in the Supervisor loop — this must be resilient to the notes field being absent (non-decomposed tasks).

---

## Architecture Delivery Checklist

- [x] All components specified with evidence (file:line citations from worker-prompts.md and parallel-mode.md)
- [x] All patterns verified from codebase (existing Prep Worker flow, Supervisor Step 3/4/7 structure)
- [x] MCP tool schema verified (bulk_create_tasks live schema inspected; bulk_create_subtasks confirmed from TASK_2026_263 handoff)
- [x] No new task status required — DECOMPOSED signal carried in handoff notes
- [x] Fallback strategy defined (failed bulk_create_subtasks → fall back to tasks.md path)
- [x] Parent auto-promotion specified (all subtasks COMPLETE → parent moves to IMPLEMENTED)
- [x] Intra-parent dependency handling confirmed (standard dependencies field, existing Step 3 graph handles it)
- [x] Simple tasks unaffected — explicit gate in decomposition decision tree
- [x] Retry Prep Worker updated — resume detection includes decomposition state
- [x] Worker-Exit Reconciliation updated for subtask workers
- [x] Files affected list complete
- [x] Developer type recommended (nitro-systems-developer)
- [x] Complexity assessed (Medium, 2–3 hours)
- [x] No step-by-step implementation — architectural specification only
