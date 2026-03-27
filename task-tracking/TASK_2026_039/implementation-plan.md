# Implementation Plan — TASK_2026_039
# Dashboard Pipeline and Squad Visualization

## Overview

Add two new views to the Nitro-Fueled dashboard:
1. **Pipeline View** — per-task phase diagram (Build → Review → Fix → Complete)
2. **Squad View** — real-time hierarchical worker tree per active task

## Architecture

### Data Flow

```
task-tracking/TASK_XXX/session-analytics.md
  → SessionAnalyticsParser
  → StateStore.sessionAnalytics Map
  → GET /api/tasks/:id/pipeline

task-tracking/state.md (activeWorkers)
  → StateParser (existing)
  → StateStore.orchestratorState.activeWorkers
  → GET /api/workers/tree (derived from flat list)
```

### Pipeline Phase Derivation

Map task status → phase states:

| Task Status  | Build   | Review  | Fix     | Complete |
|--------------|---------|---------|---------|----------|
| CREATED      | pending | pending | pending | pending  |
| IN_PROGRESS  | active  | pending | pending | pending  |
| IMPLEMENTED  | complete| pending | pending | pending  |
| IN_REVIEW    | complete| active  | pending | pending  |
| FIXING       | complete| complete| active  | pending  |
| COMPLETE     | complete| complete| complete| complete |
| FAILED       | varies  | varies  | varies  | failed   |
| BLOCKED/CANCELLED | pending | pending | pending | pending |

Duration: from `session-analytics.md` (total duration for COMPLETE; elapsed for active).

### Worker Tree Inference

Group flat `activeWorkers` by `taskId`. Within each group, infer parent-child relationships from `label`:

**Root workers** (leads): "Build Worker", "Review Lead", "Test Lead", "Fix Worker", "Completion Worker"

**Children of Review Lead**: "Style Reviewer", "Logic Reviewer", "Security Reviewer", "Code Style", "Code Logic", "Code Security"

**Children of Test Lead**: "Unit Tester", "Integration Tester", "E2E Tester"

**Health status**: `stuckCount > 2 → stuck`, `stuckCount > 0 → warning`, else `healthy`

## Files to Create/Modify

### dashboard-service

1. **`src/parsers/session-analytics.parser.ts`** (NEW)
   - Matches `TASK_\d{4}_\d{3}/session-analytics\.md$`
   - Parses markdown table: Task, Outcome, Start Time, End Time, Duration, Phases Completed, Files Modified

2. **`src/events/event-types.ts`** (MODIFY — append types)
   - Add: `PipelinePhase`, `PipelineData`, `WorkerTreeNode`, `WorkerTree`, `SessionAnalytics`

3. **`src/state/store.ts`** (MODIFY)
   - Add: `sessionAnalytics: Map<string, SessionAnalytics>`
   - Add: `setSessionAnalytics(taskId, data)`, `getSessionAnalytics(taskId)`, `removeSessionAnalytics(taskId)`
   - Add: `getTaskPipeline(taskId): PipelineData`
   - Add: `getWorkerTree(): WorkerTree[]`

4. **`src/parsers/file-router.ts`** (MODIFY)
   - Import and instantiate `SessionAnalyticsParser`
   - Add loadFile handler for session-analytics files
   - Add handleRemoval handler for session-analytics files

5. **`src/server/http.ts`** (MODIFY)
   - Add: `GET /api/tasks/:id/pipeline`
   - Add: `GET /api/workers/tree`
   - Add: `GET /api/tasks/:id/analytics` (raw session analytics)

6. **`src/index.ts`** (MODIFY)
   - Export new types: `PipelineData`, `PipelinePhase`, `WorkerTreeNode`, `WorkerTree`, `SessionAnalytics`

### dashboard-web

7. **`src/types/index.ts`** (MODIFY — append types)
   - Add: `PipelinePhase`, `PipelineData`, `WorkerTreeNode`, `WorkerTree`

8. **`src/api/client.ts`** (MODIFY)
   - Add: `getTaskPipeline(taskId): Promise<PipelineData>`
   - Add: `getWorkerTree(): Promise<WorkerTree[]>`

9. **`src/views/Pipeline.tsx`** (NEW)
   - Task selector dropdown (registry tasks)
   - Pipeline diagram: 4 phases connected left-to-right
   - Review phase is branched (Review Lead + Test Lead in parallel)
   - Active phase has CSS pulse animation
   - Phase node: colored status dot, name, duration label
   - Hover tooltip: model, cost (if available), elapsed

10. **`src/views/Squad.tsx`** (NEW)
    - Groups active workers by taskId
    - One card per task showing worker tree
    - Lead nodes show sub-workers nested with indent/connector
    - Health color: green/yellow/red
    - Elapsed time computed from spawnTime
    - Empty state when no active workers

11. **`src/App.tsx`** (MODIFY)
    - Add import for Pipeline and Squad views
    - Add routes: `/pipeline` and `/squad`

12. **`src/components/Sidebar.tsx`** (MODIFY)
    - Add nav items: Pipeline (📊) and Squad (👥)

## Type Definitions

```typescript
// PipelinePhase
interface PipelinePhase {
  name: string;                // 'Build' | 'Review' | 'Fix' | 'Complete'
  status: 'pending' | 'active' | 'complete' | 'failed';
  duration: string | null;     // e.g. '3m', '45s'
  isParallel: boolean;         // true for Review phase
  parallelParts: string[];     // ['Review Lead', 'Test Lead'] for Review
}

// PipelineData
interface PipelineData {
  taskId: string;
  taskStatus: string;
  phases: PipelinePhase[];
  totalDuration: string | null;
  outcome: string | null;
}

// WorkerTreeNode
interface WorkerTreeNode {
  workerId: string;
  taskId: string;
  label: string;
  role: string;
  workerType: string;
  status: string;
  health: 'healthy' | 'warning' | 'stuck';
  elapsedMs: number;
  spawnTime: string;
  stuckCount: number;
  children: WorkerTreeNode[];
}

// WorkerTree
interface WorkerTree {
  taskId: string;
  roots: WorkerTreeNode[];
}

// SessionAnalytics
interface SessionAnalytics {
  taskId: string;
  outcome: string;
  startTime: string;
  endTime: string;
  duration: string;
  phasesCompleted: string[];
  filesModified: number | null;
}
```

## Implementation Notes

- Pipeline view uses inline CSS (no external library) — consistent with existing views
- CSS pulse animation via `@keyframes pulse-glow` injected as `<style>` in component
- Squad view's elapsed time: `Date.now() - new Date(spawnTime).getTime()`
- Worker tree uses a two-pass approach: first collect all workers, then assign children to parents
- Session analytics parser tolerates missing fields gracefully (returns nulls)
- CORS allowed origins already handle localhost dev ports — no changes needed
- No WebSocket events needed for pipeline (polling acceptable; derived from existing state)
- WorkerTree endpoint is derived at request time from current activeWorkers (no new state)
