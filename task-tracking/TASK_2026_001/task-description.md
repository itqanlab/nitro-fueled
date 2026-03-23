# Requirements Document - TASK_001

## Introduction

Nitro-Fueled is a reusable AI development orchestration package that provides a full PM -> Architect -> Dev -> QA pipeline via Claude Code. The `task-tracking/` directory is where all task state lives, yet the project currently lacks the foundational `task.md` template that users and the auto-pilot loop depend on to define work. Without a well-structured template and a scaffolding command, every new task requires manually recreating folder structure and boilerplate -- slowing adoption and introducing inconsistency.

This task delivers the task template system: a canonical `task.md` template, integration documentation, and a `/create-task` slash command that scaffolds new task folders interactively.

## Existing Patterns and Constraints

The following codebase realities inform these requirements:

1. **Design doc draft** (`docs/claude-orchestrate-package-design.md` lines 72-86) contains a starter `task.md` template with Title, Description, Dependencies, Acceptance Criteria, and References sections.
2. **Task tracking reference** (`.claude/skills/orchestration/references/task-tracking.md`) defines the canonical folder structure, document ownership, task ID format (`TASK_YYYY_NNN`), registry format, and phase detection table.
3. **Orchestration SKILL.md** defines how the orchestrator creates `context.md` during Phase 0, reads the registry to generate task IDs, and routes tasks through agent sequences.
4. **Existing commands** (`.claude/commands/`) follow a pattern: markdown files with usage instructions, execution steps, and references to skills/agents.
5. **Registry** (`task-tracking/registry.md`) is a markdown table tracking all tasks with ID, status, type, description, and created date.
6. **Task lifecycle** is determined by which files exist in the task folder (see phase detection table in task-tracking.md).

---

## Requirements

### Requirement 1: Task Template File

**User Story:** As a developer using Nitro-Fueled, I want a canonical `task.md` template in the `task-tracking/` directory, so that I have a clear, consistent format for defining new tasks without guessing the structure.

#### Acceptance Criteria

1. WHEN a user opens `task-tracking/task-template.md` THEN it SHALL contain all sections from the design doc draft: Title, Description, Dependencies, Acceptance Criteria, and References.
2. WHEN a user reads the template THEN each section SHALL include inline guidance comments (in HTML comments or placeholder text) explaining what to write and why.
3. WHEN the template is compared to the orchestration workflow THEN it SHALL include metadata fields that the orchestrator and auto-pilot loop consume:
   - **Task Type** field with valid values: FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE (matching the Workflow Selection Matrix in SKILL.md)
   - **Priority** field with valid values: P0-Critical, P1-High, P2-Medium, P3-Low
   - **Complexity** field with valid values: Simple, Medium, Complex
4. WHEN the template is used to create a task THEN the resulting `task.md` SHALL be sufficient for the orchestrator to determine strategy selection without additional user input (task type + description enables the Adaptive Strategy Selection in SKILL.md).
5. WHEN the template file exists THEN it SHALL NOT be inside any `TASK_*/` folder -- it SHALL live at `task-tracking/task-template.md` as a reference document.

### Requirement 2: Template Integration Documentation

**User Story:** As a developer adopting Nitro-Fueled in a new project, I want clear documentation explaining how `task.md` fits into the orchestration lifecycle, so that I understand how writing a task leads to autonomous execution.

#### Acceptance Criteria

1. WHEN a user reads the documentation THEN it SHALL explain the full task lifecycle: user writes `task.md` -> orchestrator reads it -> PM generates `task-description.md` -> Architect generates `implementation-plan.md` -> Team-leader creates `tasks.md` -> Dev implements -> QA reviews.
2. WHEN the documentation describes task.md fields THEN it SHALL map each field to its consumer:
   - Task Type -> Workflow Selection Matrix (SKILL.md)
   - Priority -> Auto-pilot queue ordering
   - Complexity -> Strategy selection weighting
   - Dependencies -> Dependency graph for unblocked task detection
   - Acceptance Criteria -> PM requirements input, QA verification criteria
3. WHEN the documentation is read THEN it SHALL include at least 2 concrete examples of filled-out task.md files (one FEATURE, one BUGFIX) demonstrating real usage patterns.
4. WHEN the documentation describes the auto-pilot integration THEN it SHALL reference the auto-pilot loop steps from the design doc (read registry -> build dependency graph -> find unblocked tasks -> generate orchestration prompt -> spawn worker).
5. WHEN the documentation is placed THEN it SHALL live at `docs/task-template-guide.md` and be referenced from the project root `CLAUDE.md` under Key Docs.

### Requirement 3: Create-Task Slash Command

**User Story:** As a developer using Claude Code with Nitro-Fueled, I want a `/create-task` command that interactively scaffolds a new task folder with a pre-filled `task.md`, so that I can quickly create properly-structured tasks without manual folder creation or copy-pasting.

#### Acceptance Criteria

1. WHEN a user invokes `/create-task [description]` THEN the command SHALL:
   a. Read `task-tracking/registry.md` to determine the next sequential task ID (format: `TASK_YYYY_NNN`)
   b. Create the folder `task-tracking/TASK_YYYY_NNN/`
   c. Generate `task-tracking/TASK_YYYY_NNN/task.md` populated from the template with the user's description pre-filled
   d. Add a new row to `task-tracking/registry.md` with status `CREATED`

2. WHEN a user invokes `/create-task` without a description THEN the command SHALL interactively prompt for: title, description, task type, priority, dependencies, and acceptance criteria.

3. WHEN the command generates a task ID THEN it SHALL use the current year and increment the highest existing NNN by 1, matching the format defined in `task-tracking.md` reference (e.g., if highest is `TASK_2026_009`, next is `TASK_2026_010`).

4. WHEN the command updates the registry THEN the new row SHALL include: Task ID, Status (`CREATED`), Type, Description, and Created date -- matching the registry format in the task-tracking reference.

5. WHEN the command completes THEN it SHALL display a summary: task ID, folder path, and a hint to run `/orchestrate TASK_YYYY_NNN` to begin the workflow.

6. WHEN the command file is created THEN it SHALL follow the existing command pattern in `.claude/commands/` -- a markdown file with usage instructions, execution steps, and references to relevant skills/references. It SHALL be placed at `.claude/commands/create-task.md`.

---

## Non-Functional Requirements

### Consistency Requirements

- The template MUST use the exact same field names and values referenced throughout the orchestration skill, task-tracking reference, and design doc. No synonyms or alternative naming.
- The `/create-task` command MUST produce output identical in structure to what a human would create by manually following the template.

### Maintainability Requirements

- The template file SHALL be the single source of truth for task structure. The `/create-task` command SHALL reference or read the template, not duplicate its content inline.
- Documentation SHALL cross-reference existing docs (SKILL.md, task-tracking.md, design doc) rather than restating their content.

### Compatibility Requirements

- The `/create-task` command SHALL work in any project that has been initialized with Nitro-Fueled (has `task-tracking/` directory and `registry.md`).
- The template SHALL not assume any specific tech stack in the target project.

### Performance Requirements

- The `/create-task` command SHALL complete task scaffolding (folder creation, file generation, registry update) in a single invocation without requiring follow-up commands.

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Role | Needs | Success Criteria |
|---|---|---|---|
| Developer (end user) | Writes tasks, runs orchestration | Clear template, fast scaffolding, no guesswork | Can create a well-formed task in under 30 seconds |
| Orchestrator (SKILL.md) | Reads task.md to determine strategy | Structured metadata (type, complexity, deps) | Strategy selection works without ambiguity |
| Auto-pilot loop | Reads registry + tasks to build queue | Registry consistency, dependency fields | Correctly identifies unblocked tasks |
| PM Agent | Consumes task.md to produce requirements | Description and acceptance criteria | Can produce task-description.md without clarification |

### Secondary Stakeholders

| Stakeholder | Role | Needs |
|---|---|---|
| CLI (future) | `npx nitro-fueled create` will wrap this | Command logic that can be extracted into CLI later |
| New project adopters | First experience with Nitro-Fueled | Self-explanatory template with inline guidance |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Template fields diverge from SKILL.md expectations | Medium | High | Cross-reference SKILL.md Workflow Selection Matrix directly; use identical enum values |
| `/create-task` duplicates template content instead of reading it | Medium | Medium | Requirement explicitly mandates reading template file as source of truth |
| Task ID generation race condition (two concurrent creates) | Low | Medium | Sequential ID generation from registry; auto-pilot spawns one task at a time |
| Template too complex for simple tasks | Medium | Medium | Keep required fields minimal (title + description); all other fields optional with defaults |
| Registry format mismatch between `/create-task` and orchestrator | Low | High | Both reference `task-tracking.md` as canonical format spec |

---

## Deliverables Summary

| # | Deliverable | Path | Owner |
|---|---|---|---|
| 1 | Task template file | `task-tracking/task-template.md` | Developer |
| 2 | Integration documentation | `docs/task-template-guide.md` | Developer |
| 3 | Create-task slash command | `.claude/commands/create-task.md` | Developer |
| 4 | CLAUDE.md update | `CLAUDE.md` (add Key Docs reference) | Developer |

## References

- Design doc with task.md draft: `docs/claude-orchestrate-package-design.md` (lines 70-86)
- Task tracking reference (ID format, folder structure, registry): `.claude/skills/orchestration/references/task-tracking.md`
- Orchestration SKILL.md (strategy selection, phase detection): `.claude/skills/orchestration/SKILL.md`
- Existing command pattern: `.claude/commands/orchestrate.md`
- Existing command pattern: `.claude/commands/initialize-workspace.md`
