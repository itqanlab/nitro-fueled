# Feature Workflow Trace Example

This document shows a complete FEATURE workflow trace from user request to task completion, demonstrating the full PM -> Architect -> Team-Leader -> Developer -> QA flow.

---

## User Command

```
/orchestrate Add CLI status command that shows task progress, active workers, and plan phase
```

---

## Phase 0: Strategy Detection

**Orchestrator Analysis**:

```
Keywords detected: "add", "command" -> FEATURE
Affected areas: CLI package, task registry, plan parsing
Complexity estimate: High (new command with multiple data sources)
Confidence: 85% FEATURE

Decision: Proceed with FEATURE strategy
```

**Orchestrator Output**:

```
TASK INITIALIZED: TASK_2026_045

Strategy: FEATURE (Full Workflow)
Complexity: High
Estimated Phases: 8

Flow: PM -> Architect -> Team-Leader -> Developers -> QA -> Modernization

Proceeding to Phase 1: Requirements gathering...
```

---

## Phase 1: Project Manager

**Orchestrator Invocation**:

```typescript
Task({
  subagent_type: 'nitro-project-manager',
  description: 'Create requirements for TASK_2026_045',
  prompt: `You are nitro-project-manager for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**User Request**: "Add CLI status command that shows task progress, active workers, and plan phase"

Analyze the request and create comprehensive requirements.
See nitro-project-manager.md for detailed instructions.`,
});
```

**PM Output** (task-description.md excerpt):

```markdown
# Task Description - TASK_2026_045

## Title

CLI Status Command with Task Progress Display

## Business Requirements

1. Users shall see task breakdown by status (COMPLETE, IN_PROGRESS, CREATED, etc.)
2. Active workers from orchestrator-state.md shall be displayed when running
3. Plan phase progress from plan.md shall be shown
4. Two output modes: brief (one-liner) and full (detailed table)

## Technical Scope

- New status.ts command in packages/cli/src/commands/
- Registry parser utility in packages/cli/src/utils/
- Plan.md parser for phase extraction
- Orchestrator-state.md parser for active workers

## Out of Scope

- Real-time streaming updates
- Web dashboard display
- Historical task analytics

## Success Criteria

- Brief mode shows one-line summary in <500ms
- Full mode shows detailed table with all task statuses
- Works without MCP server running (reads files directly)
```

---

## Checkpoint 1: Requirements Validation

**Orchestrator Presents**:

```
## Checkpoint: Requirements

**Status**: Project manager completed task description
**Deliverable**: task-tracking/TASK_2026_045/task-description.md

### Summary
- CLI status command with brief and full output modes
- Reads from registry.md, plan.md, orchestrator-state.md
- No real-time or MCP dependency

### Options
1. **Proceed** - Continue to architecture phase
2. **Adjust** - Modify requirements or scope
3. **Abort** - Cancel task

> Waiting for your decision...
```

**User Response**: `APPROVED`

---

## Phase 4: Software Architect

**Orchestrator Invocation**:

```typescript
Task({
  subagent_type: 'nitro-software-architect',
  description: 'Design implementation for TASK_2026_045',
  prompt: `You are nitro-software-architect for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**Requirements**: Read task-description.md

Design the technical implementation plan.
See nitro-software-architect.md for detailed instructions.`,
});
```

**Architect Output** (plan.md excerpt):

```markdown
# Implementation Plan - TASK_2026_045

## Architecture Overview

+-------------------+            +-------------------+
| CLI Entry Point   | ---------> | Status Command    |
| (packages/cli/    |            | (status.ts)       |
| src/index.ts)     |            +-------------------+
+-------------------+                    |
                              +----------+----------+
                              |          |          |
                              v          v          v
                        +---------+ +--------+ +----------+
                        | Registry| | Plan   | | State    |
                        | Parser  | | Parser | | Parser   |
                        +---------+ +--------+ +----------+
                              |          |          |
                              v          v          v
                        registry.md  plan.md  orchestrator-state.md

## Implementation Tasks

### Utility Tasks (Batch 1)
1. Create registry parser utility (packages/cli/src/utils/registry.ts)
2. Create plan parser for phase extraction

### Command Tasks (Batch 2)
3. Create status command with Commander.js options
4. Implement brief output mode (one-liner)
5. Implement full output mode (detailed table)

### Integration Tasks (Batch 3)
6. Register status command in packages/cli/src/index.ts
7. Add orchestrator-state.md parsing for active workers
8. Handle missing file gracefully (no plan.md, no state file)
```

---

## Checkpoint 2: Architecture Validation

**User Response**: `APPROVED`

---

## Phase 5: Team-Leader MODE 1

**Team-Leader Output**:

```
TASKS.MD CREATED - TASK_2026_045

Created 8 tasks in 3 batches:

Batch 1 - Utilities (nitro-backend-developer):
  1.1 Create registry.ts with markdown table parser
  1.2 Create plan parser for phase/milestone extraction

Batch 2 - Status Command (nitro-backend-developer):
  2.1 Create status.ts command skeleton with Commander.js
  2.2 Implement brief output mode
  2.3 Implement full output mode with table display

Batch 3 - Integration (nitro-backend-developer):
  3.1 Register command in index.ts
  3.2 Add orchestrator-state.md worker parsing
  3.3 Graceful handling of missing files

NEXT BATCH ASSIGNED: Batch 1 to nitro-backend-developer

[Developer prompt provided]
```

---

## Phase 5: Team-Leader MODE 2 (Loop)

### Batch 1 Execution

**Orchestrator Invokes Backend Developer**:

```typescript
Task({
  subagent_type: 'nitro-backend-developer',
  description: 'Implement Batch 1 for TASK_2026_045',
  prompt: `You are nitro-backend-developer for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**Tasks**: Read tasks.md, find Batch 1 (IN PROGRESS)

Implement all tasks in Batch 1. Update status to IMPLEMENTED when done.
See nitro-backend-developer.md for detailed instructions.`,
});
```

**Backend Developer Output**:

```
BATCH 1 IMPLEMENTATION COMPLETE

Files Created:
- packages/cli/src/utils/registry.ts
- packages/cli/src/utils/plan-parser.ts

Build: PASSING
Tasks: 1.1, 1.2 marked IMPLEMENTED
```

**Orchestrator Returns to Team-Leader MODE 2**:

```typescript
Task({
  subagent_type: 'nitro-team-leader',
  description: 'Verify Batch 1 for TASK_2026_045',
  prompt: `You are nitro-team-leader for TASK_2026_045.

**MODE**: 2 - VERIFY + ASSIGN
**Task Folder**: task-tracking/TASK_2026_045
**Developer Report**: Backend developer completed Batch 1

Verify implementation, create commit, assign next batch.
See nitro-team-leader.md for MODE 2 instructions.`,
});
```

**Team-Leader MODE 2 Output**:

```
BATCH 1 VERIFIED AND COMMITTED

Commit: abc1234 - feat(cli): add registry and plan parser utilities

Files verified:
- registry.ts: Proper markdown table parsing with typed RegistryRow output
- plan-parser.ts: Phase extraction with milestone progress tracking

NEXT BATCH ASSIGNED: Batch 2 to nitro-backend-developer

[Developer prompt provided]
```

### Batch 2 Execution (Similar flow...)

### Batch 3 Execution (Similar flow...)

---

## Phase 5: Team-Leader MODE 3

**Team-Leader MODE 3 Output**:

```
ALL BATCHES COMPLETE - TASK_2026_045

Implementation Summary:
- 3 batches completed
- 8 tasks implemented
- 3 commits created

Commits:
1. abc1234 - feat(cli): add registry and plan parser utilities
2. def5678 - feat(cli): implement status command with brief and full modes
3. ghi9012 - feat(cli): integrate status command with worker state display

Build Status: PASSING
All Files: Production-ready

Ready for QA phase.
```

---

## Checkpoint 3: QA Selection

**Orchestrator Presents**:

```
## Checkpoint: Development Complete

**Status**: Team leader completed all 3 batches
**Deliverable**: task-tracking/TASK_2026_045/MODE3-integration-report.md

### Summary
- 5 files created across 3 batches
- Full build passes
- 3 commits created

### Options
1. **Proceed** - Select QA: tester, style, logic, visual, all, skip
2. **Adjust** - Request changes
3. **Abort** - Cancel task

> Waiting for your decision...
```

**User Response**: `all`

---

## Phase 6: QA Agents (Parallel)

**Orchestrator Invokes All QA Agents** in parallel.

**QA Outputs**:

_nitro-senior-tester_: 12 tests created, all passing, 90% coverage
_nitro-code-style-reviewer_: 1 minor issue (missing type annotation on helper function)
_nitro-code-logic-reviewer_: 0 issues, all error paths handled

---

## Phase 8: Modernization Detector

Creates `future-enhancements.md` with suggestions for real-time streaming mode, JSON output format for scripting, and web dashboard integration.

---

## Workflow Complete

```
WORKFLOW COMPLETE - TASK_2026_045

CLI Status Command with Task Progress Display

Summary:
- Strategy: FEATURE (Full Workflow)
- Phases Completed: 8/8
- Tasks: 8/8 complete
- Commits: 3
- Tests: 12 passing (90% coverage)
- Reviews: Style (1 minor), Logic (0 issues)

Time Elapsed: ~4 hours
Status: SUCCESS
```
