# Implementation Plan - TASK_2026_004: Planner Agent and /plan Command

## Codebase Investigation Summary

### Files Analyzed

| File | Purpose | Key Findings |
|------|---------|-------------|
| `.claude/agents/project-manager.md` | Agent format pattern | YAML frontmatter (`name`, `description`), markdown body with sections: principles, protocols, responsibilities, anti-patterns |
| `.claude/commands/create-task.md` | Command format pattern | Title, Usage block, numbered Execution Steps, Important Rules, References |
| `.claude/commands/auto-pilot.md` | Command format pattern | Usage block with parameters table, Step-by-step execution, Quick Reference, References |
| `.claude/skills/auto-pilot/SKILL.md` | Supervisor loop | No Planner/consultation references exist yet. Steps 1-8 loop. Step 4 orders by priority then task ID. Step 7 handles completions. Step 8 checks termination. |
| `task-tracking/task-template.md` | Task file structure | Metadata table (Type, Priority, Complexity), Description, Dependencies, Acceptance Criteria, References. HTML comments for guidance. |
| `task-tracking/registry.md` | Registry format | `Task ID | Status | Type | Description | Created` -- 4 tasks exist, TASK_2026_004 is CREATED |
| `.claude/skills/orchestration/references/task-tracking.md` | Task tracking conventions | ID format, folder structure, registry management, phase detection, status values, document ownership |

### Patterns Identified

**Agent File Pattern** (from `project-manager.md`):
- YAML frontmatter: `name` and `description` fields
- H1 title with role identity
- IMPORTANT absolute paths reminder
- Critical operating principles section
- Core intelligence principles
- Protocols (clarification, investigation)
- Responsibilities with numbered sub-sections
- "What You Don't Do" section
- "Pro Tips" section
- Evidence: `.claude/agents/project-manager.md:1-4` (frontmatter), `:6-8` (title/identity), `:79-139` (clarification protocol)

**Command File Pattern** (from `create-task.md`):
- H1 title with brief description
- `## Usage` with code block showing invocation patterns
- `## Execution Steps` with numbered `### Step N: Title` sub-sections
- `## Important Rules` with numbered list
- `## References` with bullet list of related files
- Evidence: `.claude/commands/create-task.md:1-110`

**Task Creation Logic** (from `create-task.md`):
- Step 1: Read `task-template.md` as source of truth
- Step 2: Read `registry.md`, find highest NNN for current year, increment by 1, zero-pad to 3 digits
- Step 4: Create directory `task-tracking/TASK_YYYY_NNN/`, generate `task.md`, strip HTML comments
- Step 5: Add registry row: `| TASK_YYYY_NNN | CREATED | [Type] | [Description] | YYYY-MM-DD |`
- Step 5b: Validate auto-pilot readiness (Type, Priority, Description >= 2 sentences, >= 1 acceptance criterion)
- Evidence: `.claude/commands/create-task.md:14-76`

**Supervisor State Model** (from `SKILL.md`):
- Registry statuses: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED
- Task classification: READY_FOR_BUILD, BUILDING, READY_FOR_REVIEW, REVIEWING, BLOCKED, COMPLETE, CANCELLED
- Priority ordering: P0 > P1 > P2 > P3, then Task ID (lower NNN first)
- Review Workers prioritized over Build Workers
- Evidence: `.claude/skills/auto-pilot/SKILL.md:216-249`

### Integration Points

**Supervisor SKILL.md** -- Currently has NO consultation protocol. The Planner consultation mechanism needs to be added as a lightweight read-based pattern (Supervisor reads plan.md, applies ordering rules). Per the task requirements, the Supervisor reads plan.md's "Current Focus" section for guidance -- it does NOT spawn a Planner session.

**Registry.md** -- Shared write target. Both the Planner (creating tasks) and Supervisor (marking BLOCKED) write to it. The Planner follows the same row format and ID generation logic as `/create-task`.

**Task Template** -- The Planner reads `task-template.md` at creation time (same rule as `/create-task`: never hardcode).

---

## Architecture Design

### Design Philosophy

**Chosen Approach**: New agent + new command + new artifact, with minimal Supervisor modification.

**Rationale**: The Planner is a distinct role from all existing agents. It operates at the product level (roadmap, backlog, prioritization) while the project-manager operates at the task level (requirements for a single task). The consultation protocol is artifact-based (plan.md) to maintain clean context separation -- the Supervisor reads plan.md for guidance rather than spawning a Planner session.

**Evidence**:
- Agent separation pattern: `.claude/agents/project-manager.md` (task-level PM) vs new planner (product-level)
- Artifact-based communication: Supervisor already reads `registry.md` and `task.md` files for decision-making (`.claude/skills/auto-pilot/SKILL.md:179-204`)
- Command pattern: `.claude/commands/create-task.md` and `.claude/commands/auto-pilot.md` establish the format

---

## Component Specifications

### Component 1: Planner Agent Definition

**File**: `.claude/agents/planner.md` (CREATE)

**Purpose**: Define the Planner agent -- the strategic planning partner that sits between the Product Owner and the Supervisor. Owns the roadmap, creates well-scoped tasks, manages the backlog, and advises the Supervisor on what to execute next.

**Pattern**: Agent file format from `project-manager.md` (YAML frontmatter + markdown body).

**Evidence**: `.claude/agents/project-manager.md:1-4` (frontmatter format), `:6-50` (identity and principles), `:79-139` (protocol structure)

**Structure Specification**:

```
---
name: planner
description: >
  Strategic planning agent that sits between the Product Owner and the Supervisor.
  Use when: Planning new features, managing the product roadmap, creating well-scoped tasks,
  reprioritizing the backlog, onboarding new projects, or providing Supervisor consultation.
  Invoked via /plan command.
---
```

**Sections (in order)**:

1. **H1: Planner Agent**
   - One-paragraph identity statement: "You are the Planner -- the strategic planning partner..."
   - Distinction from project-manager (Planner = product-level roadmap/backlog; PM = individual task requirements)

2. **IMPORTANT: Absolute Paths Reminder**
   - Same pattern as all other agents

3. **Role and Identity**
   - Planner responsibilities enumerated:
     - Product-level planning and roadmap management
     - Discussion-based task creation with codebase analysis
     - Task sizing enforcement
     - Backlog prioritization and dependency management
     - Supervisor consultation via plan.md
     - Progress tracking and status reporting
   - What the Planner is NOT:
     - NOT the project-manager (does not write task-description.md)
     - NOT the Supervisor (does not manage workers, sessions, or MCP)
     - NOT a developer (does not write code)

4. **Knowledge Boundaries**
   - **Knows**: Product vision (from PO conversation), codebase structure (via file reading), strategic plan (plan.md), task registry (registry.md), task folders, task template format, orchestration workflow types and agent sequences
   - **Does NOT Know**: Worker health, session management, MCP internals, Supervisor loop mechanics, individual task implementation details, review findings or QA results

5. **Interaction Protocols**

   **5a. Product Owner Mode** (invoked via `/plan [intent]`):
   - Read plan.md (if exists) for roadmap context
   - Read registry.md for current task state
   - Read relevant codebase files for feasibility analysis
   - Engage in clarifying discussion (3-5 questions per round, grouped by category: scope, priority, constraints, success criteria)
   - Offer sensible defaults ("or I can use my judgment on this")
   - Propose task breakdown in summary table format:
     ```
     | # | Title | Type | Priority | Complexity | Dependencies |
     ```
   - Wait for explicit Product Owner approval before creating ANY tasks
   - On approval: create task folders, task.md files, registry entries, update plan.md

   **5b. Status Mode** (invoked via `/plan status`):
   - Read plan.md and registry.md
   - Refresh plan.md status fields from registry
   - Calculate progress per phase/milestone
   - Identify completed, in-progress, upcoming work
   - Report blockers needing PO attention
   - Detect orphan tasks (in registry but not in plan.md) and offer to incorporate

   **5c. Reprioritize Mode** (invoked via `/plan reprioritize`):
   - Read plan.md and registry.md
   - Present current ordering and priorities
   - Ask PO what changed (new priorities, dropped features, urgency shifts)
   - Propose updated priorities and ordering
   - On approval: update task.md priority fields and plan.md ordering

   **5d. Onboarding Mode** (invoked via `/plan` when no plan.md exists AND registry empty/no active tasks):
   - Guide PO through project definition (idea, scope, target users, constraints)
   - Read codebase to understand existing structure
   - Propose high-level architecture or technology approach (if greenfield)
   - Propose phased roadmap with milestones
   - Break first phase into concrete tasks
   - Wait for PO approval at each major decision point
   - Create plan.md, task folders, task.md files, registry entries

6. **Task Creation Rules**

   **6a. Template Compliance**:
   - ALWAYS read `task-tracking/task-template.md` at creation time (never hardcode)
   - Extract valid enum values for Type, Priority, Complexity from the template
   - Generate task.md conforming to template structure
   - Strip HTML guidance comments from output

   **6b. Task ID Generation** (same logic as `/create-task`):
   - Read registry.md
   - Find highest NNN for current year
   - Increment by 1, zero-pad to 3 digits
   - Format: `TASK_YYYY_NNN`

   **6c. Task Sizing Enforcement**:
   - Every task MUST be completable in a single worker session (Build Worker + Review Worker)
   - Indicators a task is TOO LARGE:
     - More than 5-7 files need creation or significant modification
     - Multiple unrelated functional areas are touched
     - Description exceeds what a PM can convert to requirements in one pass
     - Complexity is "Complex" AND scope spans multiple architectural layers
   - When a requirement is too large: break into multiple tasks with explicit dependencies
   - Each resulting task must be independently testable with clear input/output boundaries

   **6d. Dependency Management**:
   - Express dependencies using TASK_YYYY_NNN format
   - Include brief description of what each dependency provides
   - Validate no circular dependencies before creating
   - Order creation so foundational/independent tasks come first

   **6e. Registry Update**:
   - Add row per task: `| TASK_YYYY_NNN | CREATED | [Type] | [Description] | YYYY-MM-DD |`
   - Validate task IDs do not collide with existing entries

   **6f. Auto-Pilot Readiness Validation** (same checks as `/create-task` Step 5b):
   - Type: valid enum value
   - Priority: valid enum value
   - Description: at least 2 sentences
   - Acceptance Criteria: at least 1 criterion

7. **Plan Management Rules**

   **7a. plan.md Location**: `task-tracking/plan.md`

   **7b. Ownership**: ONLY the Planner writes to plan.md. Supervisor and workers MAY read, SHALL NOT write.

   **7c. Update Triggers**:
   - After creating new tasks -> add to appropriate phase in Task Map
   - After consultation resulting in priority changes -> update Current Focus and ordering
   - During `/plan status` -> refresh statuses from registry
   - During `/plan reprioritize` after approval -> update ordering and phase assignments

   **7d. Staleness Detection**: On every invocation, compare plan.md task statuses against registry.md. If discrepancies found, refresh plan.md silently.

8. **Supervisor Consultation Protocol**

   The Supervisor does NOT spawn the Planner. Instead, the Supervisor reads plan.md for strategic guidance. This section documents what the Supervisor reads and how it interprets the data, so the Planner knows what to write.

   **8a. What the Supervisor Reads**:
   - `plan.md` "Current Focus" section: which phase/milestone is active, what the next priorities are
   - `plan.md` "Task Map" section: expected ordering of tasks within the current phase

   **8b. How the Supervisor Uses It**:
   - After a worker completion, the Supervisor reads "Current Focus" to validate that the next task aligns with strategic direction
   - When multiple tasks have the same priority, the Supervisor uses plan.md ordering to break ties
   - If all planned tasks are blocked, the Supervisor logs the situation and continues with best available task

   **8c. Consultation Actions** (documented in plan.md for Supervisor reference):
   - PROCEED: Continue normal queue processing
   - REPRIORITIZE: Planner has updated priorities, Supervisor should re-read registry
   - ESCALATE: Needs Product Owner input, Supervisor should pause
   - NO_ACTION: Backlog drained or blocked

   **8d. What the Planner Writes for the Supervisor**:
   - Keep "Current Focus" section always up-to-date with the active phase/milestone and next priorities
   - Use clear, parseable language the Supervisor can act on without ambiguity

9. **Codebase Investigation Methodology**
   - Before proposing tasks, read relevant source files to understand patterns
   - Check for similar existing features that can be extended
   - Inform task scoping based on codebase reality
   - Use Glob, Grep, Read tools to investigate

10. **Orphan Task Detection**
    - On every invocation, check if registry contains tasks NOT referenced in plan.md
    - If found, inform PO and offer to incorporate them into the plan
    - This handles cases where tasks were created via `/create-task` outside the Planner flow

11. **Reliability: Interrupted Session Recovery**
    - On next invocation, check for orphaned state: task folder exists but no registry entry, or vice versa
    - Reconcile: if task folder has task.md but registry has no entry, add the registry entry
    - If registry has entry but task folder is missing, warn PO

12. **What You Never Do**
    - Access or reason about worker health, sessions, or MCP
    - Write task-description.md (that's the project-manager's job)
    - Write code or implement tasks
    - Modify Supervisor SKILL.md or orchestration SKILL.md
    - Create tasks without Product Owner approval
    - Hardcode template values (always read task-template.md)

13. **Pro Tips**
    - Ask clarifying questions before proposing -- better to ask than assume
    - Read codebase before scoping -- feasibility analysis prevents wasted sessions
    - Break large work into phases in plan.md, then create tasks only for the current phase
    - Keep plan.md concise -- it should fit in a single read without overwhelming context

**Quality Requirements**:
- Agent file follows YAML frontmatter format (verified from `project-manager.md:1-4`)
- All referenced files (plan.md, registry.md, task-template.md) are accessed via documented paths
- No overlap with project-manager responsibilities
- No knowledge of Supervisor internals (workers, MCP, sessions)

---

### Component 2: /plan Command

**File**: `.claude/commands/plan.md` (CREATE)

**Purpose**: Entry point command that invokes the Planner agent with the provided arguments and current project context.

**Pattern**: Command file format from `create-task.md` and `auto-pilot.md`.

**Evidence**: `.claude/commands/create-task.md:1-110` (structure), `.claude/commands/auto-pilot.md:1-138` (parameters table, mode handling)

**Structure Specification**:

```markdown
# Plan -- Strategic Planning with the Planner Agent

Start a planning conversation with the Planner agent. Discuss requirements,
create well-scoped tasks, manage the roadmap, and track progress.

## Usage

/plan [what you want]          # Start planning a new feature or body of work
/plan status                   # Get a progress assessment of the current plan
/plan reprioritize             # Review and reorder the backlog
/plan                          # Resume current planning context or start fresh

## Execution Steps

### Step 1: Load Planner Agent

Read `.claude/agents/planner.md` -- this contains the full Planner agent
definition, interaction protocols, task creation rules, and plan management rules.

### Step 2: Parse Arguments

Parse $ARGUMENTS for:
- `status` keyword -> status mode
- `reprioritize` keyword -> reprioritize mode
- Any other text -> new planning conversation with that text as intent
- Empty -> detect mode (onboarding if no plan.md, otherwise resume)

### Step 3: Pre-Flight Checks

3a. Verify `task-tracking/` directory exists.
    If missing: ERROR -- "Workspace not initialized. Run /initialize-workspace first."

3b. Verify `task-tracking/registry.md` exists.
    If missing: ERROR -- "Registry not found. Run /initialize-workspace first."

3c. Verify `task-tracking/task-template.md` exists.
    If missing: ERROR -- "Task template not found. Run /initialize-workspace first."

### Step 4: Detect Mode

IF $ARGUMENTS == "status":
  -> Status mode (Planner protocol 5b)

IF $ARGUMENTS == "reprioritize":
  -> Reprioritize mode (Planner protocol 5c)

IF $ARGUMENTS is non-empty text (not "status" or "reprioritize"):
  -> New planning conversation (Planner protocol 5a) with $ARGUMENTS as the user's intent

IF $ARGUMENTS is empty:
  IF `task-tracking/plan.md` does NOT exist AND registry has no active tasks:
    -> Onboarding mode (Planner protocol 5d)
  ELSE:
    -> Resume: Read plan.md, present current state, ask PO what they'd like to work on next

### Step 5: Execute Mode

Follow the appropriate Planner interaction protocol as determined in Step 4.
The Planner agent definition contains the full flow for each mode.

## Important Rules

1. ALWAYS read `planner.md` first -- never bypass the agent definition
2. ALWAYS read `task-template.md` before creating any tasks -- never hardcode template structure
3. ALWAYS read `registry.md` to determine next task ID -- never guess
4. NEVER create tasks without Product Owner approval -- always present and wait
5. NEVER modify plan.md ownership -- only the Planner writes to plan.md
6. Pre-flight check: verify task-tracking/, registry.md, and task-template.md exist

## References

- Planner agent: `.claude/agents/planner.md`
- Task template: `task-tracking/task-template.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`
- Template guide: `docs/task-template-guide.md`
```

**Quality Requirements**:
- Command file follows established format (Usage, Execution Steps, Important Rules, References)
- All 4 modes are handled (new, status, reprioritize, onboarding/resume)
- Pre-flight checks match `/create-task` pattern

---

### Component 3: plan.md Format Specification

**File**: `task-tracking/plan.md` (CREATE -- created by the Planner during first invocation, not pre-created)

**Purpose**: Strategic roadmap document. Single source of truth for strategic direction (phases, milestones, ordering, decisions). The Planner creates this during onboarding or first `/plan` invocation.

**Note**: This is NOT a file to be created during implementation. This section specifies the FORMAT that the Planner agent must produce. The format specification is embedded in the Planner agent definition (Component 1, Section 7).

**Format Specification**:

```markdown
# Project Plan

## Project Overview

[One-paragraph description of the product/project, its goals, and target users.]

## Phases

### Phase 1: [Phase Name]
**Status**: [NOT STARTED | IN PROGRESS | COMPLETE]
**Description**: [What this phase delivers]

#### Milestones
- [ ] [Milestone 1 -- target completion criteria]
- [ ] [Milestone 2 -- target completion criteria]

#### Task Map
| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK_YYYY_NNN | [Title] | [Status from registry] | [Priority] |

### Phase 2: [Phase Name]
...

## Current Focus

**Active Phase**: Phase N -- [Phase Name]
**Active Milestone**: [Current milestone]
**Next Priorities**:
1. [Next task or action -- TASK_YYYY_NNN if applicable]
2. [Following task or action]
3. [Third priority]

**Supervisor Guidance**: [PROCEED | REPRIORITIZE | ESCALATE | NO_ACTION]
**Guidance Note**: [Brief explanation for the Supervisor]

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| YYYY-MM-DD | [Decision made] | [Why this was decided] |
```

**Design Decisions**:
- "Current Focus" section is the primary Supervisor consultation interface
- "Supervisor Guidance" field provides the action recommendation the Supervisor reads
- Task statuses in Task Map are informational (registry is authoritative)
- Decisions Log provides traceability for architectural and product decisions
- Phases are ordered sequentially; the Planner creates tasks only for the active phase (keeps backlog manageable)
- Supports up to 50 tasks across multiple phases per scalability requirement

**Quality Requirements**:
- Format must be parseable by the Supervisor (clear section headers, consistent table format)
- "Current Focus" must always be present and up-to-date
- Task IDs must match registry entries

---

### Component 4: Supervisor SKILL.md Consultation Integration

**File**: `.claude/skills/auto-pilot/SKILL.md` (MODIFY)

**Purpose**: Add minimal consultation protocol so the Supervisor reads plan.md for strategic guidance when making task ordering decisions.

**Evidence**: Current Step 4 (`.claude/skills/auto-pilot/SKILL.md:238-251`) orders tasks by Priority then Task ID. The consultation protocol adds a plan.md check between Steps 3 and 4.

**Modification Specification**:

Add a new step **Step 3b: Check Strategic Plan (Optional)** between Step 3 (Build Dependency Graph) and Step 4 (Order Task Queue):

```markdown
### Step 3b: Check Strategic Plan (Optional)

IF `task-tracking/plan.md` exists:

1. Read the "Current Focus" section of plan.md.
2. Extract:
   - **Active Phase**: Which phase is currently active
   - **Next Priorities**: Ordered list of next tasks/actions
   - **Supervisor Guidance**: PROCEED | REPRIORITIZE | ESCALATE | NO_ACTION

3. Apply guidance:

   | Guidance | Supervisor Action |
   |----------|-------------------|
   | **PROCEED** | Continue to Step 4 with normal ordering. Use plan.md "Next Priorities" to break ties when multiple tasks share the same priority level. |
   | **REPRIORITIZE** | Re-read registry.md (Planner may have updated priorities). Then continue to Step 4. |
   | **ESCALATE** | Read "Guidance Note" for what the PO needs to decide. Log: `"PLAN ESCALATION — {note}. Continuing with best available task."` Continue to Step 4 (do not stop the loop — process what's available). |
   | **NO_ACTION** | Log: `"PLAN — no action needed"`. Continue to Step 4. |

4. **Plan-aware tie-breaking**: When Step 4 sorts tasks and multiple tasks share the same priority level, use the order from plan.md "Next Priorities" list to determine which goes first. If a task is not listed in plan.md, it goes after listed tasks.

IF `task-tracking/plan.md` does NOT exist:
- Continue to Step 4 with default ordering (Priority then Task ID). No consultation needed.
```

**Additional Modification -- Session Log Events**:

Add to the Session Log events table:

```markdown
| Plan consultation | `[HH:MM:SS] PLAN CONSULT — guidance: {PROCEED|REPRIORITIZE|ESCALATE|NO_ACTION}` |
| Plan escalation | `[HH:MM:SS] PLAN ESCALATION — {guidance_note}` |
| Plan not found | `[HH:MM:SS] PLAN — no plan.md found, using default ordering` |
```

**Scope of Changes**:
- Insert new Step 3b section (approximately 25 lines of markdown)
- Add 3 rows to Session Log events table
- NO changes to worker prompts, spawn logic, monitoring, or completion handling
- The consultation is entirely optional (gracefully skipped if no plan.md exists)

**Quality Requirements**:
- Consultation is read-only (Supervisor NEVER writes to plan.md)
- Graceful degradation when plan.md doesn't exist
- No impact on existing Supervisor behavior when plan.md is absent
- ESCALATE does not halt the loop (logs and continues)

---

## Integration Architecture

### Data Flow

```
Product Owner
    |
    | /plan [intent]
    v
Planner Agent (in PO's session)
    |
    |-- reads --> codebase files (Glob, Grep, Read)
    |-- reads --> task-tracking/registry.md
    |-- reads --> task-tracking/task-template.md
    |-- reads --> task-tracking/plan.md (if exists)
    |
    |-- writes --> task-tracking/plan.md (create/update)
    |-- writes --> task-tracking/TASK_YYYY_NNN/task.md (per task created)
    |-- writes --> task-tracking/registry.md (new CREATED rows)
    |
    v
Supervisor (in its own session via /auto-pilot)
    |
    |-- reads --> task-tracking/plan.md (Step 3b consultation)
    |-- reads --> task-tracking/registry.md (Steps 2, 3, 4)
    |-- reads --> task-tracking/TASK_YYYY_NNN/task.md (Step 2)
    |
    v
Workers (spawned by Supervisor)
    |-- NO knowledge of plan.md or Planner
```

### Dependencies

- **External**: None (all components are markdown files within the project)
- **Internal**:
  - Planner agent depends on: task-template.md, registry.md, plan.md format
  - /plan command depends on: planner.md agent definition
  - Supervisor Step 3b depends on: plan.md "Current Focus" section format

### Source of Truth Boundaries

| Artifact | Source of Truth For | Owner |
|----------|-------------------|-------|
| `plan.md` | Strategic direction, phases, milestones, ordering, decisions | Planner |
| `registry.md` | Task status (CREATED, IN_PROGRESS, IMPLEMENTED, etc.) | Workers + Supervisor |
| `task.md` | Individual task definition (type, priority, description, criteria) | Planner (creation), PO (edits) |
| `task-template.md` | Task file structure and valid field values | System (static) |

---

## Quality Requirements (Architecture-Level)

### Context Separation (Non-Functional)
- Planner session: knows product, codebase, plan. Does NOT access worker health, MCP, sessions.
- Supervisor session: reads plan.md for guidance. Does NOT invoke Planner as sub-agent.
- Worker sessions: do NOT know about plan.md or Planner.

### Template Compliance (Non-Functional)
- All tasks created by Planner conform to `task-template.md`
- Valid enum values extracted from template at creation time (never hardcoded)

### Scalability (Non-Functional)
- plan.md supports up to 50 tasks across multiple phases
- Planner handles incremental planning (add to existing plan without regeneration)

### Reliability (Non-Functional)
- Interrupted Planner sessions produce detectable orphan state (reconcilable on next invocation)
- Task ID collision validation before creation

---

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: backend-developer
**Rationale**: All deliverables are markdown files (agent definition, command definition, SKILL.md modification). No frontend code, no application logic. The work is primarily technical writing with precise structure requirements. A backend developer can handle the file creation and the surgical SKILL.md modification.

### Complexity Assessment

**Complexity**: MEDIUM
**Estimated Effort**: 3-5 hours

The work is:
- 1 new agent file (~300-400 lines of structured markdown)
- 1 new command file (~80-100 lines of structured markdown)
- 1 surgical modification to SKILL.md (~30 lines inserted + 3 table rows)
- No code, no tests, no builds

### Files Affected Summary

**CREATE**:
- `.claude/agents/planner.md` -- Planner agent definition
- `.claude/commands/plan.md` -- /plan command definition

**MODIFY**:
- `.claude/skills/auto-pilot/SKILL.md` -- Add Step 3b (plan consultation) + 3 session log event types

**NO CHANGE** (confirmed):
- `.claude/commands/create-task.md` -- stays as-is for programmatic use
- `.claude/skills/orchestration/SKILL.md` -- does not need to know about the Planner
- `task-tracking/task-template.md` -- no changes needed
- `task-tracking/registry.md` -- no structural changes (Planner follows existing format)

**NOT CREATED DURING IMPLEMENTATION** (created at runtime by the Planner):
- `task-tracking/plan.md` -- created by the Planner agent during first `/plan` invocation

### Architecture Delivery Checklist

- [x] All components specified with evidence (agent format from project-manager.md, command format from create-task.md, Supervisor pattern from SKILL.md)
- [x] All patterns verified from codebase (YAML frontmatter, step-based commands, registry format)
- [x] All referenced files verified as existing (task-template.md, registry.md, SKILL.md, project-manager.md)
- [x] Quality requirements defined (context separation, template compliance, scalability, reliability)
- [x] Integration points documented (plan.md as consultation interface, registry as shared state)
- [x] Files affected list complete (2 CREATE, 1 MODIFY)
- [x] Developer type recommended (backend-developer)
- [x] Complexity assessed (MEDIUM, 3-5 hours)
- [x] No step-by-step implementation (component specifications only)

---

## Verification Plan

After implementation, verify each acceptance criterion with these checks:

| Acceptance Criterion | Verification |
|---------------------|-------------|
| Planner agent definition created | `Glob(.claude/agents/planner.md)` -- file exists |
| Planner follows agent format | `Grep("^---" in .claude/agents/planner.md)` -- has YAML frontmatter |
| /plan command created | `Glob(.claude/commands/plan.md)` -- file exists |
| /plan follows command format | `Grep("## Usage" in .claude/commands/plan.md)` AND `Grep("## Execution Steps" in .claude/commands/plan.md)` |
| plan.md format defined | `Grep("Current Focus" in .claude/agents/planner.md)` AND `Grep("Task Map" in .claude/agents/planner.md)` -- format spec in agent |
| All 4 modes supported | `Grep("status" in .claude/commands/plan.md)` AND `Grep("reprioritize" in .claude/commands/plan.md)` AND `Grep("onboarding" in .claude/commands/plan.md)` |
| Task sizing enforcement | `Grep("5-7 files" in .claude/agents/planner.md)` -- sizing heuristics present |
| Dependency management | `Grep("circular" in .claude/agents/planner.md)` -- cycle detection rule present |
| Supervisor consultation | `Grep("Step 3b" in .claude/skills/auto-pilot/SKILL.md)` -- consultation step added |
| plan.md ownership | `Grep("ONLY the Planner" in .claude/agents/planner.md)` -- ownership rule present |
| /create-task unchanged | `Grep("Step 1: Read Template" in .claude/commands/create-task.md)` -- original content preserved |
| Knowledge boundaries | `Grep("Does NOT Know" in .claude/agents/planner.md)` -- boundaries documented |
| Template compliance | `Grep("task-template.md" in .claude/agents/planner.md)` -- template reading rule present |
| Auto-pilot readiness | `Grep("2 sentences" in .claude/agents/planner.md)` -- validation checks present |
