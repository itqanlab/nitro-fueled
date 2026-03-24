# Requirements Document - TASK_2026_004

## Introduction

The Nitro-Fueled orchestration system currently lacks a planning layer between the Product Owner (user) and the Supervisor. Today, the user fills in a form via `/create-task`, and the Supervisor processes whatever it finds in the registry. This creates several problems: tasks are often too large for a single worker session (leading to context overflow and dropped steps), there is no strategic roadmap (just a flat list), no one validates task feasibility against the codebase before creation, no dynamic reprioritization as work progresses, and the Supervisor makes planning decisions it should not own.

The Planner agent solves this by introducing an intelligent planning layer that understands both the product (what the user wants) and the codebase (what exists), and produces right-sized, well-ordered tasks organized under a strategic roadmap.

**Key distinction**: The Planner is a NEW agent, separate from the existing `project-manager` agent. The project-manager writes detailed requirements for individual tasks inside worker sessions (producing `task-description.md`). The Planner operates at a higher level -- it manages the whole product: roadmap, task creation, backlog ordering, and prioritization. They never overlap in scope.

**Value proposition**: With the Planner in place, the Product Owner can describe what they want in natural language, have a discussion about scope and feasibility, and get a well-structured set of right-sized tasks with proper dependencies and ordering -- all informed by actual codebase analysis.

### Dependencies

- TASK_2026_003 (Supervisor Architecture) -- COMPLETE. The Planner must integrate with the Supervisor's consultation protocol, state model, and registry conventions established in that task.

---

## Requirements

### Requirement 1: Planner Agent Definition

**User Story:** As a Product Owner using the Nitro-Fueled orchestration system, I want a dedicated Planner agent that understands my product goals and the codebase, so that I get well-scoped, properly ordered tasks without needing to understand the orchestration internals.

#### 1.1 Agent File

1. WHEN the Planner agent is defined THEN it SHALL be created as `.claude/agents/planner.md` following the established agent file format (YAML frontmatter with `name` and `description`, followed by markdown body).
2. WHEN the Planner agent file is structured THEN it SHALL include the following sections:
   - Role description and identity (the Planner, not a PM or Supervisor)
   - Knowledge boundaries (what it knows, what it does not know)
   - Interaction protocols (Product Owner mode, Supervisor consultation mode)
   - Task creation rules (sizing, dependencies, template compliance)
   - Plan management rules (plan.md format, update triggers)
   - Codebase investigation methodology

#### 1.2 Role and Identity

1. WHEN the Planner is described THEN its role SHALL be: "Strategic planning agent that sits between the Product Owner and the Supervisor. Owns the roadmap, creates well-scoped tasks, manages the backlog, and advises the Supervisor on what to execute next."
2. WHEN the Planner operates THEN it SHALL behave as a collaborative planning partner -- asking questions, proposing options, and seeking approval -- not as an autonomous executor.
3. WHEN the Planner is compared to the project-manager THEN the separation SHALL be:
   - **Planner**: Owns the product-level plan. Creates tasks. Manages backlog priority. Advises Supervisor. Runs in its own session via `/plan`.
   - **Project-manager**: Owns individual task requirements. Produces `task-description.md` inside worker sessions. Invoked by the orchestration skill during task execution.

#### 1.3 Knowledge Boundaries

1. WHEN the Planner operates THEN it SHALL have knowledge of:
   - The product vision and goals (gathered from Product Owner conversation)
   - The codebase structure and existing implementations (via file reading)
   - The strategic plan (`task-tracking/plan.md`)
   - The task registry (`task-tracking/registry.md`) and task folders
   - The task template format (`task-tracking/task-template.md`)
   - Orchestration workflow types and agent sequences (what each task type triggers)
2. WHEN the Planner operates THEN it SHALL NOT have knowledge of:
   - Worker health, session management, or MCP internals
   - Supervisor loop mechanics (concurrency, monitoring intervals, retry logic)
   - Individual task implementation details (code written by developers)
   - Review findings or QA results (those belong to the worker pipeline)

#### Acceptance Criteria

```gherkin
Feature: Planner Agent Definition
  As a Product Owner
  I want a well-defined Planner agent
  So that I have a dedicated planning partner for my project

  Scenario: Agent file exists and follows conventions
    Given the .claude/agents/ directory contains existing agent definitions
    When the Planner agent is created
    Then a file named planner.md SHALL exist in .claude/agents/
    And it SHALL have YAML frontmatter with name and description fields
    And the body SHALL follow the established agent markdown structure

  Scenario: Planner knows its boundaries
    Given the Planner is invoked
    When it needs information about worker health or session management
    Then it SHALL NOT attempt to access or reason about those concerns
    And it SHALL focus only on product planning, codebase analysis, and task creation

  Scenario: Planner and project-manager do not overlap
    Given both agents exist in the system
    When a task goes through the orchestration pipeline
    Then the Planner SHALL have created the task.md file
    And the project-manager SHALL create the task-description.md file
    And neither agent SHALL perform the other's responsibilities
```

---

### Requirement 2: /plan Command

**User Story:** As a Product Owner using the Nitro-Fueled orchestration system, I want a `/plan` command that starts a planning conversation with the Planner agent, so that I can describe what I want and get well-structured tasks created through discussion.

#### 2.1 Command File

1. WHEN the /plan command is defined THEN it SHALL be created as `.claude/commands/plan.md` following the established command file format.
2. WHEN the /plan command is invoked THEN it SHALL invoke the Planner agent with the provided arguments and current project context.

#### 2.2 Command Format

1. WHEN the user runs `/plan` THEN the command SHALL support these invocation patterns:
   - `/plan [what they want]` -- Start a planning conversation about a new feature or body of work
   - `/plan status` -- Get a progress assessment of the current plan
   - `/plan reprioritize` -- Review and reorder the backlog based on current state
   - `/plan` (no arguments) -- Resume the current planning context or start fresh if none exists

#### 2.3 Execution Flow

1. WHEN `/plan [what they want]` is invoked THEN the Planner SHALL:
   a. Read the current plan.md (if it exists) to understand existing roadmap context
   b. Read the registry to understand current task state
   c. Read relevant codebase files to understand what exists
   d. Engage the Product Owner in a clarifying discussion (ask questions about scope, priorities, constraints)
   e. Propose a breakdown of the work into tasks
   f. Wait for Product Owner approval before creating any tasks
   g. Upon approval, create task folders, task.md files, and registry entries
   h. Update plan.md to reflect the new work

2. WHEN `/plan status` is invoked THEN the Planner SHALL:
   a. Read plan.md and registry.md
   b. Calculate progress percentages per phase/milestone
   c. Identify completed work, in-progress work, and upcoming work
   d. Report any blockers that need Product Owner attention
   e. Present a concise progress summary

3. WHEN `/plan reprioritize` is invoked THEN the Planner SHALL:
   a. Read plan.md and registry.md
   b. Present current task ordering and priorities
   c. Ask the Product Owner what has changed (new priorities, dropped features, urgency shifts)
   d. Propose updated priorities and ordering
   e. Upon approval, update task.md priority fields and plan.md ordering

#### 2.4 New Project Onboarding Mode

1. WHEN `/plan` is invoked and no plan.md exists AND the registry is empty or has no active tasks THEN the Planner SHALL enter onboarding mode:
   a. Ask the Product Owner to describe the project/product idea
   b. Ask clarifying questions about scope, target users, technical constraints
   c. Read the codebase to understand existing structure (if any)
   d. Propose a high-level architecture or technology approach (if greenfield)
   e. Propose a phased roadmap with milestones
   f. Break the first phase into concrete tasks
   g. Wait for Product Owner approval at each major decision point
   h. Create plan.md, task folders, task.md files, and registry entries

#### Acceptance Criteria

```gherkin
Feature: /plan Command
  As a Product Owner
  I want a /plan command
  So that I can start planning conversations with the Planner agent

  Scenario: Plan a new feature
    Given the project has an existing plan.md and registry
    When the user runs /plan add user authentication
    Then the Planner SHALL read plan.md and registry.md for context
    And the Planner SHALL read relevant codebase files
    And the Planner SHALL ask clarifying questions about scope and requirements
    And the Planner SHALL propose a task breakdown
    And the Planner SHALL wait for Product Owner approval before creating tasks

  Scenario: Check plan status
    Given the project has tasks in various states in the registry
    When the user runs /plan status
    Then the Planner SHALL present progress per phase/milestone
    And the Planner SHALL identify blockers needing attention
    And the Planner SHALL show completed vs remaining work

  Scenario: Reprioritize the backlog
    Given the project has multiple CREATED tasks in the registry
    When the user runs /plan reprioritize
    Then the Planner SHALL present current priorities
    And the Planner SHALL ask what has changed
    And the Planner SHALL propose updated ordering
    And the Planner SHALL update task priorities only after approval

  Scenario: New project onboarding
    Given no plan.md exists and the registry has no active tasks
    When the user runs /plan
    Then the Planner SHALL enter onboarding mode
    And the Planner SHALL guide the Product Owner through project definition
    And the Planner SHALL produce plan.md and initial tasks upon approval

  Scenario: Command file follows conventions
    Given the .claude/commands/ directory contains existing commands
    When the /plan command is created
    Then a file named plan.md SHALL exist in .claude/commands/
    And it SHALL follow the established command file structure
```

---

### Requirement 3: plan.md Format and Management

**User Story:** As a Product Owner using the Nitro-Fueled orchestration system, I want a strategic roadmap document (plan.md) that shows the big picture of my project, so that I can see phases, milestones, progress, and what is coming next without digging through individual tasks.

#### 3.1 File Location and Ownership

1. WHEN plan.md is created THEN it SHALL live at `task-tracking/plan.md`.
2. WHEN plan.md is modified THEN ONLY the Planner agent SHALL modify it (not the Supervisor, not workers, not other agents).
3. WHEN plan.md is read THEN the Supervisor and other agents MAY read it for context, but SHALL NOT write to it.

#### 3.2 Document Structure

1. WHEN plan.md is structured THEN it SHALL contain the following sections:

   - **Project Overview**: One-paragraph description of the product/project, its goals, and target users.
   - **Phases**: Ordered list of development phases, each with a name, description, and status (NOT STARTED, IN PROGRESS, COMPLETE).
   - **Milestones**: Key deliverables within each phase, with target completion criteria.
   - **Task Map**: For each phase, a list of task IDs with brief descriptions and their current registry status. This is a reference view -- the registry remains the source of truth for task status.
   - **Current Focus**: Which phase/milestone is active and what the next priorities are.
   - **Decisions Log**: Key architectural or product decisions made during planning conversations, with date and rationale.

2. WHEN plan.md references tasks THEN it SHALL use task IDs (TASK_YYYY_NNN format) that correspond to entries in registry.md.

#### 3.3 Relationship to registry.md

1. WHEN plan.md and registry.md coexist THEN:
   - **registry.md** SHALL remain the single source of truth for task status (CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED).
   - **plan.md** SHALL be the single source of truth for strategic direction (phases, milestones, priorities, ordering).
   - plan.md MAY reflect task statuses for convenience, but these are read from the registry and are informational, not authoritative.

#### 3.4 Update Triggers

1. WHEN the Planner creates new tasks THEN it SHALL update plan.md to include the new tasks under the appropriate phase.
2. WHEN the Supervisor consults the Planner (consultation protocol) THEN the Planner SHALL update plan.md if the consultation results in priority changes or phase transitions.
3. WHEN the Product Owner runs `/plan status` THEN the Planner SHALL refresh the status fields in plan.md from the registry before presenting the report.
4. WHEN the Product Owner runs `/plan reprioritize` and approves changes THEN the Planner SHALL update plan.md ordering and phase assignments.

#### Acceptance Criteria

```gherkin
Feature: plan.md Roadmap Document
  As a Product Owner
  I want a strategic roadmap in plan.md
  So that I can see the big picture of my project

  Scenario: plan.md is created during onboarding
    Given the user has completed a new project onboarding conversation
    When the Planner creates the initial plan
    Then plan.md SHALL exist at task-tracking/plan.md
    And it SHALL contain Project Overview, Phases, Milestones, Task Map, Current Focus, and Decisions Log sections

  Scenario: plan.md reflects current state
    Given tasks have been created and some are COMPLETE in the registry
    When the Planner reads plan.md for a status report
    Then the Task Map section SHALL show current statuses pulled from registry.md
    And phase statuses SHALL reflect whether all tasks in that phase are complete

  Scenario: plan.md and registry.md do not conflict
    Given both plan.md and registry.md exist
    When a task status changes in the registry
    Then registry.md SHALL be authoritative for task status
    And plan.md task status references SHALL be informational only

  Scenario: Only the Planner writes to plan.md
    Given the Supervisor or a worker agent needs roadmap context
    When they access plan.md
    Then they SHALL read it for context
    And they SHALL NOT modify it
```

---

### Requirement 4: Task Creation Flow

**User Story:** As a Product Owner using the Nitro-Fueled orchestration system, I want the Planner to create tasks through a collaborative discussion informed by codebase analysis, so that tasks are well-scoped, feasible, and right-sized for worker sessions.

#### 4.1 Discussion-Based Task Creation

1. WHEN the Product Owner describes what they want THEN the Planner SHALL:
   a. Ask clarifying questions about scope, priority, and success criteria before proposing tasks
   b. Read relevant codebase files to understand existing implementations, patterns, and constraints
   c. Check for similar existing features that can be extended rather than rebuilt
   d. Propose a task breakdown with rationale for why each task is a separate unit of work

2. WHEN the Planner proposes tasks THEN it SHALL present them to the Product Owner for approval, including:
   - Task title and brief description
   - Type classification (FEATURE, BUGFIX, REFACTORING, etc.)
   - Proposed priority
   - Estimated complexity (Simple, Medium, Complex)
   - Dependencies on other tasks
   - Key acceptance criteria
   - Rationale for the scoping decisions

3. WHEN the Product Owner approves the proposed tasks THEN the Planner SHALL create them. WHEN the Product Owner requests changes THEN the Planner SHALL revise the proposal and re-present.

#### 4.2 Task Template Compliance

1. WHEN the Planner creates a task THEN it SHALL:
   a. Read `task-tracking/task-template.md` as the source of truth for task structure
   b. Generate a `task.md` file that conforms to the template format
   c. Include all required fields: Type, Priority, Complexity, Description, Dependencies, Acceptance Criteria, References
   d. Strip HTML guidance comments from the output (as `/create-task` does)

2. WHEN the Planner creates a task folder THEN it SHALL:
   a. Determine the next task ID by reading registry.md (same logic as `/create-task` Step 2)
   b. Create directory `task-tracking/TASK_YYYY_NNN/`
   c. Write `task-tracking/TASK_YYYY_NNN/task.md`
   d. Add a registry entry with status CREATED

#### 4.3 Task Sizing Enforcement

1. WHEN the Planner evaluates a unit of work THEN it SHALL assess whether it can be completed in a single worker session (Build Worker + Review Worker).
2. WHEN a requirement is too large for a single worker session THEN the Planner SHALL break it into multiple tasks with proper dependencies and ordering. Indicators that a task is too large:
   - More than 5-7 files need to be created or significantly modified
   - Multiple unrelated functional areas are touched
   - The description exceeds what a PM agent can convert to requirements in a single pass
   - The complexity assessment would be "Complex" AND the scope spans multiple architectural layers
3. WHEN the Planner breaks a large requirement into tasks THEN each resulting task SHALL:
   - Be independently testable and verifiable
   - Have clear input/output boundaries (what it receives from predecessor tasks, what it produces for successor tasks)
   - Be scoped to a single functional area or architectural layer where possible
   - Have explicit dependencies on predecessor tasks using TASK_YYYY_NNN format

#### 4.4 Dependency Management

1. WHEN the Planner creates tasks with dependencies THEN it SHALL:
   a. Express dependencies using TASK_YYYY_NNN format in the Dependencies section
   b. Ensure no circular dependencies exist in the created task set
   c. Order task creation so that independent/foundational tasks come first
   d. Include a brief description of what each dependency provides (e.g., "TASK_2026_005 -- provides the database schema this task reads from")

#### 4.5 Relationship to /create-task

1. WHEN the Planner-based flow is available THEN `/create-task` SHALL remain available for programmatic and internal use (e.g., the Supervisor creating a follow-up task, or automated tooling).
2. WHEN the Product Owner wants to create tasks THEN the recommended path SHALL be `/plan`, not `/create-task`. The `/plan` command provides discussion, codebase analysis, and sizing validation that `/create-task` does not.

#### Acceptance Criteria

```gherkin
Feature: Task Creation Flow
  As a Product Owner
  I want discussion-based task creation
  So that tasks are well-scoped and feasible

  Scenario: Planner asks clarifying questions
    Given the user says "I want to add user authentication"
    When the Planner begins planning
    Then it SHALL ask clarifying questions about scope, auth method, and requirements
    And it SHALL NOT create tasks until the discussion produces clear scope

  Scenario: Planner reads codebase for feasibility
    Given the user requests a feature
    When the Planner analyzes feasibility
    Then it SHALL read relevant source files to understand existing patterns
    And it SHALL inform its task breakdown based on codebase reality

  Scenario: Planner enforces task sizing
    Given the user describes a large feature spanning multiple layers
    When the Planner proposes tasks
    Then no single task SHALL span more than one architectural layer unnecessarily
    And each task SHALL be independently testable
    And complex multi-layer work SHALL be broken into dependent tasks

  Scenario: Planner creates compliant task files
    Given the Planner has received approval for a set of tasks
    When it creates the tasks
    Then each task folder SHALL contain a task.md conforming to task-template.md
    And each task SHALL have a corresponding CREATED entry in registry.md
    And task IDs SHALL follow the TASK_YYYY_NNN sequential format

  Scenario: Planner sets proper dependencies
    Given the Planner creates a set of related tasks
    When dependencies exist between them
    Then the Dependencies field SHALL reference specific TASK_YYYY_NNN IDs
    And no circular dependencies SHALL exist
    And each dependency SHALL include a brief description of what it provides

  Scenario: Product Owner approval gate
    Given the Planner has proposed a task breakdown
    When presenting to the Product Owner
    Then it SHALL show title, type, priority, complexity, dependencies, and acceptance criteria for each task
    And it SHALL NOT create tasks until the Product Owner explicitly approves
```

---

### Requirement 5: Supervisor Consultation Protocol

**User Story:** As the Supervisor processing a task backlog, I want to consult the Planner for guidance on what to do next, so that task execution follows the strategic plan rather than just processing whatever is in the queue.

#### 5.1 Consultation Trigger

1. WHEN the Supervisor completes processing a worker (Build Worker finishes or Review Worker finishes) THEN it MAY consult the Planner before spawning the next worker.
2. WHEN the Supervisor finds no READY_FOR_BUILD or READY_FOR_REVIEW tasks but has CREATED tasks with unmet dependencies THEN it MAY consult the Planner to determine if reprioritization is needed.
3. WHEN the Supervisor detects that a task has been BLOCKED after max retries THEN it MAY consult the Planner for guidance on whether to skip, rescope, or escalate to the Product Owner.

#### 5.2 Consultation Input (Supervisor to Planner)

1. WHEN the Supervisor consults the Planner THEN it SHALL provide:
   - Current registry state (full registry.md contents or a summary of task statuses)
   - The specific trigger for consultation (worker completed, no tasks available, task blocked)
   - Identity of the task that just completed or failed (if applicable)
   - Current active worker count and concurrency capacity

#### 5.3 Consultation Output (Planner to Supervisor)

1. WHEN the Planner responds to a consultation THEN it SHALL return a structured recommendation containing:
   - **Action**: One of: PROCEED (continue normal queue processing), REPRIORITIZE (Planner has updated priorities, re-read registry), ESCALATE (needs Product Owner input, pause processing), NO_ACTION (nothing to do, backlog is drained or blocked)
   - **Rationale**: Brief explanation of why this action is recommended
   - **Updated tasks** (if any): List of task IDs whose priority or status was changed
   - **Message for Product Owner** (if ESCALATE): What the Product Owner needs to decide

#### 5.4 Consultation Mechanism

1. WHEN the Supervisor needs to consult the Planner THEN the consultation SHALL happen within the Supervisor's session context (the Supervisor reads plan.md and applies Planner-defined rules, rather than spawning a separate Planner session).
2. WHEN the consultation protocol is defined THEN it SHALL be documented in the Planner agent definition so the Supervisor knows what to read and how to interpret it.
3. WHEN plan.md contains a "Current Focus" section THEN the Supervisor SHALL use it to validate that the next task it would spawn aligns with the current strategic focus.

#### Acceptance Criteria

```gherkin
Feature: Supervisor Consultation Protocol
  As the Supervisor
  I want to consult the Planner for guidance
  So that task execution follows the strategic plan

  Scenario: Supervisor consults after worker completion
    Given a Build Worker has completed and the task is now IMPLEMENTED
    When the Supervisor consults the Planner
    Then it SHALL provide current registry state and completion details
    And the Planner SHALL return a structured recommendation (PROCEED, REPRIORITIZE, ESCALATE, or NO_ACTION)

  Scenario: Supervisor consults when backlog is stuck
    Given all remaining tasks have unmet dependencies
    When the Supervisor consults the Planner
    Then the Planner SHALL assess whether reprioritization can unblock tasks
    And if not, the Planner SHALL recommend ESCALATE with a message for the Product Owner

  Scenario: Supervisor consults after task failure
    Given a task has been BLOCKED after max retries
    When the Supervisor consults the Planner
    Then the Planner SHALL advise on whether to skip, rescope, or escalate

  Scenario: Consultation does not spawn a separate session
    Given the Supervisor needs Planner guidance
    When the consultation happens
    Then it SHALL occur within the Supervisor's session by reading plan.md
    And it SHALL NOT require spawning a new MCP worker session
```

---

### Requirement 6: Interaction Model

**User Story:** As a participant in the Nitro-Fueled orchestration system (Product Owner, Planner, or Supervisor), I want clearly defined communication patterns, so that information flows correctly between all parties without confusion or duplication.

#### 6.1 Product Owner to Planner Communication

1. WHEN the Product Owner interacts with the Planner THEN the communication pattern SHALL be:
   - Product Owner runs `/plan [intent]`
   - Planner asks clarifying questions (conversational, multi-turn)
   - Planner proposes plan/tasks (structured output)
   - Product Owner approves, rejects, or modifies (conversational)
   - Planner executes approved actions (creates files, updates registry)

2. WHEN the Planner asks clarifying questions THEN it SHALL:
   - Group questions by category (scope, priority, constraints, success criteria)
   - Provide context for why each question matters
   - Offer sensible defaults the Product Owner can accept ("or I can use my judgment on this")
   - Limit to 3-5 questions per round to avoid overwhelming the user

3. WHEN the Planner proposes tasks THEN the output format SHALL be a clear summary table followed by details:
   - Summary table: Task ID (proposed), Title, Type, Priority, Complexity, Dependencies
   - Per-task details: Description, Acceptance Criteria, Rationale

#### 6.2 Planner to Registry/Task-Tracking Output

1. WHEN the Planner creates artifacts THEN the output SHALL be:
   - `task-tracking/plan.md` -- Strategic roadmap (Planner-owned)
   - `task-tracking/TASK_YYYY_NNN/task.md` -- Individual task definitions (per task created)
   - `task-tracking/registry.md` -- New rows with status CREATED (appended)

2. WHEN the Planner updates existing artifacts THEN it SHALL:
   - Update plan.md sections in-place (not append-only)
   - Update registry.md rows only for status or priority changes during reprioritization
   - Update individual task.md files only during reprioritization (priority field changes)

#### 6.3 Supervisor to Planner to Supervisor Round-Trip

1. WHEN the Supervisor consults the Planner THEN the round-trip SHALL follow this pattern:
   a. Supervisor reads plan.md "Current Focus" section
   b. Supervisor compares current registry state against the plan's expected ordering
   c. Supervisor determines if the next task to spawn aligns with the plan
   d. If aligned: PROCEED with normal queue processing
   e. If misaligned or ambiguous: Apply the Planner's priority rules from plan.md to determine correct ordering
   f. If unresolvable (e.g., all planned tasks are blocked): Log the situation and continue with best available task

2. WHEN the round-trip results in changes THEN the Supervisor SHALL NOT modify plan.md. It SHALL only read plan.md for guidance and act on registry.md for execution.

#### Acceptance Criteria

```gherkin
Feature: Interaction Model
  As a system participant
  I want clear communication patterns
  So that information flows correctly

  Scenario: Product Owner plans a feature through discussion
    Given the Product Owner runs /plan add search functionality
    When the Planner engages in discussion
    Then it SHALL ask 3-5 clarifying questions grouped by category
    And it SHALL propose tasks in a summary table format
    And it SHALL wait for approval before creating files

  Scenario: Planner creates correct artifacts
    Given the Product Owner has approved a set of 3 tasks
    When the Planner creates the artifacts
    Then 3 task folders SHALL be created with conformant task.md files
    And 3 rows SHALL be appended to registry.md with CREATED status
    And plan.md SHALL be updated with the new tasks under the appropriate phase

  Scenario: Supervisor reads plan for guidance
    Given the Supervisor needs to decide what to spawn next
    When it consults plan.md
    Then it SHALL read the Current Focus section for strategic direction
    And it SHALL use the plan's ordering to break priority ties
    And it SHALL NOT write to plan.md
```

---

### Requirement 7: /create-task Command Update

**User Story:** As a system maintainer, I want `/create-task` to remain available for programmatic use while `/plan` becomes the recommended Product Owner workflow, so that both human-driven and automated task creation paths are supported.

#### Acceptance Criteria

1. WHEN `/create-task` is evaluated for changes THEN it SHALL remain functional as-is for programmatic/internal use.
2. WHEN the /plan command documentation is written THEN it SHALL reference `/create-task` as the alternative for form-based task creation.
3. WHEN the Planner creates tasks internally THEN it SHALL follow the same task ID generation and registry update logic that `/create-task` uses (shared conventions, not shared code -- both read from registry.md and task-template.md independently).

---

## Non-Functional Requirements

### Context Separation

- **Planner context**: The Planner SHALL operate in its own session context (invoked via `/plan`). It SHALL NOT access or reason about worker health, session management, MCP internals, or Supervisor loop mechanics.
- **Supervisor context**: The Supervisor SHALL read plan.md for strategic guidance but SHALL NOT invoke the Planner as a sub-agent or spawn a Planner worker session. Consultation happens via shared artifacts (plan.md), not inter-process communication.
- **Worker context**: Workers (Build and Review) SHALL NOT be aware of the Planner or plan.md. They process individual tasks via the orchestration skill.

### Single Source of Truth

- **plan.md**: Single source of truth for strategic direction (phases, milestones, ordering, decisions).
- **registry.md**: Single source of truth for task status (CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED).
- **task.md**: Single source of truth for individual task definition (type, priority, complexity, description, acceptance criteria, dependencies).
- **task-template.md**: Single source of truth for task file structure and valid field values.

### Task Template Compliance

- All tasks created by the Planner SHALL conform to `task-tracking/task-template.md`.
- The Planner SHALL read the template file at creation time (not hardcode the format).
- Valid enum values for Type, Priority, and Complexity SHALL be extracted from the template.

### Scalability

- plan.md SHALL support projects with up to 50 tasks across multiple phases without becoming unwieldy.
- The Planner SHALL handle incremental planning (adding tasks to an existing plan) without requiring full plan regeneration.

### Reliability

- If the Planner session is interrupted mid-creation, partially created tasks SHALL be detectable (task folder exists but registry entry may be missing, or vice versa). The Planner SHALL check for and reconcile such orphans on next invocation.
- The Planner SHALL validate that task IDs do not collide with existing entries before creating tasks.

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Role | Needs | Success Criteria |
|-------------|------|-------|-----------------|
| Product Owner (User) | Describes what to build, approves plans | Intuitive planning conversation, clear task visibility, confidence that tasks are well-scoped | Can go from idea to approved task set in a single `/plan` session |
| Supervisor | Executes the backlog autonomously | Clear task ordering, right-sized tasks that workers can complete, strategic guidance when stuck | All tasks created by Planner pass validation (Step 2b), consultation protocol provides actionable guidance |
| Workers (Build/Review) | Execute individual tasks | Well-defined task.md with sufficient detail for PM agent to produce requirements | task.md files created by Planner have description >= 2 sentences, >= 1 acceptance criterion, valid type/priority |

### Secondary Stakeholders

| Stakeholder | Role | Needs | Success Criteria |
|-------------|------|-------|-----------------|
| Project-Manager Agent | Produces requirements for individual tasks | Clear task.md input with enough context to generate task-description.md | No clarification questions needed -- task.md provides sufficient context |
| Software-Architect Agent | Designs implementation for individual tasks | Tasks scoped to clear functional boundaries | Each task maps to a coherent architectural unit |
| Future CLI (packages/cli) | Will provide `npx nitro-fueled` commands | Planner artifacts follow predictable conventions | plan.md and task creation follow documented, parseable formats |

---

## Risk Assessment

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Planner creates tasks that are still too large for workers | Medium | High | 6 | Define explicit sizing heuristics in the agent definition (max files, max layers, max complexity). Include sizing validation rules the Planner must check before creating. |
| plan.md becomes stale relative to registry.md | Medium | Medium | 4 | Planner refreshes plan.md from registry on every `/plan status` invocation. Supervisor consultation reads registry directly, not plan.md status fields. |
| Supervisor consultation adds too much complexity to the Supervisor loop | Medium | High | 6 | Keep consultation simple: Supervisor reads plan.md "Current Focus" section and applies ordering rules. No sub-agent spawning, no complex protocol. |
| Product Owner bypasses Planner and creates tasks via /create-task, causing plan.md drift | Low | Medium | 2 | Document /plan as the recommended path. Planner detects unplanned tasks in registry (tasks not in plan.md) during status checks and offers to incorporate them. |
| Planner agent definition becomes too large/complex | Medium | Medium | 4 | Keep the agent file focused on rules and protocols. Reference external documents (plan.md format spec, task template) rather than inlining everything. |
| Circular dependency creation | Low | High | 3 | Planner SHALL validate the dependency graph before creating tasks. Reject any task set that introduces cycles. |

---

## Quality Gates

- [x] All requirements follow SMART criteria
- [x] Acceptance criteria in BDD format (Given/When/Then)
- [x] Stakeholder analysis complete
- [x] Risk assessment with mitigation strategies
- [x] Success metrics clearly defined per stakeholder
- [x] Dependencies identified (TASK_2026_003 COMPLETE)
- [x] Non-functional requirements specified (context separation, single source of truth, template compliance, scalability, reliability)
- [x] Task template compliance requirements documented
- [x] Integration points documented (Supervisor consultation, registry, plan.md)
- [x] Knowledge boundaries clearly defined (what Planner knows vs does not know)
