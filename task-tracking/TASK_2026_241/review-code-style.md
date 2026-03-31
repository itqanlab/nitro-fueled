# Code Style Review — TASK_2026_241

## Summary

Two documentation files were modified to introduce the Worker-Exit Reconciliation subsection
and Duplicate Spawn Guard in `parallel-mode.md`, and to align `SKILL.md`'s Step 7 summary line
and Key Principles list with the new behaviour. The writing is broadly clear and follows the
existing imperative style, but there are four structural and consistency problems — one blocking,
two serious, and one minor — that must be resolved before the task is COMPLETE.

---

## Findings

### [FINDING-1] Duplicate step numbers in Step 7 preferred path

- **Severity**: blocking
- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Line**: 224–225
- **Issue**: Step 7's preferred-path numbered list contains two items labelled `4.`:

  ```
  4. For a Review/Fix completion, accept the event as the authoritative signal that the task reached `COMPLETE`.
  4. If the loop is reconciling a worker without an event, call `get_task_context(task_id)` for single-task status checks.
  ```

  This is not a formatting nit. A Supervisor reading this during execution will stop at the first
  `4.` and may never process the second. Duplicate list item numbers break the sequential mental
  model the whole document is built on.
- **Suggestion**: Renumber so the second `4.` becomes `5.`. Adjust any internal cross-references
  ("continue with steps 5–7 of the preferred path" at line 250) to remain consistent after the
  renumbering.

---

### [FINDING-2] Dangling numbered list items after the blockquote interrupt

- **Severity**: serious
- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 285–292
- **Issue**: The `RECONCILE_DISCREPANCY` event schema JSON block (line 272) is immediately
  followed by a blockquote warning (line 285). After that blockquote, the file continues with a
  numbered list starting at `5.`:

  ```
  > **NEVER call `get_tasks(status: "COMPLETE")`** ...
  5. Release or update the task through MCP ...
  6. Update the session DB record ...
  ```

  These items (`5.`–`11.`) belong to the **Step 7 preferred path** that started at line 219, not
  to the Worker-Exit Reconciliation subsection. The blockquote and the JSON block create a visual
  break that makes it appear the numbered list is a new, orphaned sequence. A reader landing on
  line 286 has no context for what these items are numbered relative to.

  Additionally, the `RECONCILE_DISCREPANCY` event schema block and the blockquote warning are
  physically placed *inside* the Worker-Exit Reconciliation subsection body, but items 5–11 resume
  the outer Step 7 flow. The structural nesting is wrong: the subsection starts at the `###`
  heading (line 227) and contains content that belongs to the parent section.
- **Suggestion**: Move items 5–11 to appear *before* the `### Worker-Exit Reconciliation`
  subsection, so the Step 7 preferred path is complete and contiguous. Then place the subsection
  (trigger condition, mapping table, reconciliation steps, duplicate spawn guard, event schema,
  blockquote) after the Step 7 preferred path closes. The Step 7 preferred path should end with
  a pointer: "For workers that exited without emitting a state-change event, see Worker-Exit
  Reconciliation below."

---

### [FINDING-3] Reconciliation steps 4 and 5 describe the same `update_task` call twice

- **Severity**: serious
- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Lines**: 251–258
- **Issue**: Step 4 of the reconciliation procedure says "Apply the action rule for the worker
  type" and inline shows the `update_task(...)` call for each case. Step 5 then says "Call
  `update_task(task_id, fields=JSON.stringify({status: "<resolved_status>"}))` with the resolved
  status determined in step 4."

  This is contradictory: step 4 already performs the write, so step 5 would execute `update_task`
  a second time with a placeholder template string `<resolved_status>`. A Supervisor following
  these steps literally would call `update_task` twice, potentially with a malformed status value
  on the second call.
- **Suggestion**: Either:
  - Make step 4 determine the resolved status (a decision step only, no MCP call), and make
    step 5 the single authoritative call that executes `update_task`, or
  - Remove step 5 entirely and accept that step 4 already performed the update.

  The first option is cleaner because it preserves the decision/action separation pattern used
  elsewhere in the document.

---

### [FINDING-4] `RECONCILE_OK` event path reference is imprecise

- **Severity**: minor
- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Line**: 250
- **Issue**: The RECONCILE_OK branch says "continue with steps 5–7 of the preferred path." After
  the renumbering required by FINDING-1, those step numbers will shift. More fundamentally, the
  phrase "preferred path" is ambiguous here because the reconciliation subsection does not
  distinguish between preferred and fallback paths the way the outer steps do.
- **Suggestion**: After resolving FINDING-1, update the reference to match the final numbers.
  Replace the vague "steps 5–7 of the preferred path" with a concrete description: "Proceed to
  release the task claim (`release_task()`) and re-evaluate dependents on the next tick — the
  same post-completion bookkeeping as a normal completion event."

---

## Verdict

| Verdict | Result |
|---------|--------|
| Code Style | FAIL |

**Reason**: FINDING-1 (duplicate step numbers) is blocking because it directly corrupts the
sequential instruction set that the Supervisor executes. FINDING-2 (structural nesting break) and
FINDING-3 (duplicate `update_task` call) are serious because they produce contradictory or
ambiguous instructions that a Supervisor agent will resolve unpredictably. All three must be fixed
before this task is COMPLETE.
