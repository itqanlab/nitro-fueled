# Development Tasks — TASK_2026_241

## Batch 1: Reconciliation Protocol — parallel-mode.md — PENDING

**Developer**: nitro-systems-developer

### Task 1.1: Add worker-exit reconciliation sub-protocol to Step 7

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
**Status**: PENDING

Add a new subsection under **Step 7: Handle Completions** (preferred path) titled
`### Worker-Exit Reconciliation (Supervisor-Authoritative State)`.

The subsection must include:

1. **Trigger condition** — three-condition AND check (worker stopped, no TASK_STATE_CHANGE event, task still active)
2. **Expected-state mapping table** — 4 worker types × pre-exit states × expected post-exit state
3. **Reconciliation steps** (numbered 1–7):
   - `get_task_context` → compare actual vs. expected
   - RECONCILE_OK branch
   - RECONCILE_DISCREPANCY branch with action rules per worker type:
     - Prep Worker → mark FAILED
     - Build/Implement Worker → check handoff.md → auto-advance IMPLEMENTED or mark FAILED
     - Review/Fix Worker → mark FAILED
   - `update_task` call with resolved status
   - `release_task` call
   - Next-tick re-evaluation note
4. **Duplicate spawn guard** subsection — pre-spawn check in Step 5 referencing this Step 7 protocol
5. **RECONCILE_DISCREPANCY event schema** (JSON block)

Insert the duplicate spawn guard note as a cross-reference from Step 5 as well (add a forward-reference sentence at the end of Step 5 preferred path item 6: "See Step 7 Worker-Exit Reconciliation for the duplicate spawn guard").

### Task 1.2: Add info-level RECONCILE_OK event to Step 7 preferred path

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
**Status**: PENDING

At the end of Step 7 preferred path item 3 (currently: `For a Prep Worker completion, accept the event as the authoritative signal...`), add a note: "If no state-change event is present for an exited worker, apply Worker-Exit Reconciliation — see subsection below."

This keeps the existing event-driven path intact while connecting it to the new fallback.

---

## Batch 2: SKILL.md Key Principles + Core Loop Summary Update — PENDING

**Developer**: nitro-systems-developer

### Task 2.1: Add Key Principle 14 to SKILL.md

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: PENDING

In the **Key Principles** section (currently ends at item 13), add:

> **14. Supervisor is authoritative for task state on worker exit** — after detecting a worker process exit without a matching state-change event, the Supervisor reconciles the expected vs. actual task state and acts (advance or mark FAILED). Workers are untrusted for state transitions on abnormal exit; the Supervisor is the single source of truth.

### Task 2.2: Update Core Loop Step 7 summary in SKILL.md

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: PENDING

In the **Core Loop** section, the Step 7 entry currently reads:
> `7. Handle completions: react to DB events, then re-query the DB for the next tick`

Update to:
> `7. Handle completions: react to DB events; reconcile task state for any worker that exits without emitting a state-change event (advance or mark FAILED); re-query the DB for the next tick`
