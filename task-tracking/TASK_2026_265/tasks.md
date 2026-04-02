# Development Tasks - TASK_2026_265

## Batch 1: Subtask-Aware Scheduling — COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Extend TaskCandidate type with subtask fields

**File**: apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts
**Status**: COMPLETE

Added `parentTaskId: string | null` and `subtaskOrder: number | null` to `TaskCandidate`. Added `task:subtask-parent-promoted` to `SupervisorEvent.type` union.

### Task 1.2: Update getTaskCandidates() with subtask-aware filtering

**File**: apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts
**Status**: COMPLETE

- Extended `TaskRow` with `parent_task_id` and `subtask_order`
- Fetch `parent_task_id, subtask_order` in the SQL SELECT
- Build `decomposedParentIds` set: parent task IDs with active non-terminal subtasks → skip these parents
- Build `completedOrdersByParent` map for sequential ordering check
- Fetch parent-level dependencies for subtask dependency inheritance
- Filter: skip decomposed parents, check parent deps + sequential order for subtasks
- Added `getParentStatusRollup(parentTaskId)` method: returns `{ allComplete, anyFailed }`

### Task 1.3: Add subtask completion handling to session-runner.ts

**File**: apps/dashboard-api/src/auto-pilot/session-runner.ts
**Status**: COMPLETE

- Added static `isSubtaskId(taskId)` helper (regex: `^TASK_\d{4}_\d{3}\.\d+$`)
- Added `handleSubtaskParentRollup(subtaskId)`: extracts parent ID, calls `getParentStatusRollup`, promotes parent to IMPLEMENTED or marks BLOCKED
- Updated `handleWorkerCompletion` (review path): after task reaches COMPLETE, if subtask ID → call rollup
- Updated `handleWorkerFailure` (retry exhausted path): if subtask ID → call rollup to propagate BLOCKED to parent

### Task 1.4: Add subtask scheduling documentation to SKILL.md

**File**: .claude/skills/nitro-auto-pilot/SKILL.md
**File**: apps/cli/scaffold/.claude/skills/nitro-auto-pilot/SKILL.md
**Status**: COMPLETE

Added "Subtask-Aware Scheduling (tick-mode supervisor)" section after "Worker Mode: single vs split", documenting all 5 behaviors. Both SKILL.md files (source + scaffold) updated identically.
