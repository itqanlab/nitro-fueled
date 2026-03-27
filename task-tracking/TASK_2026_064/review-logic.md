# Logic Review — TASK_2026_064

## Score: 7/10

## Verdict: PASS_WITH_NOTES

## Acceptance Criteria Status

- [x] `registry.md` has `Priority` and `Dependencies` columns; all non-terminal task rows are backfilled with correct values
- [x] Supervisor Step 2 reads only `registry.md` at startup — no per-task `task.md` reads
- [x] Dependency graph is correctly built from registry `Dependencies` column alone
- [x] Step 2b quality validation defers `task.md` read to just before spawn (not upfront for all tasks)
- [x] `/create-task` Step 5 writes Priority and Dependencies to the registry row format reference
- [x] Existing behavior is unchanged: dependency resolution, wave planning, quality validation all work as before

---

## Findings

### BLOCKING (must fix)

None. No blocking issues found.

---

### MINOR (should fix)

**1. `[.claude/skills/auto-pilot/SKILL.md:34]` — Primary Responsibilities summary is stale**

The "Primary Responsibilities" section at line 34 still reads:

```
1. **Read registry + task.md files** -- build the dependency graph
```

This directly contradicts the implementation in Step 2, which now reads only the registry at startup and defers `task.md` reads to Step 5-jit. A new Supervisor reading this summary before diving into the steps would form a wrong mental model of the startup cost and may misapply the spec when troubleshooting. Should read: `1. **Read registry** -- build the dependency graph (task.md read just-in-time at spawn)`.

---

**2. `[.claude/skills/auto-pilot/SKILL.md:478-491]` — Step 3c (File Scope Overlap Detection) still reads `task.md` at startup for IMPLEMENTED tasks**

Step 3c says: "Extract File Scope from each task's File Scope section." File Scope lives in `task.md`, not in the registry. For any task with status IMPLEMENTED that reaches Step 3c, the supervisor must read `task.md` to get the File Scope. This is a per-task `task.md` read that happens at startup (before any spawn), for all IMPLEMENTED tasks simultaneously.

The task description states the goal as "startup reads only the registry — one file read." Step 3c violates that goal for IMPLEMENTED tasks. The task acceptance criteria says "Supervisor Step 2 reads only `registry.md` at startup," which technically is true (Step 3c is a different step), but the broader intent of eliminating upfront bulk `task.md` reads is not fully achieved. On a backlog with 5 IMPLEMENTED tasks all waiting for review, the supervisor still does 5 `task.md` reads before spawning anything.

This is a pre-existing behavior (Step 3c was not introduced by this task), but the task did not acknowledge it and the "no per-task task.md reads" intent is incomplete. Should be noted or addressed: either add File Scope as a registry column too, or document the known residual upfront read in Step 3c explicitly as intentional.

---

**3. `[task-tracking/registry.md:54,59,60,64,68,71]` — `None` sentinel in Dependencies column is not handled by the Step 3 parser spec**

Several rows use the literal string `None` in the Dependencies column (e.g., TASK_2026_054, TASK_2026_055, TASK_2026_059, TASK_2026_063, TASK_2026_066). The `/create-task.md` Step 5 note documents this as the canonical form: `"Dependencies: comma-separated Task IDs (e.g., TASK_2026_052, TASK_2026_051), or None"`.

Step 3 of SKILL.md says: "parse the **Dependencies** field into a list of task IDs." It does not explicitly state that the value `None` (or `—`) is a sentinel meaning "empty list." A naive parser that splits on `,` and trims whitespace would produce `["None"]` — which Step 3 would then try to look up in the registry and not find, producing a spurious "TASK_X blocked: dependency TASK_None not found in registry" log entry and potentially writing BLOCKED to the status file.

The legacy-row fallback (Step 2.4) handles the case of the column being entirely absent, but does not handle the case where the column is present with value `None`. This is an unspecified edge case that the parser spec should explicitly address: "treat `None` or `—` as an empty dependency list."

---

**4. `[task-tracking/registry.md:52-53]` — Two terminal rows are missing `Model` values**

Lines for TASK_2026_047 and TASK_2026_048 are missing the Model column value entirely (the row ends at the Created date with no trailing `|` and no model value):

```
| TASK_2026_047 | COMPLETE    | ...  | 2026-03-27 |
| TASK_2026_048 | COMPLETE    | ...  | 2026-03-27 |
```

These are terminal (COMPLETE) rows, so the missing value has no runtime impact. However, the `—` sentinel is documented as the canonical value for terminal rows in both the `create-task.md` note and the existing pattern throughout the file. This is a cosmetic inconsistency that will confuse any tooling that regenerates the registry by parsing existing rows as column-count templates.

---

### SUGGESTIONS (optional)

**5. `[task-tracking/registry.md]` — Dependency ordering for TASK_2026_041 differs from task.md**

The registry row for TASK_2026_041 lists dependencies as `TASK_2026_023, TASK_2026_034, TASK_2026_026`. The task.md lists them in the order 023, 034, 026. This is an exact match — no issue. Noted only because the reviewer checked it.

**6. `[.claude/skills/auto-pilot/SKILL.md:2b note]` — The "Pre-flight note" is helpful but subtly misleading**

The note in Step 2b says "tasks added mid-session would not have been pre-flighted." This is accurate but implies the JIT gate is solely a mid-session safety net. In practice it is also the primary quality gate for the very first session run if the user skips pre-flight (e.g., using `--limit` or single-task mode). A minor clarification to "tasks added mid-session, or tasks in sessions where pre-flight was not run" would avoid misreading.

**7. `[.claude/skills/auto-pilot/SKILL.md:411-413]` — Legacy-row fallback silently treats P0-Critical tasks as P2-Medium**

If a legacy registry row exists for a P0-Critical task (one that existed before this task's columns were added), the fallback demotes it to P2-Medium without any indication to the operator that a critical task is being deprioritized. The warning log is present (`[warn] registry row missing Priority/Dependencies`) but the severity of the consequence (a critical task moved to medium priority) is not surfaced. Consider logging at a higher severity level or marking the task as BLOCKED pending manual backfill rather than silently deprioritizing it.

---

## Backfill Accuracy Cross-Check

Cross-checked all 14 non-terminal task rows in the registry against their `task.md` metadata tables and Dependencies sections. All Priority values and dependency lists match exactly:

| Task ID       | Registry Priority | task.md Priority | Registry Dependencies                                   | task.md Dependencies match? |
|---------------|-------------------|------------------|---------------------------------------------------------|-----------------------------|
| TASK_2026_039 | P2-Medium         | P2-Medium        | 023, 035, 036, 037                                      | Yes                         |
| TASK_2026_040 | P2-Medium         | P2-Medium        | 023                                                     | Yes                         |
| TASK_2026_041 | P2-Medium         | P2-Medium        | 023, 034, 026                                           | Yes                         |
| TASK_2026_050 | P0-Critical       | P0-Critical      | 052, 051                                                | Yes                         |
| TASK_2026_053 | P1-High           | P1-High          | 051                                                     | Yes                         |
| TASK_2026_054 | P2-Medium         | P2-Medium        | None                                                    | Yes                         |
| TASK_2026_055 | P1-High           | P1-High          | None                                                    | Yes                         |
| TASK_2026_056 | P1-High           | P1-High          | 055                                                     | Yes                         |
| TASK_2026_057 | P1-High           | P1-High          | 055, 056                                                | Yes                         |
| TASK_2026_059 | P1-High           | P1-High          | None                                                    | Yes                         |
| TASK_2026_062 | P1-High           | P1-High          | 061                                                     | Yes                         |
| TASK_2026_063 | P1-High           | P1-High          | None                                                    | Yes                         |
| TASK_2026_064 | P2-Medium         | P2-Medium        | 060                                                     | Yes                         |
| TASK_2026_066 | P1-High           | P1-High          | None                                                    | Yes                         |

Backfill is correct across all rows. No mismatches found.

---

## Scaffold Consistency

`diff .claude/skills/auto-pilot/SKILL.md packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` — identical (no output).

`diff .claude/commands/create-task.md packages/cli/scaffold/.claude/commands/create-task.md` — identical (no output).

Scaffold files are in sync.

---

## The 5 Paranoid Questions

**1. How does this fail silently?**
The `None` sentinel in the Dependencies column (Finding 3) is the primary silent failure path. If the parser does not handle `None` as an empty list, it will look up `TASK_None` in the registry, not find it, and write `BLOCKED` to the dependent task's status file without any obvious indication that the block was caused by a parser bug rather than a real dependency issue. The task would stay BLOCKED indefinitely. The only signal would be a log entry that a careful reader might dismiss as a config error.

**2. What user action causes unexpected behavior?**
A user who adds a new task with `Dependencies: None` (the documented canonical form from `create-task.md`) and then immediately runs `/auto-pilot` will get that task silently blocked if the parser treats `None` as a task ID. This is the current behavior of the `None`-in-column rows already in the registry.

**3. What data makes this produce wrong results?**
Any registry row with `Dependencies: None` as a literal cell value (not an absent column) produces wrong results if the Step 3 parser does not explicitly handle the sentinel. Additionally, any row with `Priority: —` (the terminal-row marker used in COMPLETE/CANCELLED rows) being fed to the fallback path could behave unexpectedly, though Step 2 parses all rows so terminal rows with `—` must also be handled gracefully.

**4. What happens when dependencies fail?**
The dependency resolution logic in Step 3 is sound — missing deps write BLOCKED, cancelled deps write BLOCKED, cycles write BLOCKED. All paths are covered. The only gap is the `None` sentinel ambiguity.

**5. What's missing that the requirements didn't mention?**
Step 3c (File Scope Overlap Detection) was not addressed by this task. It still requires reading `task.md` at startup for all IMPLEMENTED tasks to extract File Scope. The task's stated goal of "registry read only at startup" is partially unmet because IMPLEMENTED tasks still trigger per-task `task.md` reads in Step 3c. This was likely intentional (the task.md says "startup reads only the registry" but the task was scoped to Steps 2 and 2b specifically), but it is an implicit gap that leaves the door open for the same context-window bloat the task was designed to fix — just on the review side instead of the build side.
