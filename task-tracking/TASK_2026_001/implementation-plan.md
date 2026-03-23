# Implementation Plan - TASK_001

## Codebase Investigation Summary

### Libraries Discovered

This task produces only markdown files (no application code), so "libraries" here means the markdown conventions and reference documents that govern content structure.

### Patterns Identified

- **Command Pattern**: `.claude/commands/*.md` files follow a structure of Purpose/Usage/Execution Steps/References. Two variants observed:
  - **Skill-invoking commands** (e.g., `orchestrate.md`): short, loads a skill, lists references. Evidence: `.claude/commands/orchestrate.md:1-36`
  - **Self-contained commands** (e.g., `review-code.md`, `project-status.md`): longer, contain full execution logic with phases. Evidence: `.claude/commands/review-code.md:1-234`, `.claude/commands/project-status.md:1-130`
  - The `/create-task` command is self-contained (no dedicated skill), so it should follow the self-contained pattern.

- **Task ID Format**: `TASK_YYYY_NNN` (year + zero-padded sequential number). Evidence: `.claude/skills/orchestration/references/task-tracking.md:8-18`
  - **Discrepancy**: Current registry uses `TASK_001` (no year component). Evidence: `task-tracking/registry.md:4`. The task-tracking reference is the canonical spec, so `TASK_YYYY_NNN` is correct. The registry will be migrated as part of a separate concern.

- **Registry Format**: Markdown table with columns: Task ID, Status, Type, Description, Created. Evidence: `task-tracking.md:72-80`
  - **Current registry diverges** -- uses columns: ID, Task, Status, Tracking. Evidence: `task-tracking/registry.md:4`. The canonical format from `task-tracking.md` should be the target for `/create-task` output.

- **Task Type Enum** (from Workflow Selection Matrix): FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE. Evidence: `.claude/skills/orchestration/SKILL.md:26-33`

- **Complexity Enum**: Simple, Medium, Complex (mapped to time estimates: <2h, 2-8h, >8h). Evidence: `.claude/skills/orchestration/SKILL.md:91`

- **Design Doc task.md Draft**: Title, Description, Dependencies, Acceptance Criteria, References. Evidence: `docs/claude-orchestrate-package-design.md:72-86`

- **Context.md Template**: Contains Task Type, Complexity Assessment, Strategy Selected, Related Tasks. Evidence: `task-tracking.md:107-137`

- **Phase Detection**: Determined by which files exist in task folder. Evidence: `task-tracking.md:166-189`

- **Document Ownership Table**: Lists which agent creates which document. Evidence: `task-tracking.md:139-151`

### Integration Points

- **Orchestrator reads task.md**: During NEW_TASK initialization (SKILL.md:116-119), the orchestrator creates context.md from user intent. With a `task.md` file present, the orchestrator can read structured metadata instead of parsing free-text.
- **Auto-pilot loop**: Reads registry + task folders to build dependency graph, find unblocked tasks. Evidence: `docs/claude-orchestrate-package-design.md:100-113`
- **PM Agent**: Consumes task.md to produce task-description.md. Evidence: `task-description.md:112` (stakeholder table)

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Template-as-source-of-truth with command-reads-template pattern.
**Rationale**: The requirements explicitly mandate that `/create-task` references the template file rather than duplicating content (task-description.md:89). This ensures a single point of maintenance.
**Evidence**: Same pattern used by orchestrate.md which loads SKILL.md rather than inlining orchestration logic.

---

### Component Specifications

#### Component 1: `task-tracking/task-template.md`

**Purpose**: Canonical task template -- the single source of truth for task structure. Lives at the task-tracking root (not inside any TASK_* folder).

**Evidence**: Design doc draft at `docs/claude-orchestrate-package-design.md:70-86` provides the starter structure. Requirements expand it with metadata fields from SKILL.md.

**Content Structure**:

```markdown
# Task: [Title]

<!-- Replace [Title] with a concise name for this task -->

## Metadata

| Field      | Value                                                        |
|------------|--------------------------------------------------------------|
| Type       | [FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE] |
| Priority   | [P0-Critical | P1-High | P2-Medium | P3-Low]                |
| Complexity | [Simple | Medium | Complex]                                 |

<!-- Type: Determines the agent workflow (see Workflow Selection Matrix in SKILL.md)
     Priority: Determines queue ordering in auto-pilot
     Complexity: Influences strategy selection weighting (Simple <2h, Medium 2-8h, Complex >8h) -->

## Description

[What needs to be built, fixed, or changed. Be specific enough for the PM agent
to produce requirements without further clarification.]

## Dependencies

- [TASK_YYYY_NNN — brief description of what this task needs from that one]
- None

<!-- List task IDs this depends on. Auto-pilot uses this to build the dependency
     graph and determine which tasks are unblocked. Use "None" if independent. -->

## Acceptance Criteria

- [ ] [What "done" looks like — measurable, verifiable outcomes]
- [ ] [Another criterion]

<!-- These feed into: PM requirements generation AND QA verification criteria.
     Write them as checkboxes so QA can verify each one. -->

## References

- [Files, docs, URLs, or related tasks relevant to this work]

<!-- Point to existing code, design docs, or external resources the developer
     will need. Helps the Architect ground decisions in codebase evidence. -->
```

**Key Design Decisions**:
1. Metadata uses a markdown table (not YAML frontmatter) for readability and parseability by agents. Evidence: context.md template in task-tracking.md uses similar heading-based structure.
2. Field values use exact enums from SKILL.md Workflow Selection Matrix (line 26-33) and Adaptive Strategy Selection (line 91). No synonyms.
3. HTML comments provide inline guidance without polluting the rendered output. This matches the requirement for "inline guidance comments" (task-description.md:32).
4. Dependencies use task ID format `TASK_YYYY_NNN` per task-tracking.md:8-18.
5. Acceptance criteria use checkbox format for QA verifiability.

**Files Affected**:
- `task-tracking/task-template.md` (CREATE)

---

#### Component 2: `docs/task-template-guide.md`

**Purpose**: Integration documentation explaining how task.md fits into the orchestration lifecycle. Maps each field to its consumer agent/system.

**Evidence**: Requirements specify lifecycle explanation, field-to-consumer mapping, 2 concrete examples, and auto-pilot integration reference (task-description.md:41-54).

**Content Structure**:

```
# Task Template Guide

## Overview
Brief explanation: task.md is where work begins in the Nitro-Fueled pipeline.

## Task Lifecycle
Diagram/description of the full flow:
  User writes task.md
  -> /create-task scaffolds folder + registry entry
  -> /orchestrate reads task.md
  -> Orchestrator creates context.md (Phase 0)
  -> PM produces task-description.md
  -> Architect produces implementation-plan.md
  -> Team-leader produces tasks.md
  -> Developer implements
  -> QA reviews
  -> Completion bookkeeping

## Field Reference
Table mapping each task.md field to its consumer(s):

| Field               | Consumer(s)                              | How It's Used                                    |
|---------------------|------------------------------------------|--------------------------------------------------|
| Type                | Orchestrator (Workflow Selection Matrix)  | Selects agent sequence (SKILL.md:26-33)          |
| Priority            | Auto-pilot loop                          | Queue ordering for unblocked tasks               |
| Complexity          | Orchestrator (Strategy Selection)         | Weighting factor in strategy confidence (SKILL.md:91) |
| Description         | PM Agent                                 | Input for requirements generation                |
| Dependencies        | Auto-pilot (dependency graph)            | Determines unblocked status                      |
| Acceptance Criteria | PM Agent + QA Reviewers                  | Requirements input + verification checklist      |
| References          | Architect + Developer                    | Codebase evidence for design decisions           |

## Auto-Pilot Integration
Reference to auto-pilot loop steps from design doc (lines 100-113):
  1. Read registry.md + task folders -> build dependency graph
  2. Find unblocked tasks (deps all COMPLETE, status CREATED)
  3. Pick next tasks (ordered by Priority)
  4. Generate orchestration prompt from task.md
  5. Spawn worker via MCP session-orchestrator
  6. Monitor, verify, update registry, loop

## Examples

### Example 1: FEATURE Task
A fully filled-out task.md for a real feature (e.g., "Add project settings panel").
Shows all fields populated with realistic values.

### Example 2: BUGFIX Task
A filled-out task.md for a bugfix (e.g., "Fix sidebar collapse on narrow viewports").
Shows minimal dependencies, specific acceptance criteria, simpler scope.

## Related Documentation
- Cross-references to SKILL.md, task-tracking.md, design doc
- NOT restating their content, just linking with brief context
```

**Key Design Decisions**:
1. Lifecycle section uses a linear flow description matching the agent sequence in SKILL.md:26-33, NOT a code diagram. Keeps it accessible.
2. Field Reference table maps every field to its exact consumer with SKILL.md line references. Evidence-based, not theoretical.
3. Two examples required by AC (task-description.md:52). One FEATURE, one BUGFIX -- these are the two most common task types.
4. Auto-pilot section cross-references design doc rather than restating. Evidence: task-description.md:91 mandates cross-referencing over restating.

**Files Affected**:
- `docs/task-template-guide.md` (CREATE)

---

#### Component 3: `.claude/commands/create-task.md`

**Purpose**: Slash command that interactively scaffolds a new task folder from the template. Reads the template as source of truth.

**Pattern**: Self-contained command (like `project-status.md` and `review-code.md`). Evidence: `.claude/commands/project-status.md:1-130` -- uses Phase-based execution steps, explicit rules, and output format.

**Content Structure**:

```
# Create Task Command

**Purpose**: Scaffold a new task folder with a pre-filled task.md from the canonical template.

## Usage

/create-task [optional: brief description]

## Execution Steps

### Step 1: Read Template
Read `task-tracking/task-template.md` as the source of truth for task structure.

### Step 2: Determine Task ID
1. Read `task-tracking/registry.md`
2. Find highest NNN value for current year (YYYY)
3. Increment by 1, zero-pad to 3 digits
4. Format: TASK_YYYY_NNN

### Step 3: Gather Task Information
If description provided as argument:
  - Pre-fill Description field
  - Prompt for: Title, Type, Priority, Complexity, Dependencies, Acceptance Criteria

If no argument provided:
  - Prompt for ALL fields: Title, Description, Type, Priority, Complexity, Dependencies, Acceptance Criteria

For each field, show valid values from the template:
  - Type: FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE
  - Priority: P0-Critical | P1-High | P2-Medium | P3-Low
  - Complexity: Simple | Medium | Complex

### Step 4: Create Task Folder and File
1. Create directory: task-tracking/TASK_YYYY_NNN/
2. Generate task.md by populating the template with user's answers
3. Write to: task-tracking/TASK_YYYY_NNN/task.md

### Step 5: Update Registry
Add a new row to task-tracking/registry.md:
  - Task ID: TASK_YYYY_NNN
  - Status: CREATED
  - Type: [user's choice]
  - Description: [user's title/description]
  - Created: [today's date, ISO format]

### Step 6: Display Summary
Show confirmation:
  - Task ID created
  - Folder path
  - Hint: "Run /orchestrate TASK_YYYY_NNN to begin the workflow"

## Important Rules

1. ALWAYS read task-template.md first -- never hardcode template structure
2. ALWAYS read registry.md to determine the next ID -- never guess
3. The registry row MUST match the canonical format: Task ID | Status | Type | Description | Created
4. Task type values MUST match exactly: FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE
5. If the user says "use defaults", set: Priority=P2-Medium, Complexity=Medium, Dependencies=None
```

**Key Design Decisions**:
1. Command reads template at runtime (Step 1) rather than inlining field definitions. This satisfies the single-source-of-truth requirement (task-description.md:89).
2. Follows self-contained command pattern with numbered phases. Evidence: `project-status.md` uses same Phase/Step structure.
3. ID generation follows exact algorithm from task-tracking.md:83-88.
4. Registry format uses canonical columns from task-tracking.md:72-80 (Task ID, Status, Type, Description, Created) -- NOT the current divergent format.
5. Interactive prompting with valid-value hints reduces errors.

**Files Affected**:
- `.claude/commands/create-task.md` (CREATE)

---

#### Component 4: `CLAUDE.md` Update

**Purpose**: Add task-template-guide.md to the Key Docs section so developers discover it.

**Evidence**: Requirements specify this at task-description.md:54. Current Key Docs section at `CLAUDE.md:29-30`.

**Change**: Add one line to the Key Docs section:

```markdown
## Key Docs
- `docs/claude-orchestrate-package-design.md` -- Full design doc
- `docs/mcp-session-orchestrator-design.md` -- MCP server for spawning/monitoring workers
- `docs/task-template-guide.md` -- Task template usage and orchestration integration
```

**Files Affected**:
- `CLAUDE.md` (MODIFY -- add one line to Key Docs section)

---

## Integration Architecture

### Data Flow

```
User invokes /create-task
  |
  v
Command reads task-template.md (source of truth)
  |
  v
Command reads registry.md (determines next TASK_YYYY_NNN)
  |
  v
Command prompts user for field values
  |
  v
Command creates TASK_YYYY_NNN/task.md (populated template)
Command updates registry.md (new row, status CREATED)
  |
  v
User invokes /orchestrate TASK_YYYY_NNN
  |
  v
Orchestrator reads task.md -> creates context.md -> routes to agent sequence
```

### Dependencies

- **No external dependencies** -- all deliverables are markdown files.
- **Internal dependencies**: The template's field values must match SKILL.md enums exactly. The command must reference task-tracking.md's ID format.

---

## Quality Requirements (Architecture-Level)

### Consistency Requirements
- Template field names and enum values MUST be identical to SKILL.md Workflow Selection Matrix (lines 26-33) and Adaptive Strategy Selection (line 91). No synonyms, no alternative casing.
- Registry rows produced by `/create-task` MUST follow the canonical format from task-tracking.md:72-80.

### Maintainability Requirements
- Template is single source of truth. Command reads it, does not duplicate it.
- Documentation cross-references existing docs rather than restating content.

### Compatibility Requirements
- Works in any project with `task-tracking/` directory and `registry.md`.
- No tech-stack assumptions in template.

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: backend-developer
**Rationale**: All deliverables are markdown files with precise structural requirements. The "backend" developer is best suited for content-heavy, structure-sensitive work that requires careful cross-referencing of existing documentation. No frontend/UI work involved.

### Complexity Assessment
**Complexity**: LOW-MEDIUM
**Estimated Effort**: 1-2 hours
**Rationale**: Four markdown files to create/modify. Content structure is well-defined by this plan. Main effort is ensuring enum values and cross-references are exact.

### Files Affected Summary

**CREATE**:
- `task-tracking/task-template.md` -- Canonical task template
- `docs/task-template-guide.md` -- Integration documentation with examples
- `.claude/commands/create-task.md` -- Slash command definition

**MODIFY**:
- `CLAUDE.md` -- Add one line to Key Docs section

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase (command patterns, enum values, ID format)
- [x] All cross-references verified as existing (SKILL.md, task-tracking.md, design doc)
- [x] Quality requirements defined (consistency, maintainability, compatibility)
- [x] Integration points documented (orchestrator, auto-pilot, PM agent)
- [x] Files affected list complete (3 CREATE, 1 MODIFY)
- [x] Developer type recommended (backend-developer)
- [x] Complexity assessed (LOW-MEDIUM, 1-2 hours)
- [x] No step-by-step implementation details (team-leader will decompose)
