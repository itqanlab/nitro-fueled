# Code Logic Review — TASK_2026_045

## Score: 6/10

## Acceptance Criteria Coverage

| Criterion | Met? | Notes |
|-----------|------|-------|
| Planner scans all CREATED tasks for sizing violations on `/plan` and `/plan status` | YES | Section 3e is invoked from both 3a (Step 3) and 3b (Step 7) |
| Oversized tasks reported with specific violations (which limits exceeded) | YES | Summary table in Step 8a shows exact limit and value exceeded |
| Planner proposes split into subtasks when oversized tasks are found | YES | Step 8b requires a concrete split proposal |
| Split proposals wait for Product Owner approval | YES | Step 8c is explicit |
| Uses `sizing-rules.md` for rules when available, inline fallback otherwise | PARTIAL | Step 4 loads from file if it exists, fallback table is present — but the fallback limits are only a subset of what `sizing-rules.md` defines (see Findings) |
| No noise when all tasks are properly sized | YES | Steps 2 and 7 explicitly stop silently when clean |

## Summary

The happy path is correct: CREATED tasks are collected, each `task.md` is read, limits are checked dimension by dimension, violations are surfaced in a table, a split is proposed, and approval is gated before any write. The noise-suppression behavior is well specified. However, the inline fallback limits are a strict subset of `sizing-rules.md` — the fourth dimension ("Complexity Complex + multiple architectural layers") is silently dropped in the fallback, creating a detection gap. Two additional logic gaps exist: there is no explicit handling for a missing or unreadable `task.md` file (partial CREATED task folder), and the algorithm's definition of "Acceptance Criteria count" is ambiguous enough that two implementations of the same rule will produce different counts.

---

## Findings

### BLOCKING

**B1 — Fallback limits are a strict subset of `sizing-rules.md`, creating a silent detection gap**

`sizing-rules.md` defines four hard limit dimensions:

1. Files created or significantly modified — max 7
2. Requirements / acceptance criteria groups — max 5
3. Task description length — ~150 lines
4. Complexity "Complex" + multiple architectural layers — Split required

The inline fallback table in Section 3e lists only the first three. The fourth dimension is absent. When `sizing-rules.md` does not exist, a CREATED task that hits Dimension 4 will pass the sizing review silently. This is a direct violation of the task's requirement "Uses `sizing-rules.md` for rules when available, inline fallback otherwise" — a correct fallback must be equivalent, not a truncated copy.

Additionally, the fallback table labels Dimension 1 as "Files in File Scope section" while `sizing-rules.md` labels it "Files created or significantly modified." These are semantically different: a file that is modified but not listed in the `task.md` File Scope section (e.g., a file discovered mid-implementation) would not be caught by the fallback wording but would be caught by `sizing-rules.md`. This divergence is exactly the "partial delegation" anti-pattern documented in `review-general.md`:

> "Delegating to a single source of truth means removing the duplicate, not adding a summary — when a file changes from inline rules to referencing an external canonical doc, any summary list left behind becomes a second copy that will drift."

The fallback is a necessary exception to that rule (the file may not exist), but it must be complete and use identical wording to the source of truth to prevent divergence.

Fix: add the fourth dimension to the fallback table and align Dimension 1 wording with `sizing-rules.md`.

---

**B2 — No handling for a missing `task.md` inside a CREATED task folder**

Step 3 reads `task-tracking/TASK_YYYY_NNN/task.md` for each CREATED task. Section 9 (Interrupted Session Recovery) documents that this is a real scenario: a task folder can exist without valid contents after an interrupted session. If `task.md` is absent or unreadable, Step 5's dimension checks have no data to operate on. The algorithm does not specify what to do in this case.

Two failure modes result from this gap:
- If the agent throws on a missing file, the entire sizing review halts and subsequent tasks are not checked.
- If the agent silently skips the unreadable task, a partially-created task is invisible to the review, which can mask a task that later causes a worker to die.

Fix: add an explicit branch between Steps 3 and 4: "If `task.md` cannot be read, report the task as unreadable in the violations table and continue to the next task."

---

### SERIOUS

**S1 — "Acceptance Criteria" count definition is ambiguous**

Step 5 instructs: "count top-level criteria items/groups." The `task.md` format uses a checklist style:

```
- [ ] Criterion A
- [ ] Criterion B
  - [ ] Sub-criterion B1
```

"Top-level items/groups" is underspecified. Does a criterion with sub-items count as 1 (the group) or as 1 + N (the group plus its children)? `sizing-rules.md` uses the term "Requirements / acceptance criteria groups" without defining what constitutes a group boundary. An agent counting groups will likely produce a different result than one counting individual checklist lines. This ambiguity makes the limit non-deterministic across agent invocations.

Fix: define the counting rule precisely. The simplest correct rule: count lines in the Acceptance Criteria section that start with `- [ ]` and are not indented (top-level items only). This matches how humans read "groups."

---

**S2 — The 3b (Status Mode) invocation position is late and may bury violations**

In Section 3b, the Backlog Sizing Review is Step 7 (the last step), and the instruction is to "append any violations to the status report." By the time violations are shown, the Product Owner has already read the full status summary. If the status report is long (multiple phases, many tasks), violations at the end are easy to miss or skip.

Section 3a correctly front-loads the sizing review at Step 3, before any new planning work, and blocks progression if violations are found. Section 3b does neither — it appends silently at the end and does not block any action.

For status mode, an oversized CREATED task is not less dangerous than it is in planning mode. The same task will still enter a worker session and cause a mid-implementation failure regardless of which mode discovered it.

Fix: either move the sizing review to an earlier step in 3b (e.g., Step 2, immediately after reading the registry), or add a note that violations in status mode should be flagged prominently at the top of the report, not appended at the bottom.

---

**S3 — "Cancel or remove the oversized original" on approval is underspecified**

Step 8d says: "On approval: create the replacement tasks (using Section 4 rules), update the registry, and cancel or remove the oversized original."

"Cancel or remove" is ambiguous:
- Cancel implies setting the task status to CANCELLED in the registry and leaving the folder intact (standard lifecycle behavior).
- Remove implies deleting the task folder and registry row.

These have different implications for traceability. If the oversized task was referenced in `plan.md`, removing it would create a dangling reference. The existing status machine (CREATED -> ... -> CANCELLED) supports cancellation. Deletion is a destructive action that bypasses the state machine.

Fix: replace "cancel or remove" with "update the oversized task's status to CANCELLED in the registry and remove it from the active phase in `plan.md`." The folder should be preserved for traceability. Reference Section 4e for registry update mechanics.

---

### MINOR

**M1 — The 3a invocation language says "resolve violations before continuing" but does not define "resolve"**

Section 3a Step 3: "If violations are found, resolve them with the Product Owner before continuing with new planning work."

"Resolve" could mean: (a) split and create replacement tasks (full resolution), or (b) the Product Owner acknowledges and overrides (Step 8e). The override path is a valid resolution by the algorithm's own rules — the Product Owner has explicitly accepted the risk. The instruction should be: "If violations are found, handle them per Section 3e (including override acceptance) before continuing."

---

**M2 — No definition of what "section" means for Description length counting**

Step 5 says "count lines in the Description section." `task.md` uses a `## Description` heading. The algorithm does not specify whether the heading line itself counts, whether blank lines count, or where the section ends (at the next `##` heading). This is a minor edge case but two independent implementations will disagree on the boundary.

Fix: add "count all non-blank content lines between the `## Description` heading and the next `##` heading."

---

**M3 — "Run this step on every /plan and /plan status invocation" duplicates the call-out in 3a and 3b**

The opening paragraph of Section 3e says it is "called explicitly from Sections 3a and 3b." This is correct. But the "Run this step on every /plan..." language at the top of 3e could be misread as meaning it auto-runs for all modes including 3c (Reprioritize) and 3d (Onboarding), which do not invoke it. The instruction is redundant with the explicit call-outs and slightly misleading about the invocation contract.

Fix: replace the opening statement with "This section is invoked explicitly by Sections 3a and 3b. It does not run automatically."

---

## The 5 Paranoid Questions

**1. How does this fail silently?**

If `sizing-rules.md` is absent and a task violates only Dimension 4 ("Complexity Complex + multiple architectural layers"), the fallback table does not cover that dimension. The review passes with no output, the task enters a worker session, and the worker dies mid-implementation. No warning was ever produced.

**2. What user action causes unexpected behavior?**

A Product Owner runs `/plan status` on a project with three CREATED oversized tasks. The status report is three pages long. The violations are appended at the bottom (Step 7 is the last step). The Product Owner reads the summary, sees "Phase 1: 60% complete," closes the report, and tells the Supervisor to proceed. The oversized tasks are never noticed.

**3. What data makes this produce wrong results?**

A `task.md` file that uses nested acceptance criteria checklist items. The agent counts "top-level items/groups" but the spec does not define the counting rule precisely. A task with 4 top-level items each having 2 sub-items might be counted as 4 (under limit) by one invocation and 12 (over limit) by another. The check is non-deterministic on this input shape.

**4. What happens when dependencies fail?**

If `task.md` does not exist for a CREATED task (interrupted session, manual registry edit), the read in Step 3 fails. The algorithm has no recovery branch. Either the review halts entirely (blocking all subsequent tasks from being checked) or the unreadable task is silently skipped (invisible to the review).

**5. What's missing that the requirements didn't mention?**

The task.md requirement says "scan all CREATED tasks." It does not address tasks in BLOCKED status. A task that is BLOCKED but was originally oversized will never be caught — it was CREATED at some point, but if it was manually transitioned to BLOCKED before the Planner ever ran, it will be permanently invisible to the sizing review. This is a narrow edge case but not impossible given the "manually edited files" scenario the task description calls out as a motivation for this feature.

---

## Verdict: NEEDS_FIXES

The core algorithm is sound and the acceptance criteria are largely met. Two blocking issues must be addressed before this is production-safe:

1. The inline fallback limits must include all four dimensions from `sizing-rules.md` with aligned wording (B1).
2. Missing `task.md` handling must be added to the algorithm (B2).

The serious issues (S2: late reporting in status mode, S3: ambiguous "cancel or remove") are strong recommendations that should be fixed in the same pass since they are small wording changes, not structural rewrites.
