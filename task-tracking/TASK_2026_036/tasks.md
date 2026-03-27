# Development Tasks - TASK_2026_036

**Total Tasks**: 6 | **Batches**: 2 | **Status**: 1/2 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- Lead→sub-worker pattern: Verified in `.claude/agents/review-lead.md` (5-phase structure, MCP spawn, 2-minute poll, continuation checks)
- `"ReviewLead"` worker_type value: Verified in `.claude/skills/auto-pilot/SKILL.md` line 487 — `"TestLead"` follows same naming
- Active workers table supports multiple workers per task_id: Verified — rows keyed by worker_id, not task_id
- Prompt template structure: Verified at auto-pilot SKILL.md lines 953–1048 — First-Run and Retry Review Lead prompts
- MCP spawn pattern: Verified in review-lead.md lines 72–135 — spawn without waiting, record worker IDs
- task-template.md metadata table location: Verified at lines 7–13 — new Testing row inserts cleanly
- None of the three new agent files exist yet: Confirmed via directory listing

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Concurrency slot doubling when spawning both Review Lead + Test Lead for one task | LOW | Architecture notes in implementation-plan.md cover this; document in auto-pilot SKILL.md concurrency section per plan |
| Test Lead does not own state transitions — completion is artifact-based (test-report.md) | LOW | plan specifies TEST_DONE sentinel; Supervisor detects via file existence check |

---

## Batch 1: New Agent Files - COMPLETE

**Developer**: systems-developer
**Tasks**: 3 | **Dependencies**: None

### Task 1.1: Create test-lead.md agent - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/test-lead.md`
**Spec Reference**: `implementation-plan.md` lines 82–268

**Quality Requirements**:

- YAML frontmatter with name and description matching the spec
- Five-phase structure mirroring review-lead.md exactly: Context Generation, Spawn sub-workers, Monitor, Execute, Report
- Phase 1: task ID validation, project root validation, task.md extraction, skip decision, framework detection, test type decision matrix, write test-context.md
- Phase 2: MCP spawn for each required test type without waiting between calls; model routing table hard-coded; continuation check before spawning
- Phase 3: 2-minute poll interval, two-strike stuck detection, kill on second consecutive stuck, verify results files after all done
- Phase 4: run test command from test-context.md, capture output, distinguish test bugs vs implementation bugs, coverage delta if available
- Phase 5: write test-report.md using the exact table structure from the plan; no registry state update (Test Lead does not own COMPLETE)
- Exit Gate: verify test-context.md exists, test-report.md non-empty, test files committed, results reflected in report
- CRITICAL OPERATING RULES block at top: AUTONOMOUS MODE, do NOT write tests yourself, do NOT modify source files, write test-report.md as FINAL action

**Key Content to Include**:

- Frontmatter: `name: test-lead` / `description: Test Lead orchestrator — detects test framework, spawns parallel test writer sub-workers via MCP, executes test suite, writes test-report.md`
- Sub-worker prompt templates for Unit Test Writer, Integration Test Writer, E2E Test Writer (self-contained, AUTONOMOUS MODE, working directory injected)
- Model routing table: Unit Test Writer → `claude-sonnet-4-6`, Integration Test Writer → `claude-opus-4-5`, E2E Test Writer → `claude-sonnet-4-6`
- Labels: `TASK_{TASK_ID}-TEST-UNIT`, `TASK_{TASK_ID}-TEST-INTEGRATION`, `TASK_{TASK_ID}-TEST-E2E`
- Continuation check before each spawn: check for existing results files with Results section
- On Unit Test Writer spawn failure when unit tests required: write `exit-gate-failure.md` and exit

**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` — entire file

**Validation Notes**:

- The Test Lead does NOT update registry state — this is intentional. The Supervisor detects completion via test-report.md existence.
- expected_end_state for TestLead workers is `"TEST_DONE"` (not a registry state — a sentinel the Supervisor checks via artifact).

---

### Task 1.2: Create unit-tester.md agent - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/unit-tester.md`
**Spec Reference**: `implementation-plan.md` lines 272–318

**Quality Requirements**:

- YAML frontmatter with name and description
- AUTONOMOUS MODE operating rules at top
- Steps in order: read test-context.md, read task.md, read File Scope files, discover existing test patterns via Glob, write unit tests, write test-unit-results.md, commit, EXIT
- Glob patterns for test discovery: `**/*.spec.ts` or `**/*.test.ts` — find 2-3 examples, extract naming/structure conventions
- Unit test coverage: all exported functions/methods in changed files, happy path + error cases, edge cases from function signature, regression coverage for bug fixes
- Test philosophy: test public API and observable behavior — do NOT test implementation details
- Output file: `task-tracking/TASK_{TASK_ID}/test-unit-results.md` with Files Written section and Results Section (required for continuation detection)
- Commit message: `test(TASK_{TASK_ID}): add unit tests`

**Key Content to Include**:

- Frontmatter: `name: unit-tester` / `description: Unit Test Writer sub-worker — reads implementation + test context, writes unit tests following project conventions, commits test files`
- Co-location rule: write test files next to source files (or in `__tests__/` if that is the established convention)
- test-unit-results.md format must include `## Results Section` heading (used by Test Lead's continuation check)

**Pattern to Follow**: Sub-worker prompt style in `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` lines 144–209

---

### Task 1.3: Create integration-tester.md agent - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/integration-tester.md`
**Spec Reference**: `implementation-plan.md` lines 322–367

**Quality Requirements**:

- YAML frontmatter with name and description
- AUTONOMOUS MODE operating rules at top: write tests only, do NOT modify source files, focus on cross-boundary interactions
- Steps in order: read test-context.md, read task.md, read File Scope files, discover integration test patterns via Glob, write integration tests, write test-integration-results.md, commit, EXIT
- Glob patterns: `**/integration/**/*.ts` or `**/*.integration.spec.ts`
- Integration test scope: full path from API entry point through service to data layer; real in-memory/test-scoped database where applicable; mock only external third-party services; test request/response contracts and data integrity across boundaries
- Output file: `task-tracking/TASK_{TASK_ID}/test-integration-results.md` with Files Written section and Results Section
- Commit message: `test(TASK_{TASK_ID}): add integration tests`

**Key Content to Include**:

- Frontmatter: `name: integration-tester` / `description: Integration Test Writer sub-worker — reads implementation + test context, writes integration tests for cross-boundary interactions, commits test files`
- test-integration-results.md format must include `## Results Section` heading (used by Test Lead's continuation check)
- Explicit guidance: mock only external third-party services — NOT the persistence layer

**Pattern to Follow**: Sub-worker prompt style in `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md` lines 144–209

---

**Batch 1 Verification**:

- All three files exist at their absolute paths
- Each file has valid YAML frontmatter
- test-lead.md has all five phases, sub-worker prompt templates, model routing table, and exit gate
- unit-tester.md and integration-tester.md each have operating rules, steps, results file format, and commit instruction
- code-logic-reviewer approved

---

## Batch 2: Skill and Template Updates - IMPLEMENTED

**Developer**: systems-developer
**Tasks**: 3 | **Dependencies**: Batch 1 (agent files must exist before referencing them in skill prompts)

### Task 2.1: Update auto-pilot SKILL.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: `implementation-plan.md` lines 372–546

**What to Modify**:

1. **Step 5a — Worker Type determination table**: Add `TestLead` as a spawnable worker type. Update the decision logic:
   - Current: `Task state IMPLEMENTED or IN_REVIEW --> Review Worker`
   - Updated: spawn both Review Lead AND Test Lead when task transitions to IMPLEMENTED; handle partial spawns when resuming IN_REVIEW (check for existing artifacts)

2. **Step 5b — Worker Prompt Templates section**: Add two new templates after the existing Review Lead prompts:
   - `First-Run Test Lead Prompt` (full text from implementation-plan.md lines 464–509)
   - `Retry Test Lead Prompt` (full text from implementation-plan.md lines 512–539)

3. **Step 5c — Provider Routing Table**: Add row: `| Test Lead worker | claude | claude-sonnet-4-6 | Orchestration only — sonnet is sufficient |`

4. **Step 5d — Labels**: Document new Test Lead label: `TASK_YYYY_NNN-TYPE-TEST`

5. **Step 5e — Active workers table**: Add `"TestLead"` as a valid worker_type value alongside `"ReviewLead"` with `expected_end_state="TEST_DONE"`

6. **Step 7 — Handle Completions**: Replace simple COMPLETE check with combined completion condition (from implementation-plan.md lines 427–449):
   - ReviewLead finished: check registry COMPLETE, remove from active, wait if TestLead still running
   - TestLead finished: check test-report.md exists, remove from active, wait if ReviewLead still running
   - Both done: log `"REVIEW AND TEST DONE — TASK_X: COMPLETE"`
   - COMPLETE is NOT blocked on Test Lead — if Review Lead sets COMPLETE and test-report.md is missing, task is COMPLETE with a note

7. **Session Log entries**: Add new log event rows (from implementation-plan.md lines 452–460):
   - Test Lead spawned
   - Test Lead done
   - Test Lead skipped
   - Both done (REVIEW AND TEST DONE)

8. **Concurrency section**: Document the slot-doubling edge case and the `concurrency_limit == 1` fallback (spawn Review Lead first, Test Lead after Review Lead finishes)

**Pattern to Follow**: Existing Step 5/7 structure in the file; Review Lead additions in TASK_2026_035 as the direct model

---

### Task 2.2: Update orchestration SKILL.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md`
**Spec Reference**: `implementation-plan.md` lines 550–576

**What to Modify**:

1. **Strategy Quick Reference table**: Update FEATURE and BUGFIX rows to reference the parallel test phase:
   - Current FEATURE: `PM -> [Research] -> Architect -> Team-Leader -> QA`
   - Updated FEATURE: `PM -> [Research] -> Architect -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker]`
   - Update BUGFIX row similarly to mention Review Lead + Test Lead (parallel)

2. **Review Worker Exit Gate** (additive only — add one new check row):

   | Check | Command | Expected |
   |-------|---------|----------|
   | Test report exists | Read task folder for test-report.md | Present (or note if Test Lead was skipped/failed) |

   This check is advisory — not blocking for COMPLETE. The Review Lead does not own the test phase.

**Pattern to Follow**: Existing Exit Gate table format at `implementation-plan.md` line 572 and orchestration SKILL.md Exit Gate section

---

### Task 2.3: Update task-template.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md`
**Spec Reference**: `implementation-plan.md` lines 582–597

**What to Modify**:

Add one optional row to the Metadata table (after the existing `Model` row):

```
| Testing    | [required | optional | skip]                                                         |
```

Add the corresponding HTML comment explaining the field (from implementation-plan.md lines 593–597):

```
<!-- Testing: Optional override for the test type decision matrix.
       required — force test phase even if task type would normally skip
       optional — run tests if framework detected (default for most task types)
       skip     — suppress test phase entirely (use for tasks that touch no testable code)
     Omit this field to use the default matrix behavior based on task type. -->
```

The comment should appear immediately after the existing `Model` comment block.

**Pattern to Follow**: Existing comment style in `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md` lines 14–34

---

**Batch 2 Verification**:

- auto-pilot SKILL.md contains Test Lead spawn logic, both prompt templates, updated completion condition, new log entries
- orchestration SKILL.md Strategy Quick Reference updated for FEATURE/BUGFIX rows
- orchestration SKILL.md Review Worker Exit Gate has test-report.md check row
- task-template.md has Testing metadata row and comment
- code-logic-reviewer approved
