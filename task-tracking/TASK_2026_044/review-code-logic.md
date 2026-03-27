# Code Logic Review — TASK_2026_044

## Score: 6/10

## Acceptance Criteria Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Pre-flight runs before supervisor loop, not inside supervisor context | PASS | Step 4 is clearly in the command entry point; SKILL.md Step 2b references it explicitly as pre-flight already having run |
| Dependency graph validated — missing or failed dependencies reported as blocking | PASS | Validation B (4c) covers missing, FAILED, and CANCELLED |
| Circular dependencies detected and reported as blocking | PARTIAL | DFS algorithm described but has a correctness gap — see BLOCKING #1 |
| File scope overlaps detected and logged as warnings | PASS | Validation E (4f) covers this |
| Missing task fields logged as warnings | PASS | Validation A (4b) covers this |
| MCP server health checked before starting | PASS | Already existed in Step 3b; pre-flight correctly does not duplicate it — MCP check remains in Step 3 before Step 4 |
| Oversized tasks flagged using rules from sizing-rules.md | PARTIAL | Inline fallback limits in 4e match sizing-rules.md, but one dimension check is ambiguous — see SERIOUS #1 |
| Blocking issues abort with clear error message | PASS | Step 4h abort path is clear |
| Warnings logged to orchestrator-state.md session log | PARTIAL | Warnings written only on "warnings only" path; if there are both blocking issues AND warnings, the warnings are silently dropped — see BLOCKING #2 |
| Pre-flight report printed to user before supervisor starts | PASS | Step 4g report format defined |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The abort path in Step 4h writes the session log entry and displays the ABORT message, but it does NOT flush the individual warning messages to `orchestrator-state.md`. An agent executing the abort branch sees warnings in the console report (4g) but never persists them. The user re-runs `/auto-pilot` after fixing the blocking issue — now the warnings from the first run are gone with no audit trail.

Additionally, the "no issues at all" path in 4h only calls `log:` (a single line), without specifying whether that log goes to `orchestrator-state.md` or only to console. An agent might interpret this as a console-only print, leaving the state file untouched until the supervisor loop writes it.

### 2. What user action causes unexpected behavior?

- Running `/auto-pilot TASK_YYYY_NNN` (single-task mode) while a sizing violation exists for a *different* CREATED task. Step 4 scans ALL CREATED tasks regardless of single-task mode. The user is presented with warnings for tasks they did not ask to run. The instructions contain no exemption for single-task mode — this is an ambiguity that two agents will resolve differently.
- Running `/auto-pilot --dry-run` hits the same issue. Dry-run is informational, yet pre-flight can abort it.

### 3. What data makes this produce wrong results?

- A task with a circular dependency chain longer than two nodes (e.g., A -> B -> C -> A). The DFS description says "if a task ID appears in the current-path set", which is correct conceptually, but the deduplication instruction ("deduplicate by normalized node set") is ambiguous for multi-node cycles. The normalized set `{A,B,C}` would correctly deduplicate, but an agent may generate multiple partial sub-cycle reports (A->B->C->A, B->C->A->B, C->A->B->C) before deduplication is applied, resulting in the wrong number being reported in 4g.
- A task.md that has the Description section spanning many lines but contains zero sentence-ending punctuation (e.g., a bulleted list with no periods). The 4b sentence count rule ("count sentence-ending punctuation followed by whitespace/newline") would produce 0 sentences and flag the warning even though the description is substantive. Legitimate task.mds with bullet-heavy descriptions will generate spurious warnings.
- The "Complexity + multiple layers" dimension in Validation D counts occurrences of specific keywords in the description ("service, layer, architecture, integration, pipeline"). A task description that uses those words naturally (e.g., "this task has no integration concerns") will trip the heuristic.

### 4. What happens when dependencies fail?

- If `sizing-rules.md` is missing, the fallback inline limits in 4e are used. That is correctly handled.
- If `task-tracking/registry.md` is corrupted or partially readable (e.g., a row with a malformed status), Validation B's logic ("if the dependency has status FAILED") would silently pass for the malformed row because the status doesn't equal "FAILED" — it just doesn't match any check. This means a task with a corrupted dependency row gets no blocking issue and proceeds. No defensive check for unrecognized statuses is specified.
- Validation B checks for FAILED and CANCELLED as blocking. It does NOT check for BLOCKED. A CREATED task depending on a BLOCKED task will not be flagged as a blocking issue — it will silently be picked up by the supervisor, which will then block it at runtime instead. This is a gap between the pre-flight spec and the task description's intent ("All task dependencies are satisfiable").

### 5. What's missing that the requirements didn't mention?

- No exemption for single-task mode or dry-run mode in the pre-flight scope. Both modes should arguably only pre-flight the tasks they will actually touch.
- No specification of what happens when `orchestrator-state.md` already exists with `Loop Status: RUNNING` at the time pre-flight runs. Pre-flight writes to or appends to `orchestrator-state.md` in both abort and proceed paths, but there is no instruction about whether to initialize a fresh session header vs. append to the existing one.
- No timeout or "give up" behavior if reading a large number of task.md files takes long. For a backlog of 50+ tasks, this is a real performance concern for an AI agent doing sequential file reads.
- Circular dependency detection builds a graph of ALL tasks "regardless of status" (4d), but Validation B only covers CREATED and IMPLEMENTED tasks. A cycle that runs through COMPLETE tasks is harmless at runtime but will still be reported as a blocking issue, causing a false-positive abort.

---

## Findings

### BLOCKING

**BLOCKING #1 — Circular dependency detection will false-positive on cycles through COMPLETE tasks**

- File: `auto-pilot.md` — Step 4d
- The instruction says "Build a full dependency graph of ALL tasks (regardless of status)." A cycle involving only COMPLETE or CANCELLED tasks is operationally harmless — all nodes in the cycle are already done. Because 4d builds the graph without filtering, a historical cycle (e.g., two old COMPLETE tasks that were mistakenly linked) will permanently abort every future `/auto-pilot` run. The user has no way to proceed short of manually editing old task files.
- Fix: Exclude COMPLETE and CANCELLED tasks from the cycle detection graph. Cycles are only dangerous if they involve tasks that still need to execute.

**BLOCKING #2 — Warnings are silently dropped on the abort path**

- File: `auto-pilot.md` — Step 4h, abort branch
- The abort branch writes one log line (`PRE-FLIGHT FAILED — N blocking issue(s)`) but never persists the individual warning messages. The "warnings only" branch explicitly writes one entry per warning (`[HH:MM:SS] PRE-FLIGHT WARNING — {warning_message}`). An abort that also has warnings loses those warnings entirely from the persistent log.
- Fix: In the abort branch, write the individual warning log entries before writing the ABORTED status line.

**BLOCKING #3 — BLOCKED dependency status is not treated as a blocking issue**

- File: `auto-pilot.md` — Step 4c
- Validation B only blocks on FAILED and CANCELLED dependency statuses. A CREATED task whose dependency is BLOCKED will pass pre-flight but will immediately be blocked again at runtime. The AC states "missing or failed dependencies reported as blocking error" — BLOCKED is operationally equivalent to FAILED for this purpose.
- Fix: Add BLOCKED to the list of dependency statuses that produce a blocking issue in 4c.

---

### SERIOUS

**SERIOUS #1 — "Complexity + multiple architectural layers" dimension has no reliable measurement rule**

- File: `auto-pilot.md` — Step 4e
- The rule is: `Complexity field is "Complex" AND description contains ≥2 of: service, layer, architecture, integration, pipeline`. These are common English words. Any moderately well-written task description touching infrastructure will trip this. The result is noise — agents will see this warning constantly and begin ignoring it (or users will). If it fires on every third task, it adds no signal.
- The `sizing-rules.md` file itself only says "Complexity 'Complex' + multiple architectural layers — Split required" without defining the keyword list. The keyword list was invented inline in 4e and is not sourced from `sizing-rules.md`.
- Fix: Either remove the keyword heuristic and replace it with a human-judgment note, or source the definition from `sizing-rules.md` rather than inventing it in the command.

**SERIOUS #2 — Pre-flight scope is not mode-aware**

- File: `auto-pilot.md` — Step 4 (introduction paragraph)
- "Validates CREATED and IMPLEMENTED tasks before any workers are spawned." In single-task mode (`/auto-pilot TASK_YYYY_NNN`), this means a user is shown warnings about a dozen unrelated tasks when they only want to process one. Worse, a blocking issue in an unrelated task aborts the single-task run.
- Fix: When in single-task mode, restrict pre-flight scope to the specified task and its transitive dependencies. Warn about out-of-scope issues but do not let them block a targeted single-task run.

**SERIOUS #3 — No initialization instruction for orchestrator-state.md before writing**

- File: `auto-pilot.md` — Step 4h
- The abort branch says "Write or append to `task-tracking/orchestrator-state.md`". The proceed branch says "Initialize or append". Neither specifies the condition for initialize vs. append, nor what the initialized file structure looks like. Two agents will produce different file formats, breaking the session log assumptions in SKILL.md (which expects a `## Session Log` section and a `Loop Status:` field).
- Fix: Add explicit instruction: "If `orchestrator-state.md` does not exist, create it with a `## Session Log` section header and `Loop Status: PENDING`. If it exists, append to the existing `## Session Log` section."

---

### MINOR

**MINOR #1 — Sentence counting heuristic produces false positives on bullet-heavy descriptions**

- File: `auto-pilot.md` — Step 4b
- Counting "sentence-ending punctuation followed by whitespace/newline" fails on descriptions that use bullet lists with no trailing punctuation. These are legitimate descriptions but will be warned as "too short". The SKILL.md Step 2b has a simpler rule ("at least 2 sentences") with no mechanistic definition — the inconsistency means a task that passes SKILL.md Step 2b may still warn in 4b.
- Fix: Align both rules, or change 4b to "at least 20 words" which is more robust to formatting style.

**MINOR #2 — "Dry-run" path through pre-flight is undefined**

- File: `auto-pilot.md` — Step 4, Step 6
- In dry-run mode, the user expects a read-only execution plan. Pre-flight in Step 4 will write to `orchestrator-state.md` (in the warning and abort paths) even in dry-run mode. This is a side effect that violates user expectations for a `--dry-run` flag.
- Fix: In dry-run mode, print the pre-flight report but do not write to `orchestrator-state.md`.

**MINOR #3 — SKILL.md session log event table and auto-pilot.md 4h are inconsistent on format**

- File: `SKILL.md` — Session Log table vs `auto-pilot.md` Step 4h
- SKILL.md lists `PRE-FLIGHT PASSED — {no issues found | N warning(s)}` as the log format. Step 4h "no issues at all" branch only says `log: [HH:MM:SS] PRE-FLIGHT PASSED — no issues found`. The "warnings only" proceed branch uses `PRE-FLIGHT PASSED — {N} warning(s)`. These are consistent with the SKILL.md table. However, the "no issues" branch instruction uses informal `log:` phrasing without specifying the destination — an agent may treat this as a console print only.
- Fix: Change to "Write to `orchestrator-state.md` session log: `[HH:MM:SS] PRE-FLIGHT PASSED — no issues found`" to match the phrasing of the other branches.

**MINOR #4 — sizing-rules.md consumer list is informational only**

- File: `sizing-rules.md` — line 3
- `/auto-pilot` was added to the consumer list (the task's stated change to this file). This is correct bookkeeping. No logic concern, noting for completeness.

---

## Summary

The core happy path is solid: pre-flight runs before the supervisor, reports are printed, warnings are persisted, and blocking issues abort cleanly. The implementation satisfies 8 of 10 acceptance criteria at the surface level.

Three blocking logic gaps exist. The most dangerous is the false-positive cycle detection (BLOCKING #1) — a project with any historical task cycle in COMPLETE tasks will be permanently unable to run `/auto-pilot` without manual file surgery. The second is that BLOCKED dependencies are not treated as blocking issues despite being operationally equivalent to FAILED (BLOCKING #3). The third is warning loss on the abort path (BLOCKING #2) which quietly degrades the audit trail.

The two serious issues (mode-awareness and state file initialization) will cause inconsistent agent behavior across different invocation patterns.

The implementation is a reasonable first draft that needs the three blocking issues addressed before it is reliable in production.
