# Code Logic Review — TASK_2026_241

## Summary

| Metric              | Value                                                  |
|---------------------|--------------------------------------------------------|
| Overall Score       | 5/10                                                   |
| Assessment          | NEEDS_REVISION                                         |
| Critical Issues     | 2                                                      |
| Serious Issues      | 3                                                      |
| Moderate Issues     | 3                                                      |
| Failure Modes Found | 6                                                      |

This task adds a reconciliation protocol to `parallel-mode.md` and a matching summary line
to `SKILL.md`. The happy-path logic is sound and the intent is correct. However, the
implementation has two structural defects that will cause an agent following the steps
literally to either double-call `update_task` or skip `release_task` in the RECONCILE_OK
path, plus a broken forward reference (`steps 5–7`) that points into the wrong numbered
sequence. These are not cosmetic: this is a behavior spec that an LLM agent executes
mechanically. Broken step numbers and duplicate instructions produce wrong behavior at
runtime.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The RECONCILE_OK path says "continue with steps 5–7 of the preferred path." Steps 5–7 of
the preferred path are the outer numbered items that come AFTER the subsection — items 5
(`release_task`), 6 (`update session DB`), and 7 (`re-evaluate dependents`). An agent that
reads this literally skips `release_task` for the RECONCILE_OK case entirely because in the
RECONCILE_OK branch no claim-release call is issued before the "continue" redirect. The
claim held by the exited worker is therefore never released, silently leaving the task
claimed by a dead worker forever. On the next tick `claim_task` will fail for that task,
causing it to be skipped or blocked.

### 2. What user action causes unexpected behavior?

When two workers for the same task exit in the same tick — a real scenario when a GLM
implement worker exits and the supervisor immediately retries before the next `list_workers`
call — the Duplicate Spawn Guard only checks `status: 'running'`. It explicitly says "do NOT
skip" for `stopped`/`exited` workers. A supervisor agent will therefore spawn a second worker
for the same task even though reconciliation already advanced it to IMPLEMENTED in the same
tick. This is the exact duplicate-spawn bug this task was written to prevent.

### 3. What data makes this produce wrong results?

A Build Worker in single-mode has pre-exit task state `IN_PROGRESS`. The expected-state
mapping table says `IN_PROGRESS → IMPLEMENTED`. But the `IMPLEMENTING` state (used by split
Implement Workers) is NOT `IN_PROGRESS`. If the DB state is `IMPLEMENTING` when the
Build Worker exits (which can happen if a previous reconciliation run partially advanced
the state), the mapping table has no row for `Build Worker | IMPLEMENTING`. The supervisor
finds no matching row, falls through with no action, and the task remains stale. There is
no explicit fallback for unmapped state combinations.

### 4. What happens when dependencies fail?

The reconciliation steps call `update_task` twice in the DISCREPANCY path: once inline in
step 4 (the action rule block applies `update_task` directly for each worker type) and then
again in step 5 (`Call update_task with the resolved status`). A supervisor agent executing
step 4 will call `update_task`, then reach step 5 and call `update_task` again with the
same status. This is a redundant double-call. If the MCP tool is not idempotent for the
same status value, this can leave an extra event in the DB event log or trigger a state
machine guard depending on the cortex implementation. At minimum it is wasted context.

### 5. What's missing that the requirements didn't mention?

The reconciliation protocol covers the normal-tick path (event-driven loop detects exit).
It does NOT cover the compaction-recovery path. After a compaction, the supervisor calls
`list_workers(compact: true)` and finds workers that exited during the compaction window.
No reconciliation trigger is documented for that startup path, meaning tasks that silently
transitioned (or failed to transition) during compaction are never reconciled. This was the
original bug vector (GLM worker exiting without updating state) and it can still happen
across a compaction boundary.

---

## Failure Mode Analysis

### Failure Mode 1: Stale Claim on RECONCILE_OK Path

- **Trigger**: Worker exits, task state already matches expected (RECONCILE_OK), supervisor
  follows "continue with steps 5–7." Steps 5–7 include `release_task()` — but the supervisor
  did NOT call it before the redirect.
- **Symptoms**: Task claim held by dead worker ID. Next tick `claim_task` fails. Task stuck
  in perpetual "claimed" limbo. No error surfaced — the task just never gets picked up again.
- **Impact**: Silent permanent stall of the task. Depends on whether `release_orphaned_claims`
  runs at next session start. In the same session, the task is effectively dead.
- **Current Handling**: None. The RECONCILE_OK branch has no `release_task` call.
- **Recommendation**: Insert an explicit `release_task(task_id)` step in the RECONCILE_OK
  branch before the redirect to steps 5–7, OR clarify that "steps 5–7" begin from the outer
  list's item 5 which already contains `release_task` — and verify that redirection covers
  the RECONCILE_OK case explicitly (it currently says "release or update as required by the
  implementation," which is ambiguous for the OK case).

### Failure Mode 2: Double `update_task` on DISCREPANCY Path

- **Trigger**: Supervisor reaches reconciliation step 4 (DISCREPANCY branch), calls
  `update_task` inline in the action rule, then continues to step 5 which calls `update_task`
  again.
- **Symptoms**: Two MCP calls for the same state transition. Depending on cortex
  implementation: duplicate event in DB, spurious status-already-set error, or wasted
  context. On idempotent implementations: silent wasteful double-call.
- **Impact**: Serious — adds unnecessary MCP roundtrip on every discrepancy, corrupts event
  history if cortex records all transitions, and makes the protocol harder for agents to
  follow because the step numbering implies both calls are needed.
- **Current Handling**: Step 4 performs the update inline; step 5 repeats it.
- **Recommendation**: Remove the inline `update_task` calls from step 4 action rules and
  keep them only in step 5. Step 4 should set a local decision variable (`resolved_status`)
  without calling MCP. Step 5 executes the single MCP call.

### Failure Mode 3: Broken Forward Reference "steps 5–7"

- **Trigger**: Agent executing the RECONCILE_OK path reads "continue with steps 5–7 of the
  preferred path." The preferred path's step list (items 1–4) ends at item 4. The next
  numbered items (5, 6, 7) appear AFTER the subsection block and refer to outer Step 7
  completion actions (`release_task`, `update session DB`, `re-evaluate dependents`).
- **Symptoms**: Ambiguous referent. An agent may interpret "steps 5–7" as the reconciliation
  subsection's own items 5–7 (which cover DISCREPANCY, not OK). Alternatively it may
  correctly find the outer items but those items are structurally separated from items 1–4
  by the entire `### Worker-Exit Reconciliation` subsection and the `#### Duplicate Spawn
  Guard` subsection and the event schema block and a large NOTE block — making a literal
  parse very difficult.
- **Impact**: Agent may execute the wrong steps or skip critical cleanup on OK path.
- **Current Handling**: None. The handoff.md acknowledges this as a known risk but calls it
  only a readability concern. It is an execution-correctness concern.
- **Recommendation**: Replace "continue with steps 5–7 of the preferred path" with explicit
  inline steps (e.g., "call `release_task(task_id)`, then proceed as normal completion").
  Do not rely on step-number references across subsection boundaries.

### Failure Mode 4: Duplicate Spawn Guard Does Not Account for Same-Tick Reconciliation

- **Trigger**: A worker exits and reconciliation advances the task to IMPLEMENTED in tick N.
  In the same tick, the duplicate spawn guard checks `status: 'running'` only. The task's
  worker is now `stopped` (guard says "do NOT skip"). The guard sends it to reconciliation
  again even though reconciliation already ran.
- **Symptoms**: Reconciliation executes twice for the same task in the same tick. Second pass
  calls `get_task_context` and finds the state already advanced. If the logic is RECONCILE_OK
  for the second pass, it emits a second `RECONCILE_OK` event and attempts to `release_task`
  again on an already-released claim.
- **Impact**: Double-release of claim (likely harmless but produces noise). Double `RECONCILE_OK`
  event. If cortex returns a "not claimed" error on second `release_task`, the supervisor
  loop will not crash but the error path is not documented.
- **Current Handling**: Guard only prevents duplicate spawns for running workers. No guard
  against re-entering reconciliation for the same task in the same tick.
- **Recommendation**: After reconciliation completes for a task_id in a given tick, mark it
  as "reconciled this tick" in session state to prevent re-entry.

### Failure Mode 5: Compaction-Recovery Gap

- **Trigger**: Compaction occurs while a GLM implement worker is running. Worker exits during
  compaction (no event emitted). After recovery, supervisor calls `list_workers` and finds
  the worker in `stopped` state. But compaction-recovery steps (Step 1, Compaction survival
  path) say: call `list_workers`, call `get_tasks`, call `get_session`. There is no reconciliation
  pass after compaction recovery.
- **Symptoms**: Task remains in IMPLEMENTING state indefinitely. No retry. Original bug.
- **Impact**: This is the exact production defect that triggered this task (SESSION_2026-03-31T04-03-16).
  The reconciliation protocol as written only applies during the steady-state loop (Step 6/7).
  It does not apply after compaction recovery.
- **Current Handling**: Not addressed.
- **Recommendation**: Add a reconciliation sweep step to the compaction-recovery path in
  Step 1: after `list_workers` returns, check each stopped/exited worker against the
  expected-state mapping before entering the normal loop tick.

### Failure Mode 6: Unmapped State Combination Silently Falls Through

- **Trigger**: Expected-state mapping table has four rows. A worker exits with a task in
  a state not listed in the `Pre-Exit Task State` column (e.g., `BLOCKED`, `CREATED`,
  or an intermediate state created by a previous partial reconciliation). No row matches.
- **Symptoms**: No action taken. Task stays in whatever stale state it was in. No event
  emitted. No error logged.
- **Current Handling**: Not addressed. Table has no default/fallback row.
- **Recommendation**: Add an explicit fallback: "If no row matches, emit a `RECONCILE_UNKNOWN`
  event with actual state, worker type, and worker_id. Do not modify task state. Alert if
  escalate_to_user is true."

---

## Critical Issues

### Issue 1: RECONCILE_OK Path Missing `release_task` Call

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Line**: 247–250
- **Scenario**: Worker exits, task was already advanced by the worker itself (state matches
  expected). Supervisor takes RECONCILE_OK path and jumps to "steps 5–7." The outer list's
  step 5 says "`release_task()` / `update_task()` as required." The phrase "as required" is
  ambiguous — agents may interpret this as "only if not already done," and since the worker
  already transitioned state, no `update_task` is needed, so the step may be skipped
  entirely including the `release_task`. Result: claim never released.
- **Evidence**: Reconciliation step 3 bullet says "Proceed as if the completion event was
  received — continue with steps 5–7 of the preferred path." The outer step 5 reads
  "Release or update the task through MCP (`release_task()` / `update_task()`) as required
  by the implementation." The word "required" gives an agent discretion to skip.
- **Fix**: Make `release_task(task_id)` unconditional on the RECONCILE_OK path. Either add
  it as an explicit sub-bullet in step 3 of reconciliation, or rewrite outer step 5 to say
  "Always call `release_task(task_id)`. Call `update_task` only if reconciliation required
  a state change (DISCREPANCY path)."

### Issue 2: Double `update_task` in DISCREPANCY Path

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 252–258 (step 4 action rules) and 258 (step 5)
- **Scenario**: Any DISCREPANCY case (worker exits without advancing state). Step 4 action
  rules each call `update_task` inline. Step 5 then calls `update_task` again with "the
  resolved status determined in step 4." An agent following steps literally makes two MCP
  calls for the same transition.
- **Evidence**: Step 4, Prep Worker branch: `update_task(task_id, fields=JSON.stringify({status: "FAILED"}))`.
  Step 5: `Call update_task(task_id, fields=JSON.stringify({status: "<resolved_status>"}))`.
  Both are imperative instructions.
- **Fix**: Remove the MCP call from step 4 action rules. Step 4 should only determine
  `resolved_status`. Step 5 should be the single location that executes `update_task`.

---

## Serious Issues

### Issue 3: "Steps 5–7" Cross-Subsection Forward Reference Is Not Parseable

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Line**: 250
- **Scenario**: RECONCILE_OK path tells the agent to "continue with steps 5–7 of the
  preferred path." The preferred path's numbering (items 1–4) is interrupted by the entire
  reconciliation subsection, the Duplicate Spawn Guard sub-subsection, the JSON schema
  block, and a large NOTE block before items 5–11 appear. An agent following this spec
  cannot reliably locate the correct target steps without extensive context scanning.
- **Fix**: Either inline the three actions ("call `release_task`, update session DB, re-evaluate
  dependents") explicitly in the RECONCILE_OK branch, or use named section references
  ("see Step 7 outer items 5–7") with an anchor comment. Do not rely on naked step-number
  references across deeply nested subsection boundaries.

### Issue 4: Duplicate Spawn Guard Placed Under Step 7, Referenced from Step 5

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 179 (Step 5, item 6 forward reference) and 262–268 (guard definition)
- **Scenario**: SKILL.md Step 5 item 6 says "See Step 7 Worker-Exit Reconciliation for the
  duplicate spawn guard." A supervisor agent loading the guard at spawn time (Step 5) must
  jump ahead to a Step 7 subsection to read it. The guard definition is under Step 7 but
  the enforcement point is Step 5. This creates the same "two authoritative locations"
  anti-pattern flagged in `review-general.md`. An agent may read the guard only when it
  reaches Step 7 (after spawn), defeating its purpose.
- **Fix**: Move the duplicate spawn guard to a subsection under Step 5 (before the spawn
  loop), OR duplicate the guard check as a numbered sub-step in Step 5 with a note that
  the full definition is in Step 7.

### Issue 5: Compaction-Recovery Path Has No Reconciliation Sweep

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 49–55 (Step 1, Compaction survival path)
- **Scenario**: A worker exits during compaction. After recovery, supervisor re-queries
  `list_workers` and finds stopped workers. The Step 1 compaction-recovery path says:
  `list_workers` → `get_tasks` → `get_session` → resume loop. No reconciliation trigger
  is defined for workers found in `stopped` state at recovery time. The original bug
  (GLM implement worker exits during session, task stays IMPLEMENTING) is reproduced
  exactly on any compaction boundary.
- **Fix**: Add a step to the compaction-recovery path: "For each worker returned by
  `list_workers` with status `stopped` or `exited`, apply Worker-Exit Reconciliation
  before resuming the normal loop tick."

---

## Moderate Issues

### Issue 6: RECONCILE_OK Event Missing from SKILL.md Per-Phase Output Budget

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Lines**: 55–64 (Per-Phase Output Budget table)
- **Scenario**: The reconciliation protocol emits `RECONCILE_OK` and `RECONCILE_DISCREPANCY`
  events. The Per-Phase Output Budget table in SKILL.md does not list these event types.
  An agent consulting the output budget during reconciliation will find no matching row and
  either print a full debug block (violating the one-line rule) or print nothing (losing
  observability).
- **Fix**: Add two rows to the Per-Phase Output Budget table:
  `RECONCILE_OK` → one-line format (e.g., `RECONCILE_OK task=<task_id> worker=<worker_id>`),
  `RECONCILE_DISCREPANCY` → one-line format (e.g., `RECONCILE_DISCREPANCY task=<task_id> action=<action>`).

### Issue 7: `RECONCILE_OK` Event Schema Defined Nowhere

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 270–283 (event schema block)
- **Scenario**: The `RECONCILE_DISCREPANCY` event has a full JSON schema. `RECONCILE_OK`
  only has a prose description ("emit an info-level `RECONCILE_OK` event"). An agent
  will invent a schema for `RECONCILE_OK` and it will differ from what the event log
  consumer expects. If `log-templates.md` defines event schemas, that file should be
  updated too — but it is not in scope for this task.
- **Fix**: Add a JSON schema block for `RECONCILE_OK` alongside `RECONCILE_DISCREPANCY`.
  Minimum fields: `event`, `task_id`, `worker_id`, `worker_type`, `actual_state`.

### Issue 8: Duplicate Step Number `4.` in Preferred Path

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 224–225
- **Scenario**: The Step 7 preferred path has two items both numbered `4.`:
  - `4. For a Review/Fix completion, accept the event...`
  - `4. If the loop is reconciling a worker without an event, call get_task_context...`
  The second item 4 (line 225) belongs to the reconciliation branch and is the "trigger"
  instruction but it is numbered identically to the previous event-driven item.
  Markdown renderers collapse these; agents following the list will see two step 4s and
  may execute them out of order, or may skip the reconciliation trigger entirely since
  it is semantically attached to item 2's inline instruction ("apply Worker-Exit Reconciliation
  — see subsection below").
- **Fix**: Renumber the second item 4 as item 5 and shift subsequent outer items accordingly,
  or remove the duplicate entirely since item 2's inline trigger already covers it.

---

## Data Flow Analysis

```
Worker exits (stopped/exited in list_workers)
       |
       v
get_pending_events() ── event found? ──YES──> Normal completion path (items 1-4)
       |                                         → item 5: release_task  ✓
       NO                                        → item 6: update session DB  ✓
       |                                         → item 7: re-evaluate dependents  ✓
       v
get_task_context(task_id)
       |
       v
Compare actual vs expected state
       |
   MATCHES?
  /         \
YES           NO
 |             |
RECONCILE_OK  RECONCILE_DISCREPANCY
 |             |
 |      Step 4 action rules call update_task ← BUG: premature MCP call
 |             |
 |      Step 5 calls update_task again ← BUG: double call
 |             |
 |      Step 6: release_task ✓
 |
 v
"continue with steps 5–7" ← BUG: ambiguous cross-subsection reference
       |
  release_task? ← UNCLEAR: "as required" gives agent discretion to skip
       |
  update session DB ✓
       |
  re-evaluate dependents ✓
```

Gap points:
1. RECONCILE_OK: `release_task` is conditional/ambiguous — claim may leak.
2. DISCREPANCY: `update_task` called twice — double MCP call.
3. Compaction recovery: no reconciliation sweep for stopped workers found at startup.
4. Unmapped state combinations: no fallback action defined.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| AC1: Supervisor reconciles after worker exit regardless of worker calling update_task | COMPLETE | Trigger condition and reconciliation steps present |
| AC2: Supervisor advances or marks FAILED — never leaves stale | PARTIAL | RECONCILE_OK path may leave task claimed but not released; compaction-recovery gap means stale state survives across compaction |
| AC3: Discrepancy logged as event | PARTIAL | RECONCILE_DISCREPANCY has schema; RECONCILE_OK has no schema — agent will invent one |
| AC4: No duplicate workers due to false retries | PARTIAL | Guard covers running workers but not same-tick re-entry after reconciliation; compaction gap not covered |
| AC5: Behavior documented in parallel-mode.md worker completion section | COMPLETE | Subsection present and covers main cases |

### Implicit Requirements NOT Addressed

1. Reconciliation on compaction recovery — the original observed failure vector.
2. Unconditional `release_task` in RECONCILE_OK path — implicit in "proceed as normal completion."
3. Same-tick idempotency — reconciliation re-entry guard for tasks processed in the same tick.
4. Unknown/unmapped pre-exit state handling — no defined behavior for a worker that exits with a task in an unexpected state.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Worker killed by OOM/signal | YES | Trigger condition: exit detected via `list_workers` regardless of exit cause | None |
| Worker exits, no event, task already advanced | YES | RECONCILE_OK path | `release_task` may be skipped |
| Worker exits during compaction window | NO | Not covered | Original bug survives across compaction |
| Two workers for same task exit in same tick | PARTIAL | Guard blocks new spawns for running workers | No same-tick re-entry guard for reconciliation |
| Task in unmapped state when worker exits | NO | No fallback row | Silent no-op, task stays stale |
| `get_task_context` returns null/error | NO | Not documented | Agent has no defined behavior |
| `release_task` fails (claim already released) | NO | Not documented | No error path defined |
| `handoff.md` exists but is empty/corrupt | NO | Not documented | Auto-advance to IMPLEMENTED may be incorrect |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| `get_task_context` during reconciliation | MED | Task state unknown, no action | Not documented; needs explicit error path |
| `update_task` double-call (DISCREPANCY) | HIGH (always) | Extra MCP roundtrip, possible duplicate event | Fix by removing inline call from step 4 |
| `release_task` on already-released claim | MED | Error from cortex; agent has no handler | Not documented |
| `claim_task` on next tick for un-released task | HIGH if claim leaked | Task permanently skipped in session | `release_orphaned_claims` at next session start is last resort, not in-session fix |

---

## Verdict

| Verdict | FAIL |
|---------|------|
| Code Logic | FAIL |

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The RECONCILE_OK path does not unconditionally release the claim, and the
"steps 5–7" forward reference is ambiguous enough that agents will skip it or misinterpret
it. Combined with the double `update_task` call in the DISCREPANCY path, the three structural
defects mean the protocol will produce wrong behavior on its most common execution paths,
not just edge cases. The compaction-recovery gap is a separate serious issue because it
is the exact scenario that motivated this task.

**What Robust Implementation Would Include**:
- Inline explicit steps in RECONCILE_OK branch (no cross-subsection forward references)
- Single `update_task` call point (step 4 decides, step 5 acts — never both)
- Unconditional `release_task` in both OK and DISCREPANCY paths
- Reconciliation sweep in the compaction-recovery path (Step 1)
- Fallback row in expected-state mapping for unmapped combinations
- `RECONCILE_OK` event schema alongside `RECONCILE_DISCREPANCY` schema
- Same-tick idempotency guard to prevent re-entry
- Error handling for `get_task_context` returning null during reconciliation
