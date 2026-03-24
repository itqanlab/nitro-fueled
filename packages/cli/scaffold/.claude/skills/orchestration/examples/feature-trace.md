# Feature Workflow Trace Example

This document shows a complete FEATURE workflow trace from user request to task completion, demonstrating the full PM -> Architect -> Team-Leader -> Developer -> QA flow.

---

## User Command

```
/orchestrate Add real-time file watching with chokidar for automatic project sync
```

---

## Phase 0: Strategy Detection

**Orchestrator Analysis**:

```
Keywords detected: "add", "support" -> FEATURE
Affected areas: Main process (chokidar), Renderer (sync status display)
Complexity estimate: High (new infrastructure)
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
  subagent_type: 'project-manager',
  description: 'Create requirements for TASK_2026_045',
  prompt: `You are project-manager for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**User Request**: "Add real-time file watching with chokidar for automatic project sync"

Analyze the request and create comprehensive requirements.
See project-manager.md for detailed instructions.`,
});
```

**PM Output** (task-description.md excerpt):

```markdown
# Task Description - TASK_2026_045

## Title

Real-Time File Watching with Automatic Project Sync

## Business Requirements

1. Users shall see file changes reflected in real-time without manual refresh
2. File watching shall start automatically when a project is opened
3. System shall handle rapid successive changes with debouncing (300ms)
4. Watcher shall respect .gitignore patterns

## Technical Scope

- Chokidar watcher service in main process
- IPC channel for file change events
- Renderer-side sync status indicator
- SQLite tracking of watched paths

## Out of Scope

- Remote/network file system watching
- Binary file content diffing
- Cloud sync

## Success Criteria

- File changes detected within 500ms
- No duplicate events for single file changes
- Graceful handling of watched directory deletion
```

---

## Checkpoint 1: Requirements Validation

**Orchestrator Presents**:

```
## Checkpoint: Requirements

**Status**: Project manager completed task description
**Deliverable**: task-tracking/TASK_2026_045/task-description.md

### Summary
- Real-time file watching for automatic project sync
- Chokidar-based, debounced, .gitignore-aware
- Out of scope: remote FS, cloud sync

### Options
1. **Proceed** - Continue to architecture phase
2. **Adjust** - Modify requirements or scope
3. **Abort** - Cancel task

> Waiting for your decision...
```

**User Response**: `APPROVED`

---

## Phase 2: Research (Conditional - Triggered)

**Orchestrator Decision**:

```
Technical unknowns detected:
- Chokidar performance with large monorepos
- IPC event throttling patterns for Electron

Invoking researcher-expert...
```

**Orchestrator Invocation**:

```typescript
Task({
  subagent_type: 'researcher-expert',
  description: 'Research file watching options for TASK_2026_045',
  prompt: `You are researcher-expert for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**Research Questions**:
1. Chokidar performance characteristics with 10k+ files
2. Best IPC event batching patterns for Electron file watchers

Investigate options, create comparison matrix, recommend approach.
See researcher-expert.md for detailed instructions.`,
});
```

**Researcher Output** (research-report.md excerpt):

```markdown
# Research Report - TASK_2026_045

## Chokidar Performance

| Scenario            | Init Time | Memory  | CPU Idle |
| ------------------- | --------- | ------- | -------- |
| 1k files            | 200ms     | 15MB    | <1%      |
| 10k files           | 1.2s      | 45MB    | <1%      |
| 50k files           | 5.8s      | 120MB   | 2%       |

**Recommendation**: Use `ignoreInitial: true`, `awaitWriteFinish: true`

## IPC Event Batching

Simple debounce sufficient for file change events:

- Batch events in 300ms windows
- Send aggregated change sets via IPC
- Renderer processes batch, not individual events

**Recommendation**: Main process debounce + batch IPC sends
```

---

## Phase 4: Software Architect

**Orchestrator Invocation**:

```typescript
Task({
  subagent_type: 'software-architect',
  description: 'Design implementation for TASK_2026_045',
  prompt: `You are software-architect for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**Requirements**: Read task-description.md
**Research**: Read research-report.md

Design the technical implementation plan.
See software-architect.md for detailed instructions.`,
});
```

**Architect Output** (implementation-plan.md excerpt):

```markdown
# Implementation Plan - TASK_2026_045

## Architecture Overview

+-------------------+    IPC     +-------------------+
| Renderer          | <--------> | Main Process      |
| (Sync Status UI)  |            | (Chokidar Watcher)|
+-------------------+            +-------------------+
        |                                |
        v                                v
+-------------------+            +-------------------+
| Signal Store      |            | SQLite            |
| (sync.store.ts)   |            | (watched_paths)   |
+-------------------+            +-------------------+

## Implementation Tasks

### Backend Tasks (Batch 1)
1. Create FileWatcherService with chokidar
2. Implement watched paths SQLite table
3. Create IPC handlers for watcher control

### Frontend Tasks (Batch 2)
4. Create sync status signal store
5. Implement sync indicator component
6. Add file change event display

### Integration Tasks (Batch 3)
7. Connect renderer to watcher IPC channels
8. Add project open/close watcher lifecycle
9. Implement error recovery for deleted paths
```

---

## Checkpoint 2: Architecture Validation

**Orchestrator Presents**:

```
## Checkpoint: Architecture

**Status**: Software architect completed implementation plan
**Deliverable**: task-tracking/TASK_2026_045/implementation-plan.md

### Summary
- 3 batches: Backend (3 tasks), Frontend (3 tasks), Integration (3 tasks)
- Chokidar with debounced IPC batching
- SQLite tracking of watched paths

### Options
1. **Proceed** - Continue to development phase
2. **Adjust** - Modify architecture
3. **Abort** - Cancel task

> Waiting for your decision...
```

**User Response**: `APPROVED`

---

## Phase 5: Team-Leader MODE 1

**Orchestrator Invocation**:

```typescript
Task({
  subagent_type: 'team-leader',
  description: 'Decompose tasks for TASK_2026_045',
  prompt: `You are team-leader for TASK_2026_045.

**MODE**: 1 - DECOMPOSITION
**Task Folder**: task-tracking/TASK_2026_045
**Implementation Plan**: Read implementation-plan.md

Break down the implementation into atomic, batchable tasks.
See team-leader.md for MODE 1 instructions.`,
});
```

**Team-Leader Output**:

```
TASKS.MD CREATED - TASK_2026_045

Created 9 tasks in 3 batches:

Batch 1 - Main Process Watcher (backend-developer):
  1.1 Create FileWatcherService class
  1.2 Implement watched_paths SQLite table
  1.3 Create watcher IPC handlers

Batch 2 - Renderer Sync UI (frontend-developer):
  2.1 Create SyncStatusStore signal store
  2.2 Implement SyncIndicator component
  2.3 Add FileChangeList component

Batch 3 - Integration (backend-developer):
  3.1 IPC channel connection
  3.2 Project lifecycle watcher management
  3.3 Error recovery implementation

NEXT BATCH ASSIGNED: Batch 1 to backend-developer

[Developer prompt provided]
```

---

## Phase 5: Team-Leader MODE 2 (Loop)

### Batch 1 Execution

**Orchestrator Invokes Backend Developer**:

```typescript
Task({
  subagent_type: 'backend-developer',
  description: 'Implement Batch 1 for TASK_2026_045',
  prompt: `You are backend-developer for TASK_2026_045.

**Task Folder**: task-tracking/TASK_2026_045
**Tasks**: Read tasks.md, find Batch 1 (IN PROGRESS)

Implement all tasks in Batch 1. Update status to IMPLEMENTED when done.
See backend-developer.md for detailed instructions.`,
});
```

**Backend Developer Output**:

```
BATCH 1 IMPLEMENTATION COMPLETE

Files Created:
- libs/main-process/sync/src/lib/services/file-watcher.service.ts
- libs/main-process/sync/src/lib/services/watched-paths.repository.ts
- apps/desktop/src/ipc/watcher.handler.ts

Build: PASSING
Tasks: 1.1, 1.2, 1.3 marked IMPLEMENTED
```

**Orchestrator Returns to Team-Leader MODE 2**:

```typescript
Task({
  subagent_type: 'team-leader',
  description: 'Verify Batch 1 for TASK_2026_045',
  prompt: `You are team-leader for TASK_2026_045.

**MODE**: 2 - VERIFY + ASSIGN
**Task Folder**: task-tracking/TASK_2026_045
**Developer Report**: Backend developer completed Batch 1

Verify implementation, create commit, assign next batch.
See team-leader.md for MODE 2 instructions.`,
});
```

**Team-Leader MODE 2 Output**:

```
BATCH 1 VERIFIED AND COMMITTED

Commit: abc1234 - feat(sync): add file watcher service with chokidar integration

Files verified:
- file-watcher.service.ts: Real implementation, proper debouncing
- watched-paths.repository.ts: SQLite CRUD complete
- watcher.handler.ts: IPC handlers registered

NEXT BATCH ASSIGNED: Batch 2 to frontend-developer

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
- 9 tasks implemented
- 3 commits created

Commits:
1. abc1234 - feat(sync): add file watcher service with chokidar integration
2. def5678 - feat(ui): add sync status indicator and file change display
3. ghi9012 - feat(electron): integrate watcher lifecycle with project management

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
- 9 files created across 3 batches
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

_senior-tester_: 15 tests created, all passing, 87% coverage
_code-style-reviewer_: 2 minor issues (missing JSDoc, import ordering)
_code-logic-reviewer_: 0 issues, all error paths handled

---

## Phase 8: Modernization Detector

Creates `future-enhancements.md` with suggestions for virtual file system support, binary file change detection, and performance monitoring.

---

## Workflow Complete

```
WORKFLOW COMPLETE - TASK_2026_045

Real-Time File Watching with Automatic Project Sync

Summary:
- Strategy: FEATURE (Full Workflow)
- Phases Completed: 8/8
- Tasks: 9/9 complete
- Commits: 3
- Tests: 15 passing (87% coverage)
- Reviews: Style (2 minor), Logic (0 issues)

Time Elapsed: ~4 hours
Status: SUCCESS
```
