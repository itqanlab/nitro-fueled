# Implementation Plan — TASK_2026_036

## Summary

Add a Test Lead to the orchestration pipeline that runs in parallel with the Review Lead after a task reaches IMPLEMENTED. The Test Lead follows the same Lead→sub-worker pattern established in TASK_2026_035: it spawns parallel Unit Test Writer and Integration Test Writer sub-workers via MCP, executes the test suite after writers complete, and writes `test-report.md` to the task folder. The auto-pilot Supervisor is updated to spawn both the Review Lead and the Test Lead simultaneously, wait for both to complete, and then proceed to fix/completion.

---

## File Scope

**CREATE**

- `.claude/agents/test-lead.md`
- `.claude/agents/unit-tester.md`
- `.claude/agents/integration-tester.md`

**MODIFY**

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/orchestration/SKILL.md`
- `task-tracking/task-template.md`

---

## Architecture Notes

### Design decisions

**Test Lead as a Lead, not a tester.** Like `review-lead.md`, the Test Lead is a lightweight orchestrator. It does not write tests itself — it spawns focused sub-workers that each handle one test type. The Test Lead's own intelligence is limited to: framework detection, test type decision, sub-worker spawning, monitoring, test execution, and report writing.

**Parallel with Review Lead, not sequential.** The Supervisor spawns both Review Lead and Test Lead immediately after IMPLEMENTED is detected. They operate independently — neither reads the other's output. The Supervisor waits for both to finish before deciding on fix/completion.

**State machine impact.** Currently: IMPLEMENTED → IN_REVIEW → COMPLETE. After this task: IMPLEMENTED → IN_REVIEW (Review Lead running, Test Lead running in parallel) → COMPLETE. The state label `IN_REVIEW` is kept unchanged — adding a new state would require broader changes. The Test Lead runs silently alongside the Review Lead. Its completion is tracked via the `test-report.md` artifact, not a registry state.

**Test Lead does not update registry state.** The Review Lead owns the state transition from IN_REVIEW to COMPLETE. The Test Lead writes `test-report.md` and exits. The Supervisor detects Test Lead completion by checking for the existence of `test-report.md` (or `exit-gate-failure.md`) before proceeding past the review phase.

**Graceful skip for non-testable task types.** For CREATIVE (with no detected framework) and DOCUMENTATION task types, or when `Testing: skip` is set in task.md, the Test Lead writes a brief `test-report.md` noting "no tests required" and exits immediately without spawning sub-workers.

**Model routing.** Mirrors the Review Lead's routing rationale:
- Unit Test Writer: `claude-sonnet-4-6` — template-driven, pattern-matching, no deep reasoning required
- Integration Test Writer: `claude-opus-4-5` — cross-boundary interactions require deep understanding of system contracts
- E2E Test Writer (conditional): `claude-sonnet-4-6` — template-driven, Playwright/Cypress patterns

**No new worker type for the Supervisor state table.** The active workers table adds `"TestLead"` as a worker_type value alongside `"ReviewLead"`, mirroring the naming convention already established in auto-pilot SKILL.md line 483.

---

## Batch Plan

### Batch 1: New Agent Files

**Files to create:**
- `.claude/agents/test-lead.md`
- `.claude/agents/unit-tester.md`
- `.claude/agents/integration-tester.md`

**Approach:** Model directly after `review-lead.md` — same five-phase structure (context generation, spawn sub-workers, monitor, execute, report). Use the exact same MCP polling pattern (2-minute interval, two-strike stuck detection, minimum viable sub-worker logic). The unit-tester and integration-tester agents are standalone agents invoked via sub-worker spawn — self-contained prompts, no shared state with the Test Lead.

**Developer:** backend-developer (agent markdown files, no code)

**Complexity:** Medium

---

### Batch 2: Skill and Template Updates

**Files to modify:**
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/orchestration/SKILL.md`
- `task-tracking/task-template.md`

**Approach:** Surgical edits to three files. Auto-pilot changes are the most involved (new spawn logic, new state tracking, updated completion condition). Orchestration skill changes are additive only (new test phase section, updated Exit Gate table). Template change is a single metadata row addition.

**Developer:** backend-developer (markdown/prose edits)

**Complexity:** Medium

---

## Test Lead Agent Design

**File:** `.claude/agents/test-lead.md`

**Frontmatter:**
```yaml
---
name: test-lead
description: Test Lead orchestrator — detects test framework, spawns parallel test writer sub-workers via MCP, executes test suite, writes test-report.md
---
```

### Critical operating rules (mirror review-lead.md)

- AUTONOMOUS MODE — no human at this terminal. Do NOT pause for confirmation.
- Do NOT write tests yourself — that is the sub-workers' job.
- Do NOT modify source files — test files only.
- Write the registry update (if any) and `test-report.md` as the FINAL actions before exit.

### Phase 1: Context generation

1. Validate task ID format: confirm `{TASK_ID}` matches `\d{4}_\d{3}`. If not, write `exit-gate-failure.md` and stop.
2. Validate project root: confirm `CLAUDE.md` exists at `{project_root}/CLAUDE.md`. If not, write `exit-gate-failure.md` and stop.
3. Read `task-tracking/TASK_{TASK_ID}/task.md` — extract:
   - **Task Type** (FEATURE | BUGFIX | REFACTORING | CREATIVE | DEVOPS | DOCUMENTATION | RESEARCH)
   - **Testing field** (if present): `required | optional | skip`
   - **File Scope** section
4. Apply **skip decision**:
   - If `Testing: skip` → write brief `test-report.md` noting "no tests required — Testing: skip" and exit.
   - If Type is DOCUMENTATION → write brief `test-report.md` noting "no tests required — DOCUMENTATION task type" and exit.
   - If Type is CREATIVE → proceed to framework detection; skip if no framework found.
5. **Framework detection** — read these files in the project root (read each if it exists):
   - `package.json` → check `devDependencies` and `dependencies` for: `vitest`, `jest`, `@jest/core`, `playwright`, `@playwright/test`, `cypress`
   - `vitest.config.ts` / `vitest.config.js` — confirms Vitest
   - `jest.config.ts` / `jest.config.js` / `jest.config.cjs` — confirms Jest
   - `playwright.config.ts` / `playwright.config.js` — confirms Playwright
   - `cypress.config.ts` / `cypress.config.js` — confirms Cypress
   - `requirements.txt` → check for `pytest`
   - Presence of `go.mod` → Go testing (built-in)
   - Result: list of detected frameworks, or `NONE`
6. If no framework detected and type is CREATIVE → write `test-report.md` noting "no test framework detected — skipping" and exit.
7. If no framework detected for any other task type → write `test-report.md` noting "no test framework detected — recommend setup" and exit.
8. **Test type decision** using the task type matrix:

   | Task Type | Unit Tests | Integration Tests | E2E Tests |
   |-----------|-----------|-------------------|-----------|
   | FEATURE | Yes | If API/DB touched (check File Scope for routes/, db/, queries/) | If UI touched (check File Scope for components/, pages/, views/) |
   | BUGFIX | Yes (regression test) | If API touched | No |
   | REFACTORING | Yes (regression test) | If boundary files in scope | No |
   | CREATIVE | No | No | Optional (only if Playwright/Cypress detected and UI files in scope) |
   | DEVOPS | No | Yes (pipeline/infra test) | No |
   | RESEARCH | No | No | No |

9. Write `task-tracking/TASK_{TASK_ID}/test-context.md`:
   ```markdown
   # Test Context — TASK_{TASK_ID}

   ## Task Info
   - Task ID: {TASK_ID}
   - Task type: {type}
   - Testing override: {Testing field value, or "none"}

   ## Detected Frameworks
   - Primary: {vitest | jest | pytest | go test}
   - E2E: {playwright | cypress | none}

   ## Test Types Required
   - Unit Tests: {yes | no}
   - Integration Tests: {yes | no}
   - E2E Tests: {yes | no}

   ## File Scope
   {File Scope from task.md}

   ## Test Command
   {Detected run command: npm test | npx vitest | npx jest | pytest | go test ./...}
   ```

### Phase 2: Spawn test writer sub-workers

Call MCP `spawn_worker` for each required test type **without waiting between calls** to achieve parallelism. Record all worker IDs.

**Model routing table (hard-coded — not overridable):**

| Writer | Label | Model | Rationale |
|--------|-------|-------|-----------|
| Unit Test Writer | `TASK_{TASK_ID}-TEST-UNIT` | `claude-sonnet-4-6` | Template-driven, pattern-matching, no deep reasoning |
| Integration Test Writer | `TASK_{TASK_ID}-TEST-INTEGRATION` | `claude-opus-4-5` | Cross-boundary interactions require deep understanding |
| E2E Test Writer | `TASK_{TASK_ID}-TEST-E2E` | `claude-sonnet-4-6` | Template-driven, Playwright/Cypress patterns |

**Continuation check before spawning:** If `test-report.md` already exists with a Results section, skip all spawning and proceed to Phase 5 (report is already written from a prior run).

- If `task-tracking/TASK_{TASK_ID}/test-unit-results.md` exists with a Results section → skip Unit Test Writer spawn.
- If `task-tracking/TASK_{TASK_ID}/test-integration-results.md` exists with a Results section → skip Integration Test Writer spawn.
- If `task-tracking/TASK_{TASK_ID}/test-e2e-results.md` exists with a Results section → skip E2E Test Writer spawn.

**On spawn failure for any individual writer:** Log the failure, continue spawning remaining writers, mark failed writer as "skipped". Minimum viable: at least unit test writer must succeed (if unit tests were required). If unit tests are required and unit writer fails, write `exit-gate-failure.md` and exit.

### Phase 3: Monitor and collect

Poll each sub-worker via MCP `get_worker_activity` on a **2-minute interval**.

For each poll cycle:
1. Remove null/empty worker IDs from the polling list.
2. Call `get_worker_activity(worker_id)` for each active worker ID.
3. If health is `finished` → mark that writer as complete.
4. If health is `stuck` on two consecutive checks → call `kill_worker(worker_id)`, mark as failed (no results file expected).
5. If health is `healthy`, `high_context`, or `compacting` → wait for next 2-minute interval.

Continue polling until all sub-workers reach `finished` or `failed` state.

After all sub-workers finish, verify results files exist:
- `task-tracking/TASK_{TASK_ID}/test-unit-results.md` (from Unit Test Writer)
- `task-tracking/TASK_{TASK_ID}/test-integration-results.md` (from Integration Test Writer)
- `task-tracking/TASK_{TASK_ID}/test-e2e-results.md` (from E2E Test Writer, if spawned)

If a results file is missing (sub-worker failed without writing it), log the gap and continue.

### Phase 4: Execute test suite

After all writers complete:
1. Read `test-context.md` to get the test command.
2. Run the test command (e.g., `npm test`, `npx vitest run`, `npx jest`, `pytest`, `go test ./...`).
3. Capture full output (pass/fail/skip counts, error messages).
4. If tests fail:
   - Analyze failures: distinguish between **test bugs** (wrong assertion, wrong mock) and **implementation bugs** (actual code defect).
   - For test bugs: fix the test file directly and re-run once.
   - For implementation bugs: document in `test-report.md` under "Implementation Issues Found" — do NOT attempt to fix source code.
5. If coverage tooling is available (`--coverage` flag, `c8`, `istanbul`), capture coverage delta.
6. If the test command itself is unavailable (no node_modules, no test runner installed), note this in `test-report.md` and skip execution — test files were still written.

### Phase 5: Write test-report.md

Write `task-tracking/TASK_{TASK_ID}/test-report.md`:

```markdown
# Test Report — TASK_{TASK_ID}

## Summary

| Field | Value |
|-------|-------|
| Task ID | {TASK_ID} |
| Task Type | {type} |
| Framework Detected | {framework} |
| Test Types Written | {unit | integration | e2e} |

## Tests Written

| Type | Writer | File(s) | Count |
|------|--------|---------|-------|
| Unit | Unit Test Writer | {file path(s)} | {N} tests |
| Integration | Integration Test Writer | {file path(s)} | {N} tests |
| E2E | E2E Test Writer | {file path(s)} | {N} tests |

## Test Results

| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| Unit | {N} | {N} | {N} |
| Integration | {N} | {N} | {N} |
| E2E | {N} | {N} | {N} |

**Overall: {PASS | FAIL | SKIP}**

## Coverage Delta (if available)

{Coverage output or "Coverage tooling not available"}

## Implementation Issues Found

{List of issues found during test execution that indicate code defects, or "None"}

## Notes

{Any skipped test types with reason, any writer failures, any execution failures}
```

Update `task-tracking/registry.md` only if the Test Lead owns a state transition (it does not in this design — the Review Lead owns COMPLETE). The Test Lead's `test-report.md` is the signal the Supervisor reads.

### Exit Gate

Before exiting, verify:
- [ ] `task-tracking/TASK_{TASK_ID}/test-context.md` exists (or skip was written)
- [ ] `task-tracking/TASK_{TASK_ID}/test-report.md` exists and is non-empty
- [ ] All test files written by sub-workers are committed (`git status` clean for test files)
- [ ] If tests were run: test results are reflected in `test-report.md`

If any check fails and cannot be fixed, write `exit-gate-failure.md` explaining the failure and exit.

---

## Unit Tester Agent Design

**File:** `.claude/agents/unit-tester.md`

**Frontmatter:**
```yaml
---
name: unit-tester
description: Unit Test Writer sub-worker — reads implementation + test context, writes unit tests following project conventions, commits test files
---
```

### Operating rules

- AUTONOMOUS MODE — no human at this terminal. Do NOT pause.
- Write tests only — do NOT modify source files.
- Follow existing test patterns in the codebase exactly (discover with Glob before writing).
- Commit all test files before exiting.

### Steps

1. Read `task-tracking/TASK_{TASK_ID}/test-context.md` — extract framework, file scope, test command.
2. Read `task-tracking/TASK_{TASK_ID}/task.md` — understand what was implemented.
3. Read each file in the File Scope to understand the implementation.
4. Discover existing test patterns:
   - `Glob(**/*.spec.ts)` or `Glob(**/*.test.ts)` — find 2-3 examples
   - Read examples to extract: describe/it structure, assertion style, mocking approach, file naming convention
5. Write unit test files co-located with source files (or in `__tests__/` if that is the established convention).
6. Unit tests cover:
   - All exported functions/methods in changed files
   - Happy path and error cases
   - Edge cases visible from the function signature
   - Regression coverage for bug fixes (test the exact scenario that was broken)
7. Do NOT test implementation details — test public API and observable behavior.
8. Write intermediate results to `task-tracking/TASK_{TASK_ID}/test-unit-results.md`:
   ```markdown
   # Unit Test Results — TASK_{TASK_ID}

   ## Files Written
   - {file path}: {N} tests

   ## Results Section
   Written: {N} unit tests across {N} files
   Status: COMPLETE
   ```
9. Commit: `test(TASK_{TASK_ID}): add unit tests`
10. EXIT.

---

## Integration Tester Agent Design

**File:** `.claude/agents/integration-tester.md`

**Frontmatter:**
```yaml
---
name: integration-tester
description: Integration Test Writer sub-worker — reads implementation + test context, writes integration tests for cross-boundary interactions, commits test files
---
```

### Operating rules

- AUTONOMOUS MODE — no human at this terminal. Do NOT pause.
- Write tests only — do NOT modify source files.
- Focus on cross-boundary interactions: API routes, DB queries, service-to-service calls, IPC handlers.
- Commit all test files before exiting.

### Steps

1. Read `task-tracking/TASK_{TASK_ID}/test-context.md` — extract framework, file scope, test command.
2. Read `task-tracking/TASK_{TASK_ID}/task.md` — understand the cross-boundary interactions involved.
3. Read each file in the File Scope to understand API contracts and data flows.
4. Discover existing integration test patterns:
   - `Glob(**/integration/**/*.ts)` or `Glob(**/*.integration.spec.ts)` — find examples
   - Read examples to extract: test setup/teardown, database seeding, HTTP request patterns, mock strategies for external dependencies
5. Write integration test files that:
   - Exercise the full path from API entry point through service to data layer (or equivalent)
   - Use real (in-memory or test-scoped) database/store where applicable — not mocks for the persistence layer
   - Mock only external third-party services (email, payment, etc.)
   - Test request/response contracts for API routes
   - Test data integrity across service boundaries
6. Write intermediate results to `task-tracking/TASK_{TASK_ID}/test-integration-results.md`:
   ```markdown
   # Integration Test Results — TASK_{TASK_ID}

   ## Files Written
   - {file path}: {N} tests

   ## Results Section
   Written: {N} integration tests across {N} files
   Status: COMPLETE
   ```
7. Commit: `test(TASK_{TASK_ID}): add integration tests`
8. EXIT.

---

## Auto-Pilot Changes

### Where to add the parallel Test Lead spawn

**Location:** Step 5 (Spawn Workers) and Step 7 (Handle Completions) of the Core Loop.

**Step 5a — Worker Type determination** (modify the existing decision table):

Current:
```
- Task state IMPLEMENTED or IN_REVIEW --> Review Worker
```

Updated:
```
- Task state IMPLEMENTED --> Review Lead + Test Lead (spawn both)
- Task state IN_REVIEW   --> Review Lead (if no review artifacts yet) | Test Lead (if no test-report.md yet) | both
```

The logic: when a task transitions to IMPLEMENTED, the Supervisor spawns **two workers simultaneously** for that task — one Review Lead and one Test Lead. Both are tracked in the active workers table with different labels and worker types.

**Step 5b — Worker Prompt selection** — add two new templates:
- `First-Run Test Lead Prompt`
- `Retry Test Lead Prompt`

**Step 5c — Provider/Model for Test Lead** — add to Provider Routing Table:
```
| Test Lead worker | claude | claude-sonnet-4-6 | Orchestration only — sonnet is sufficient |
```

**Step 5d — Labels:**
- Review Lead: `TASK_YYYY_NNN-TYPE-REVIEW`  (existing)
- Test Lead: `TASK_YYYY_NNN-TYPE-TEST` (new)

**Step 5e — Active workers table** — add `"TestLead"` as a valid worker_type value alongside `"ReviewLead"`.

### How to track both Review Lead and Test Lead workers

The active workers table in `{SESSION_DIR}state.md` already supports multiple workers per task (the table rows are keyed by `worker_id`, not `task_id`). No structural change is needed. The Supervisor records both:

```
| worker_id_A | TASK_YYYY_NNN | ReviewLead | TASK_YYYY_NNN-TYPE-REVIEW | running | ... | COMPLETE |
| worker_id_B | TASK_YYYY_NNN | TestLead   | TASK_YYYY_NNN-TYPE-TEST   | running | ... | TEST_DONE |
```

The Test Lead's `expected_end_state` is `"TEST_DONE"` — a new sentinel that tells the Supervisor "this worker completes when test-report.md exists", not via a registry state change.

### Combined completion condition

In Step 7 (Handle Completions), when a worker for TASK_YYYY_NNN reaches `finished`:

**Current logic:**
```
Review Worker finished + registry == COMPLETE → task done
```

**Updated logic:**
```
For a task with active ReviewLead + TestLead workers:

  ReviewLead finished:
    - Check registry state. If COMPLETE → Review Lead done.
    - Remove ReviewLead from active workers.
    - If TestLead still running → wait (do not close task yet).

  TestLead finished:
    - Check for test-report.md in task folder. If present → Test Lead done.
    - Remove TestLead from active workers.
    - If ReviewLead still running → wait.

  Both done:
    - Check registry state == COMPLETE (Review Lead sets this).
    - Check test-report.md exists (Test Lead writes this).
    - If both conditions met → task is fully COMPLETE. Log: "REVIEW AND TEST DONE — TASK_X: COMPLETE"
    - If registry == COMPLETE but test-report.md missing → task is COMPLETE but note "Test Lead did not produce report"
    - If registry != COMPLETE but test-report.md exists → Review Lead not done yet — this is unexpected, log warning
```

This means the Supervisor does not block COMPLETE on the Test Lead. If the Review Lead finishes and the registry shows COMPLETE, the task is treated as COMPLETE — the test report is a best-effort artifact. This prevents the Test Lead from blocking task completion if it fails.

### New session log entries to add

Add to the Session Log table in auto-pilot SKILL.md:

| Event | Log Row |
|-------|---------|
| Test Lead spawned | `\| {HH:MM:SS} \| auto-pilot \| SPAWNED {worker_id} for TASK_X (TestLead: {TaskType}) \|` |
| Test Lead done | `\| {HH:MM:SS} \| auto-pilot \| TEST DONE — TASK_X: test-report.md written \|` |
| Test Lead skipped | `\| {HH:MM:SS} \| auto-pilot \| TEST SKIP — TASK_X: task type {type} does not require tests \|` |
| Both done | `\| {HH:MM:SS} \| auto-pilot \| REVIEW AND TEST DONE — TASK_X: COMPLETE \|` |

### New prompt templates to add

**First-Run Test Lead Prompt** (add to Worker Prompt Templates section):

```
TEST LEAD — TASK_YYYY_NNN

AUTONOMOUS MODE — no human at this terminal. Do NOT pause.

You are the Test Lead for TASK_YYYY_NNN. Your job is to detect the test
framework, spawn parallel test writer sub-workers via MCP, execute the
test suite, and write test-report.md.

Read your full instructions from: .claude/agents/test-lead.md

Follow these rules strictly:

1. Verify MCP is available: call mcp__session-orchestrator__list_workers.
   If MCP is unavailable, write test-report.md noting "MCP unavailable —
   tests not written" and exit.

2. Check for existing artifacts (continuation support):
   - test-context.md exists? -> skip context generation
   - test-unit-results.md exists with Results section? -> skip Unit Test Writer spawn
   - test-integration-results.md exists with Results section? -> skip Integration Test Writer spawn
   - test-e2e-results.md exists with Results section? -> skip E2E Test Writer spawn
   - test-report.md exists with Results section? -> skip to exit gate

3. Generate test-context.md (if not already done).

4. Spawn test writer sub-workers in parallel via MCP (for any not yet done).
   Full sub-worker prompts and model routing in .claude/agents/test-lead.md.

5. Monitor sub-workers via mcp__session-orchestrator__get_worker_activity
   every 2 minutes until all reach finished or failed state.

6. Execute test suite using the command from test-context.md.

7. Write test-report.md to the task folder.

8. EXIT GATE — Before exiting, verify:
   - [ ] test-context.md exists (or skip was written)
   - [ ] test-report.md exists and is non-empty
   - [ ] All test files are committed
   If any check fails, write exit-gate-failure.md and exit.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

**Retry Test Lead Prompt:**

```
TEST LEAD — CONTINUATION MODE
TASK_YYYY_NNN — retry attempt {N}

The previous Test Lead {reason: stuck / crashed / stopped}.

AUTONOMOUS MODE — follow these rules strictly:

1. Check existing artifacts to determine where to resume:
   - test-context.md exists? -> context done
   - test-unit-results.md with Results section? -> unit tests done
   - test-integration-results.md with Results section? -> integration tests done
   - test-e2e-results.md with Results section? -> e2e tests done
   - test-report.md with Results section? -> report done
   Resume from the first incomplete step.

2. For any test type not yet complete, spawn a sub-worker via MCP.
   Full spawn instructions in .claude/agents/test-lead.md.

3. Continue from where the previous Test Lead stopped.
   Do NOT restart completed phases.

4. Complete all remaining phases: execution, report, exit gate.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

### Concurrency note

Spawning two workers per task doubles the active worker count for that task against the concurrency limit. The Supervisor should count each spawned worker (ReviewLead + TestLead) as one slot each. A task in review/test phase consumes 2 concurrency slots. If concurrency_limit is 3 and one task is in the IMPLEMENTED state, the Supervisor can spawn both workers (2 slots used) and still have 1 slot for a Build Worker.

If `concurrency_limit == 1`, the Supervisor spawns the Review Lead first (higher priority — it owns state transitions), then spawns the Test Lead only after the Review Lead finishes or if a slot opens. Document this edge case in the auto-pilot SKILL.md concurrency section.

---

## Orchestration Skill Changes

### Add test phase to pipeline docs

In the Strategy Quick Reference table, update the FEATURE and BUGFIX rows to reference the test phase:

**Current FEATURE row:**
```
| FEATURE | PM -> [Research] -> Architect -> Team-Leader -> QA |
```

**Updated:**
```
| FEATURE | PM -> [Research] -> Architect -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker] |
```

Similarly update the Workflow Selection Matrix description to mention testing.

### Update Exit Gate — Review Worker Exit Gate

Add one new check row:

| Check | Command | Expected |
|-------|---------|----------|
| Test report exists | Read task folder for test-report.md | Present (or note if Test Lead was skipped/failed) |

The test report check is advisory (not blocking for COMPLETE) — the Review Lead does not own the test phase. It documents the gap if missing.

---

## Task Template Change

**File:** `task-tracking/task-template.md`

Add one optional row to the Metadata table:

```
| Testing    | [required | optional | skip]                                                         |
```

Add a comment explaining the field:
```
<!-- Testing: Optional override for the test type decision matrix.
       required — force test phase even if task type would normally skip
       optional — run tests if framework detected (default for most task types)
       skip     — suppress test phase entirely (use for tasks that touch no testable code)
     Omit this field to use the default matrix behavior based on task type. -->
```

---

## Codebase Investigation Summary

### Patterns verified

- **Lead→sub-worker pattern**: `review-lead.md` (lines 1-308) — Phase 1-5 structure, MCP spawn, 2-minute poll, minimum viable logic, continuation checks. Test Lead follows this exactly.
- **Worker type tracking**: `auto-pilot/SKILL.md` line 483 — `"ReviewLead"` already exists as a worker_type value. `"TestLead"` follows the same naming.
- **State machine**: `auto-pilot/SKILL.md` lines 350-358 — classifications are READY_FOR_REVIEW, REVIEWING, etc. No new state required.
- **Prompt templates**: `auto-pilot/SKILL.md` lines 948-1047 — First-Run and Retry Review Lead prompts. Test Lead prompts follow the same structure.
- **MCP spawn pattern**: `review-lead.md` lines 72-135 — spawn without waiting, record worker IDs, continuation check before spawning.
- **Sub-worker prompt style**: `review-lead.md` lines 144-209 — self-contained prompts, `AUTONOMOUS MODE`, fixed set of steps, working directory injected.
- **Framework detection patterns**: `task.md` lines 108-120 — detection table from task spec, verified against senior-tester.md investigation methodology.
- **test-report.md format**: `senior-tester.md` lines 479-523 — existing format. Test Lead's format is a simplified version that covers the orchestration perspective (counts and results), not the full test implementation detail.
- **task-template.md**: lines 1-71 — current metadata fields, location for new Testing field.

---

## Architecture Delivery Checklist

- [x] All components specified with evidence
- [x] All patterns verified from codebase (review-lead.md, auto-pilot SKILL.md)
- [x] No hallucinated APIs — MCP calls follow exactly the pattern in review-lead.md
- [x] Quality requirements defined (exit gates per agent)
- [x] Integration points documented (Supervisor spawn logic, state tracking)
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step code implementation (team-leader decomposes into tasks)
