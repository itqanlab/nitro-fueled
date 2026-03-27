# Code Style Review — TASK_2026_036

## Verdict
APPROVE WITH MINOR ISSUES

## Score
7/10

## Findings

---

### Inconsistent continuation-check sentinel string — SERIOUS
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/test-lead.md`
**Line**: Phase 2 Continuation Check (~line 99–103)
**Issue**: The continuation check looks for `## Results Section` as a sentinel heading in the sub-worker results files. The unit-tester and integration-tester agents write `## Results Section` as a plain heading with body text beneath it, which is consistent. However, `test-report.md` phase completion is checked by looking for `## Results` (in the auto-pilot First-Run Test Lead Prompt: `test-report.md exists with Results section?`). The auto-pilot prompt uses `Results section` while test-lead.md Phase 2 uses `## Results Section` — these headings will match by eye but a grep-based check (`contains "## Results Section"`) will fail against the test-report.md format, which uses `## Test Results` as its H2. The sentinel used as the "done" signal is inconsistent across files and may silently fail.
**Fix**: Decide on one sentinel heading for `test-report.md` completion detection. The test-report template uses `## Test Results` — either the auto-pilot and test-lead.md continuation checks should look for `## Test Results`, or the template should be changed to include `## Results Section`. Use the same check string everywhere.

---

### Asymmetric heading level for CRITICAL OPERATING RULES block — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/unit-tester.md` and `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/integration-tester.md`
**Line**: Line 14 in both files
**Issue**: Both files use `## CRITICAL OPERATING RULES` (H2), which matches the review-lead.md reference pattern exactly. However, the body steps in unit-tester.md and integration-tester.md use `### Step N:` (H3) headings, while review-lead.md uses `## Phase N:` (H2) for its major procedural blocks. The tester agents use `## Steps` (H2) as a parent with `### Step N:` children. This is internally consistent but deviates from test-lead.md's structure, which uses `## Phase N:` (H2) as top-level procedural headings matching review-lead.md. The sibling agents in the test pipeline use different structural conventions from each other.
**Fix**: Align structural convention across test-lead.md and its sub-worker agents. If test-lead.md uses `## Phase N:` (H2) for phases, and unit-tester/integration-tester use multi-step procedures, consider either promoting the `## Steps` parent to `## Phase` naming or documenting why sub-worker files intentionally use a flatter structure.

---

### Missing `Testing` field from task-template.md pipe-table comment block — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md`
**Line**: Lines 36–41 (the Testing comment block)
**Issue**: The `Testing` field comment placed after the Metadata table correctly documents `required | optional | skip`. However, the inline comment is separated from the other field comments — Type, Priority, Complexity, and Model all share a single `<!-- ... -->` block (lines 15–35), while Testing gets its own second comment block immediately below (lines 37–41). This breaks visual grouping. A developer creating a new task will see the Metadata table followed by a comment block, and may not realize the second comment also belongs to the Metadata table. The Pattern in the reference pattern (review-lead.md style commentary) groups all field documentation together.
**Fix**: Merge the Testing field comment into the existing single `<!-- ... -->` block above, after the Model field documentation. This keeps all field documentation co-located in one comment block.

---

### Placeholder token style divergence in test-lead.md sub-worker prompt templates — SERIOUS
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/test-lead.md`
**Line**: E2E Test Writer Prompt (~lines 214–236)
**Issue**: The E2E Test Writer prompt opens with `You are an E2E test writer for TASK_{TASK_ID}.` — using the indefinite article "an" and the generic role name "E2E test writer" (lowercase, no agent file reference). Compare to the Unit Test Writer prompt (`You are the unit-tester agent for TASK_{TASK_ID}.`) and the Integration Test Writer prompt (`You are the integration-tester agent for TASK_{TASK_ID}.`). The Unit and Integration prompts use "the" (definite article) and reference the agent role name with `agent` suffix matching the YAML `name:` field. The E2E prompt uses a different article, does not include `agent`, and does not reference a named agent file. This is inconsistent with the other two prompts and with how the review-lead.md sub-worker prompts identify themselves.
**Fix**: Change the E2E prompt opening to match: `You are the e2e-tester agent for TASK_{TASK_ID}.` — or align all three prompts to the same format. If an `e2e-tester.md` agent file does not exist (it is not in scope for this task), either note that in the prompt or create the file. The current mismatch signals an incomplete extraction.

---

### E2E Test Writer Prompt does not reference an agent file — SERIOUS
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/test-lead.md`
**Line**: E2E Test Writer Prompt (~lines 214–236)
**Issue**: The Unit Test Writer Prompt directs the sub-worker to follow `your agent instructions` (implying `unit-tester.md` exists and is loaded by Claude via the `name:` field). The Integration Test Writer Prompt does the same. But the E2E Test Writer Prompt contains no corresponding reference to an agent file — the instructions are entirely inline, and there is no `e2e-tester.md` agent. This is a structural asymmetry: two sub-worker types have full agent definitions, one does not. The review-lead.md pattern established that every sub-worker type should either have an agent file or have fully self-contained inline instructions; the E2E prompt is halfway: it calls itself "an E2E test writer" without an agent name, yet its prompt body is not as complete as a standalone spec (it lacks the pattern-discovery step that unit-tester.md and integration-tester.md have as Step 4, though it does include a partial substitute at step 4 inline). This asymmetry will confuse future maintainers who see two agent files and wonder why there is no `e2e-tester.md`.
**Fix**: Either create `.claude/agents/e2e-tester.md` following the same structure as unit-tester.md and integration-tester.md, or add a comment to test-lead.md explaining why E2E tests are handled inline rather than via a dedicated agent.

---

### `## Results Section` heading in sub-worker results files is a heading, not a sentinel — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/unit-tester.md` and `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/integration-tester.md`
**Line**: Step 6 results template (~line 87 in unit-tester.md, ~line 88 in integration-tester.md)
**Issue**: Both agents write a results file containing `## Results Section` as an H2 heading. The Test Lead's continuation check greps for this literal string. However, the heading text "Results Section" is semantically odd — it names the section as "Results Section" rather than a meaningful name like "Results" or "Test Results". The heading exists purely as a machine-readable sentinel, but it looks like a human documentation artifact. The review-lead.md pattern uses `## Verdict` as both a meaningful heading and a grep target. Using "Results Section" as a heading name (rather than the content description) leaks implementation detail into the document.
**Fix**: Either rename to `## Results` (still greppable, more readable) and update the continuation check in test-lead.md accordingly, or add a comment in the template noting that this heading is a machine-readable sentinel and must not be renamed.

---

### YAML frontmatter `description` in test-lead.md does not match role boundary — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/test-lead.md`
**Line**: Lines 1–4 (YAML frontmatter)
**Issue**: The `description` field reads: `Test Lead orchestrator — detects test framework, spawns parallel test writer sub-workers via MCP, executes test suite, writes test-report.md`. This accurately describes the role. Compare to review-lead.md: `Review Lead orchestrator — spawns parallel reviewer sub-workers via MCP, collects results, applies fixes, completes task`. The review-lead.md description is more concise and does not enumerate every phase — it focuses on the orchestrator's responsibilities at a summary level. The test-lead.md description is longer and enumerates four distinct responsibilities inline. This is not a violation, but the length inconsistency between sibling Lead agents (both in the same pattern family) creates visual asymmetry in the frontmatter.
**Fix**: Shorten to match the review-lead.md register: `Test Lead orchestrator — detects test framework, spawns parallel test writer sub-workers via MCP, collects results, writes test-report.md`. This omits "executes test suite" from the description (it is still described in the body) and brings the frontmatter length in line with review-lead.md.

---

### Auto-pilot SKILL.md log event row for Test Lead spawning uses `TestLead` (PascalCase) — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Line**: Log event table (~line 110): `| Test Lead spawned | ... (TestLead: {TaskType}) |`
**Issue**: The log event for "Test Lead spawned" uses `TestLead` (PascalCase, no space) in the format string, while the "Worker spawned" generic event uses `{WorkerType}` and the active workers table uses `"TestLead"` (quoted string). However, the `worker_type` values recorded in state.md are defined as `"Build"|"Review"|"ReviewLead"|"TestLead"` — so `TestLead` is correct in state records. The inconsistency is that the generic "Worker spawned" log event shows `(WorkerType: TaskType)` while the specific "Test Lead spawned" event shows `(TestLead: TaskType)` — hardcoding the type rather than using the `{WorkerType}` placeholder pattern. The Review Lead does not have its own dedicated spawn log row; it uses the generic "Worker spawned" row. Having a dedicated row for Test Lead but not Review Lead is asymmetric.
**Fix**: Either use the generic `SPAWNED {worker_id} for TASK_X ({WorkerType}: {TaskType})` format for both (remove the dedicated "Test Lead spawned" row) or add a matching dedicated "Review Lead spawned" row. Either direction is acceptable; the inconsistency is the problem.

---

### `task-template.md` Testing field comment explains `optional` incorrectly — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md`
**Line**: Lines 38–41 (Testing comment block)
**Issue**: The comment reads `optional — run tests if framework detected (default for most task types)`. The test type decision matrix in test-lead.md shows that "optional" is NOT "run tests if framework detected" — the matrix already decides per task type whether tests run. The `optional` value means "use the default matrix behavior." The comment's description of `optional` as "run tests if framework detected" could mislead task authors into thinking `optional` activates a lighter test run, when it actually means "delegate the decision to the matrix." The `required` and `skip` values are described accurately.
**Fix**: Change the comment for `optional` to: `optional — use the default decision matrix (framework-detected behavior based on task type)` to accurately reflect what the value does.

---

### Phase 1 step numbering in test-lead.md uses `0, 1, 2, 3, 4, 5, 6, 7` but step 1 is split into `1` and two unnumbered sub-steps — MINOR
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/test-lead.md`
**Line**: Phase 1, Steps section (~lines 29–91)
**Issue**: Phase 1 uses numbered steps 0 through 7. Step 0 is validation; step 1 is "Validate project root"; step 2 is "Read task.md". However, the review-lead.md Phase 1 uses steps labeled `0`, `1a`, `1`, `2`, `3`, `4`, `5`, `6` (with a `1a` sub-step). Test-lead.md simplified this to a flat 0–7 sequence which is better. The issue is that review-general.md explicitly warns against mixed step numbering (entry: "Step numbering in command docs must be flat and sequential — TASK_2026_043"). Test-lead.md is flat and sequential from 0 to 7, so this is actually correct. However, Phase 2 re-starts numbering at "Step 0", "Step 1", "Step 2", "Step 3" within the same Phase 2 section — every phase resets its step counter. This is consistent with review-lead.md's own phase structure where each phase has its own numbered steps. No violation here — noted for completeness but not a finding.

---

## Summary

The three new agent files are structurally sound and mirror the review-lead.md reference pattern well. The most actionable issues are: (1) the E2E Test Writer sub-worker is treated asymmetrically — no `e2e-tester.md` agent file, a different opening sentence style, and partially inline vs. partially delegated instructions; (2) the sentinel string used for test-report.md completion detection (`## Results Section`) does not match the actual heading in the test-report.md template (`## Test Results`), which could cause the continuation check to silently fail; and (3) the `optional` value in the task-template.md Testing field comment is described inaccurately. No blocking issues were found. All serious issues are recoverable without structural rework.
