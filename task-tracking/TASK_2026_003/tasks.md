# Development Tasks - TASK_2026_003

**Total Tasks**: 14 | **Batches**: 4 | **Status**: 4/4 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- File line counts match implementation plan references (auto-pilot SKILL.md: 609 lines, orchestration SKILL.md: 321 lines, auto-pilot.md: 129 lines, task-tracking.md: 261 lines)
- `--stuck` parameter already removed from SKILL.md Configuration table (confirmed absent)
- Modes section already exists at SKILL.md:103-113 (confirmed present)
- IMPLEMENTED state already exists at tasks.md sub-task level (task-tracking.md:237) but NOT at registry level (confirmed gap to fill)
- All four target files exist at their expected paths
- No code files to modify -- this is a documentation/specification refactoring task (all .md files)

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large SKILL.md rewrite (609 lines) may miss sections | MED | Batch 2 tasks broken into sub-components (1A-1I) with specific line ranges; verification checks content of each section |
| Terminology sweep may break file path references | LOW | Implementation plan explicitly notes: keep `/auto-pilot` command path references as-is |
| "COMPLETED" vs "COMPLETE" inconsistency in orchestration SKILL.md | LOW | Component 5C explicitly fixes this; Task 3.3 covers it |

---

## Batch 1: Task-Tracking Reference Updates COMPLETE

**Developer**: backend-developer
**Tasks**: 5 | **Dependencies**: None

This batch establishes the new state machine and folder structure that all other components reference.

### Task 1.1: Expand Registry Status Table with New States COMPLETE

**File**: `.claude/skills/orchestration/references/task-tracking.md`
**Spec Reference**: implementation-plan.md:694-714 (Component 6A)
**Pattern to Follow**: Existing table at task-tracking.md:221-229

**Quality Requirements**:
- Registry status table includes all 7 states: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED
- Descriptions match implementation plan exactly (e.g., "Build Worker actively implementing" for IN_PROGRESS)
- BLOCKED description updated to "Waiting on dependency or retries exhausted"

**Implementation Details**:
- Replace the 5-row registry status table (lines 221-229) with the 7-row version from Component 6A
- Keep the section heading and surrounding structure intact

---

### Task 1.2: Add completion-report.md and exit-gate-failure.md to Folder Structure COMPLETE

**File**: `.claude/skills/orchestration/references/task-tracking.md`
**Spec Reference**: implementation-plan.md:716-724 (Component 6B)
**Pattern to Follow**: Existing folder structure at task-tracking.md:26-48

**Quality Requirements**:
- `completion-report.md` added after `visual-review.md` line with comment "Completion report (Review Worker / orchestrator output)"
- `exit-gate-failure.md` added after completion-report.md with comment "Exit gate failure log (worker output, only on failure)"
- Indentation matches existing entries (4 spaces)

**Implementation Details**:
- Add two lines to the folder structure listing inside the TASK_[ID]/ section
- Position: after `visual-review.md` and before `future-enhancements.md`

---

### Task 1.3: Add New Rows to Document Ownership Table COMPLETE

**File**: `.claude/skills/orchestration/references/task-tracking.md`
**Spec Reference**: implementation-plan.md:728-734 (Component 6C)
**Pattern to Follow**: Existing table at task-tracking.md:143-153

**Quality Requirements**:
- Two new rows added: completion-report.md and exit-gate-failure.md
- Created By and Contains columns match the implementation plan values
- Table formatting consistent with existing rows

**Implementation Details**:
- Add `completion-report.md | Review Worker / Orchestrator | Completion summary, review scores` row
- Add `exit-gate-failure.md | Build/Review Worker | Exit gate failure details (when applicable)` row

---

### Task 1.4: Add Worker Scoping Note to Phase Detection Table COMPLETE

**File**: `.claude/skills/orchestration/references/task-tracking.md`
**Spec Reference**: implementation-plan.md:738-747 (Component 6D)
**Pattern to Follow**: Existing table at task-tracking.md:176-191

**Quality Requirements**:
- Blockquote note added ABOVE the phase detection table
- Note text explains Build Worker handles "Initialized" through "Dev complete", Review Worker handles "Dev complete" through "All done"
- Existing table content unchanged

**Implementation Details**:
- Insert a `> **Worker Scoping**: ...` blockquote between the "Phase Detection" heading/intro and the table itself

---

### Task 1.5: Update Registry Format Example with New States COMPLETE

**File**: `.claude/skills/orchestration/references/task-tracking.md`
**Spec Reference**: implementation-plan.md:749-759 (Component 6E)
**Pattern to Follow**: Existing example at task-tracking.md:74-82

**Quality Requirements**:
- Example registry table shows all 4 active states: COMPLETE, IMPLEMENTED, IN_REVIEW, IN_PROGRESS
- Task IDs, types, and dates are realistic examples
- Table formatting matches existing format

**Implementation Details**:
- Replace the 3-row example registry with the 4-row version from Component 6E
- Keep the surrounding markdown structure (heading, code block) intact

---

**Batch 1 Verification**:
- File exists: `.claude/skills/orchestration/references/task-tracking.md`
- All 7 registry states present in status table
- completion-report.md and exit-gate-failure.md in folder structure
- Document ownership table has new rows
- Worker scoping note above phase detection table
- Registry example shows IMPLEMENTED and IN_REVIEW states
- code-logic-reviewer approved

---

## Batch 2: Supervisor SKILL.md Rewrite COMPLETE

**Developer**: backend-developer
**Tasks**: 4 | **Dependencies**: Batch 1 (uses state definitions from task-tracking reference)

This batch rewrites the auto-pilot SKILL.md into the Supervisor SKILL.md. Grouped into logical sub-sections to keep each task focused. The implementation plan components 1A-1I and components 2-3 are combined here.

### Task 2.1: Rewrite Frontmatter, Title, Role, Configuration, Session Log, and Modes (Components 1A-1E) COMPLETE

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: implementation-plan.md:88-173 (Components 1A through 1E)
**Pattern to Follow**: Current file structure at SKILL.md:1-113

**Quality Requirements**:
- Frontmatter: name changed to "supervisor", description updated per plan
- Title: "Supervisor Skill" with new subtitle about Build Workers and Review Workers
- Role section: "Your Role: Supervisor" with updated 8 responsibilities
- "What You Never Do" updated: add registry/quality items, reword completion-report item
- Configuration table: verify --stuck is absent (no change expected)
- Session log event table: 5 event format changes per Component 1D table
- "AUTO-PILOT" renamed to "SUPERVISOR" in start/stop log messages
- Modes section: "auto-pilot" -> "supervisor" in descriptions, single-task mode updated to be state-aware per plan

**Validation Notes**:
- Do NOT rename file paths (file stays at `.claude/skills/auto-pilot/SKILL.md`)
- Do NOT rename `/auto-pilot` command references
- The Quick Start section should keep `/auto-pilot` command syntax

**Implementation Details**:
- This covers SKILL.md lines 1-113 (first ~113 lines)
- Rewrite these sections in place, preserving the overall document structure
- Session log changes: SPAWNED format adds WorkerType, COMPLETE becomes STATE TRANSITIONED, FAILED becomes NO TRANSITION, add BUILD DONE and REVIEW DONE events

---

### Task 2.2: Rewrite Core Loop Steps 1-8 and Recovery Protocol (Components 1F-1G) COMPLETE

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: implementation-plan.md:176-346 (Component 1F Core Loop + 1G State Format)
**Pattern to Follow**: Current file structure at SKILL.md:115-504

**Quality Requirements**:
- Step 1 (Read State): Add sub-step 5 for state-vs-registry reconciliation with 4 cases
- Step 2 (Read Registry): Read CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW tasks
- Step 2b (Validate): No change, keep as-is
- Step 3 (Dependency Graph): 7 new classifications (READY_FOR_BUILD, BUILDING, READY_FOR_REVIEW, REVIEWING, BLOCKED, COMPLETE, CANCELLED)
- Step 4 (Order Queue): Two queues (Build Queue, Review Queue), Review Workers take priority
- Step 5 (Spawn Workers): Major rewrite with worker type determination, two prompt templates, worker-type-aware spawn, updated state recording (add Worker Type and Expected End State columns)
- Step 6 (Monitor): On stuck kill, do NOT reset to CREATED, leave state as-is
- Step 7 (Handle Completions): Major rewrite with state transition detection logic (7a-7f)
- Worker Recovery Protocol: Do NOT reset to CREATED, leave at current state
- Step 8 (Loop Termination): "Unblocked" means READY_FOR_BUILD or READY_FOR_REVIEW
- orchestrator-state.md format: Add Worker Type and Expected End State columns to Active Workers table

**Validation Notes**:
- This is the largest single task -- the core loop is ~390 lines
- Step 5 references the Build Worker and Review Worker prompt templates (Task 2.3)
- The prompt templates can be referenced by section heading rather than inline

**Implementation Details**:
- Covers SKILL.md lines ~115-504
- Key structural change: Step 5 now has sub-steps 5a-5f, Step 7 now has sub-steps 7a-7f
- orchestrator-state.md Active Workers table gains 2 new columns
- Session Log example entries updated to new event formats

---

### Task 2.3: Add Build Worker and Review Worker Prompt Templates (Components 2-3) COMPLETE

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: implementation-plan.md:370-565 (Components 2 and 3)
**Pattern to Follow**: Current single prompt at SKILL.md:233-268

**Quality Requirements**:
- Four prompt templates total: Build Worker first-run, Build Worker retry, Review Worker first-run, Review Worker retry
- Build Worker prompts: scoped to PM -> Architect -> Team-Leader -> Dev, stop at IMPLEMENTED
- Review Worker prompts: scoped to reviews + fixes + Completion Phase, end at COMPLETE
- All prompts include EXIT GATE checklist
- Retry prompts include continuation context (attempt count, reason)
- All prompts include AUTONOMOUS MODE rules (no user checkpoints, no human at terminal)
- All prompts reference .claude/review-lessons/ for developers/reviewers
- Build Worker explicitly states: "You do NOT run reviews. You do NOT write completion-report.md."
- Review Worker explicitly states: "Do NOT re-run PM, Architect, or development phases."

**Validation Notes**:
- These templates replace the single monolithic worker prompt
- They should be placed in a new clearly-labeled section within Step 5 or as a standalone section referenced by Step 5
- Template variables: {project_root}, TASK_YYYY_NNN, {N} (retry count), {reason} (failure reason)

**Implementation Details**:
- Build Worker first-run: 7 rules + EXIT GATE (implementation-plan.md:376-416)
- Build Worker retry: 7 rules + EXIT GATE (implementation-plan.md:420-460)
- Review Worker first-run: 10 rules + EXIT GATE (implementation-plan.md:470-519)
- Review Worker retry: 8 rules + EXIT GATE (implementation-plan.md:522-565)

---

### Task 2.4: Update Key Principles and Terminology Sweep (Components 1H-1I) COMPLETE

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: implementation-plan.md:348-367 (Components 1H and 1I)
**Pattern to Follow**: Current principles at SKILL.md:598-610

**Quality Requirements**:
- Principle 1: "You are the **Supervisor**"
- Principle 5: Updated to "Workers update the registry themselves"
- Principle 7: Add worker_type match check mention
- New Principle 11: "Spawn the right worker type"
- New Principle 12: "Review Workers take priority"
- Terminology sweep: "Auto-Pilot" -> "Supervisor" in headings/descriptions (NOT in file paths or command references)
- "AUTO-PILOT STARTED/STOPPED" -> "SUPERVISOR STARTED/STOPPED" in log events
- `/auto-pilot` command path references preserved as-is

**Validation Notes**:
- Run terminology sweep AFTER all other content changes to avoid double-replacing
- Be careful not to replace "auto-pilot" in file paths like `.claude/skills/auto-pilot/SKILL.md` or `/auto-pilot` command

**Implementation Details**:
- Key Principles section is near the end of the file (~lines 598-610)
- Terminology sweep is a global pass across the entire file
- Must preserve: file path references, command name references

---

**Batch 2 Verification**:
- File exists: `.claude/skills/auto-pilot/SKILL.md`
- Title is "Supervisor Skill"
- Role section says "Supervisor"
- 7 dependency graph classifications present
- Two queues defined (Build Queue, Review Queue)
- 4 worker prompt templates present (Build first-run, Build retry, Review first-run, Review retry)
- orchestrator-state.md format has Worker Type and Expected End State columns
- 12 Key Principles listed
- No "Auto-Pilot" references remain in headings/descriptions (only in file paths)
- code-logic-reviewer approved

---

## Batch 3: Orchestration SKILL.md Updates COMPLETE

**Developer**: backend-developer
**Tasks**: 3 | **Dependencies**: Batch 1 (uses state definitions), Batch 2 (Exit Gate referenced from Supervisor SKILL.md)

This batch adds the Exit Gate specification and scoping notes to the orchestration SKILL.md.

### Task 3.1: Add Worker Scoping Note to Phase Detection Table COMPLETE

**File**: `.claude/skills/orchestration/SKILL.md`
**Spec Reference**: implementation-plan.md:633-643 (Component 5A)
**Pattern to Follow**: Current table at SKILL.md:123-132

**Quality Requirements**:
- Blockquote note added above the CONTINUATION phase detection table
- Note explains Build Worker scope (through "Dev complete") and Review Worker scope ("Dev complete" through end)
- Mentions interactive mode runs full flow
- Existing table content unchanged

**Implementation Details**:
- Insert `> **Worker Scoping**: ...` blockquote between heading/intro and the table

---

### Task 3.2: Add Completion Phase Scoping Note COMPLETE

**File**: `.claude/skills/orchestration/SKILL.md`
**Spec Reference**: implementation-plan.md:645-655 (Component 5B)
**Pattern to Follow**: Current heading at SKILL.md:248

**Quality Requirements**:
- Blockquote note added immediately after the "## Completion Phase (MANDATORY -- DO NOT SKIP)" heading
- Note explains: in Supervisor mode, runs in Review Worker only; Build Workers stop after implementation; interactive mode unchanged
- Heading text itself unchanged

**Implementation Details**:
- Insert `> **Scope Note**: ...` blockquote right after the heading line

---

### Task 3.3: Fix COMPLETED->COMPLETE Inconsistency, Add Registry Update Note, Add Exit Gate Section, Add Principle 8 COMPLETE

**File**: `.claude/skills/orchestration/SKILL.md`
**Spec Reference**: implementation-plan.md:657-686 (Components 5C, 5D, 5E)
**Pattern to Follow**: Current section at SKILL.md:295-322

**Quality Requirements**:
- Registry update text: "COMPLETED" changed to "COMPLETE" (fix pre-existing inconsistency)
- Added note about who sets COMPLETE in autonomous vs interactive mode
- Exit Gate section added after Completion Phase (after ~line 311) with Build Worker and Review Worker gate tables
- Exit Gate Failure subsection with exit-gate-failure.md creation instruction
- Principle 8 added to Key Principles: "Exit Gate: Always run the Exit Gate checks before exiting an autonomous session"

**Implementation Details**:
- Component 5C: Fix "COMPLETED" -> "COMPLETE" at line ~296, add autonomous/interactive note
- Component 5D: Add full Exit Gate section from implementation-plan.md:578-617
- Component 5E: Add Principle 8 to the Key Principles list at ~lines 314-322

---

**Batch 3 Verification**:
- File exists: `.claude/skills/orchestration/SKILL.md`
- Worker Scoping note above phase detection table
- Completion Phase has Scope Note blockquote
- "COMPLETED" replaced with "COMPLETE" in registry update section
- Exit Gate section exists with Build Worker and Review Worker gate tables
- Exit Gate Failure subsection present
- Key Principles has 8 items including Exit Gate
- code-logic-reviewer approved

---

## Batch 4: Auto-Pilot Command Updates COMPLETE

**Developer**: backend-developer
**Tasks**: 2 | **Dependencies**: Batch 2 (Supervisor SKILL.md must exist for command to reference)

This batch updates the command entry point with new terminology and state-aware display.

### Task 4.1: Update Title, Description, Step 1, and References COMPLETE

**File**: `.claude/commands/auto-pilot.md`
**Spec Reference**: implementation-plan.md:763-880 (Components 7A, 7C, 7H)
**Pattern to Follow**: Current file at auto-pilot.md:1-5, 30-32, 125-129

**Quality Requirements**:
- Title: "Auto-Pilot -- Supervisor Task Processing" (keep "Auto-Pilot" as command name)
- Description updated to mention Supervisor loop, Build Workers, Review Workers, state transitions
- Step 1 description updated to reference "Supervisor loop logic, worker type determination, state management, and monitoring protocol"
- Skill reference: "Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`"
- Command name stays as `/auto-pilot` everywhere

**Implementation Details**:
- Title line: change "Autonomous Task Processing" to "Supervisor Task Processing"
- Description paragraph: replace with new 3-line description from Component 7A
- Step 1: update description text (keep file path reference)
- References: update skill description text

---

### Task 4.2: Update Pre-Flight, Display Summary, Dry-Run, Single-Task Mode, and Quick Reference COMPLETE

**File**: `.claude/commands/auto-pilot.md`
**Spec Reference**: implementation-plan.md:800-894 (Components 7D, 7E, 7F, 7G, 7I)
**Pattern to Follow**: Current file at auto-pilot.md:56-122

**Quality Requirements**:
- Step 3c pre-flight: accept CREATED or IMPLEMENTED; handle IN_PROGRESS/IN_REVIEW as resume; COMPLETE warns; BLOCKED/CANCELLED errors
- Step 4 display: "SUPERVISOR STARTING" header with 8 status lines (Ready for build, Building, Ready for review, Reviewing, Complete, Blocked/Cancelled)
- Step 5 dry-run: show worker types in execution plan, Review Workers listed before Build Workers, dependency graph shows READY_FOR_BUILD/READY_FOR_REVIEW/WAITING classifications
- Single-task mode: state-aware worker spawning, auto-chain Build->Review
- Quick reference: add Worker Types line, update Modes, keep MCP Tools, add Skill Path

**Implementation Details**:
- Step 3c: expand valid states from just CREATED to CREATED/IMPLEMENTED/IN_PROGRESS/IN_REVIEW
- Step 4: complete rewrite of summary display format
- Step 5: complete rewrite of dry-run output format
- Single-task mode: rewrite to include state-aware spawning and Build->Review chaining
- Quick reference: add Worker Types and Skill Path lines

---

**Batch 4 Verification**:
- File exists: `.claude/commands/auto-pilot.md`
- Title says "Supervisor Task Processing"
- Description mentions Build Workers and Review Workers
- Pre-flight accepts CREATED and IMPLEMENTED
- Summary display shows all state categories
- Dry-run output shows worker types
- Single-task mode documents Build->Review chaining
- Quick reference includes Worker Types
- code-logic-reviewer approved
