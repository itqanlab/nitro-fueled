# Code Style Review — TASK_2026_087

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit:** `5538b3b feat(dashboard-api): migrate state services and REST controllers to NestJS`

---

## Overall Assessment

**Score: 6/10**

The migration correctly follows NestJS patterns (decorators, lifecycle hooks, constructor injection). Naming conventions, file suffixes, and module structure are all correct. However, there are two serious file-size violations, multiple inline `import()` type references that belong as top-level imports, a double `as` cast, and several loose `string` typings where existing union types should be used.

---

## Findings

### SERIOUS — File Size Violations

#### S1 — `pipeline.service.ts` is 681 lines (limit: 200)

**File:** `apps/dashboard-api/src/dashboard/pipeline.service.ts`
**Severity:** Serious

At 681 lines — 3.4× the 200-line service limit — this is the most significant style violation. The file amalgamates five source files (store, pipeline-helpers, differ, worker-tree-helpers) into a single service class. The sections are logically distinct and independently testable. Recommended split:

- `PipelineService` — registry, plan, orchestrator state, task data, stats, graph (~200 lines)
- `DiffService` — `diffRegistry`, `diffState` (~120 lines)
- `WorkerTreeService` — `buildWorkerTrees`, `buildTaskTree`, `inferRole`, `computeHealth` (~130 lines)
- `PipelinePhaseService` or extract pipeline-phase helpers into private methods that stay in `PipelineService`

---

#### S2 — `analytics.service.ts` is 280 lines (limit: 200)

**File:** `apps/dashboard-api/src/dashboard/analytics.service.ts`
**Severity:** Serious

At 280 lines — 40% over the limit. The analytics helpers section (lines 77–179) contains pure parsing logic that could be extracted to a standalone `analytics.helpers.ts` module (non-injectable pure functions), reducing the service to ~120 lines.

---

### SERIOUS — Inline `import()` Type References in `pipeline.service.ts`

#### S3 — `PlanData`, `DashboardEvent`, `WorkerTreeNode` not imported at top level

**File:** `apps/dashboard-api/src/dashboard/pipeline.service.ts`
**Lines:** 64, 87, 91, 95 (`PlanData`), 424, 425, 478, 479 (`DashboardEvent`), 595, 596, 598, 599, 618 (`WorkerTreeNode`)
**Severity:** Serious

Three types are used exclusively via inline `import('./dashboard.types').TypeName` syntax throughout the file rather than being added to the top-level `import type` statement. This is not idiomatic TypeScript — inline dynamic imports on type-only references are a style red flag and indicate the imports were missed. All three should appear in the top-level `import type { ... } from './dashboard.types'` block.

```typescript
// Current — scattered throughout the file:
private plan: import('./dashboard.types').PlanData | null = null;
// ...
const events: import('./dashboard.types').DashboardEvent[] = [];
// ...
let reviewLeadNode: import('./dashboard.types').WorkerTreeNode | null = null;

// Should be at top:
import type {
  // ...existing imports...
  PlanData,
  DashboardEvent,
  WorkerTreeNode,
} from './dashboard.types';
```

---

### SERIOUS — Double `as` Cast

#### S4 — `as unknown as Record<string, unknown>` in `getStats()`

**File:** `apps/dashboard-api/src/dashboard/pipeline.service.ts`
**Lines:** 237–238
**Severity:** Serious

```typescript
const workerAny = worker as unknown as Record<string, unknown>;
```

Convention: no `as` type assertions. This double cast exists because `ActiveWorker` in `dashboard.types.ts` does not have `cost`, `tokens`, or `model` fields — those fields are accessed speculatively here. The correct fix is to either add an optional extended worker interface that includes these fields, or use a type guard function. The cast silently hides a type contract mismatch.

---

### SERIOUS — Silent Error Swallow in `analytics.service.ts`

#### S5 — `readTextFile` catches errors without logging

**File:** `apps/dashboard-api/src/dashboard/analytics.service.ts`
**Lines:** 69–75
**Severity:** Serious

```typescript
private async readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;  // ← error swallowed silently
  }
}
```

Convention: never swallow errors — at minimum, log them. File read failures are recoverable (missing optional files is expected), but the distinction between "file not found" (expected) and "permission denied" or "ENOMEM" (unexpected) is lost. Should use `this.logger.debug(...)` at minimum, or filter by error code:

```typescript
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') {
    this.logger.warn(`Unexpected error reading ${filePath}: ${String(err)}`);
  }
  return null;
}
```

---

### SERIOUS — Private Map Fields Missing `readonly`

#### S6 — Mutable Map references without `readonly` in `pipeline.service.ts`

**File:** `apps/dashboard-api/src/dashboard/pipeline.service.ts`
**Lines:** 66–71
**Severity:** Serious

```typescript
private taskDefinitions: Map<string, TaskDefinition> = new Map();
private reviews: Map<string, ReviewData[]> = new Map();
private completionReports: Map<string, CompletionReport> = new Map();
private lessons: Map<string, ReadonlyArray<LessonEntry>> = new Map();
private sessionAnalyticsMap: Map<string, SessionAnalytics> = new Map();
```

None of these Map references are ever reassigned — only their contents are mutated. All five should be `private readonly`. Compare with the correctly declared `private readonly logger`, `private readonly sessions`, `private readonly activeSessionIds` in `sessions.service.ts`.

---

### MINOR — Loose `string` Typings Where Union Types Exist

#### M1 — `TaskRecord.type` should be `TaskType`

**File:** `apps/dashboard-api/src/dashboard/dashboard.types.ts`
**Line:** 34

```typescript
export interface TaskRecord {
  readonly type: string;  // ← should be TaskType
```

`TaskType` is defined on lines 14–22 of the same file. Using `string` here defeats the purpose of the union type.

---

#### M2 — `ActiveWorker.workerType` and `ActiveWorker.status` use bare `string`

**File:** `apps/dashboard-api/src/dashboard/dashboard.types.ts`
**Lines:** 83, 87

```typescript
export interface ActiveWorker {
  readonly workerType: string;  // ← WorkerType exists ('Build' | 'Review')
  readonly status: string;      // ← WorkerStatus exists ('running' | 'completed' | 'failed' | 'killed')
```

Both `WorkerType` (line 25) and `WorkerStatus` (line 27) are defined in the same file and should be used here.

---

#### M3 — `PlanPhase.taskMap` inline object uses bare `string` for `status` and `priority`

**File:** `apps/dashboard-api/src/dashboard/dashboard.types.ts`
**Lines:** 56–62

```typescript
readonly taskMap: ReadonlyArray<{
  readonly taskId: string;
  readonly title: string;
  readonly status: string;    // ← TaskStatus
  readonly priority: string;  // ← TaskPriority
}>;
```

`TaskStatus` (lines 3–12) and `TaskPriority` (line 23) are available and should be used.

---

#### M4 — `TaskDefinition.complexity` is bare `string`

**File:** `apps/dashboard-api/src/dashboard/dashboard.types.ts`
**Line:** 45

```typescript
readonly complexity: string;
```

The task template uses `'Low' | 'Medium' | 'High'`. A string literal union or a dedicated `TaskComplexity` type would prevent arbitrary values.

---

### MINOR — Analytics Error Handlers Don't Log Root Cause

#### M5 — `catch` blocks in analytics routes discard the original error

**File:** `apps/dashboard-api/src/dashboard/dashboard.controller.ts`
**Lines:** 154–156, 161–163, 167–169, 174–176

```typescript
} catch {
  throw new InternalServerErrorException({ error: 'Analytics unavailable' });
}
```

The original exception is discarded. A caller receiving a 500 has no way to diagnose why analytics failed. Should log the error before rethrowing:

```typescript
} catch (err) {
  this.logger.error('Analytics getCostData failed:', err);
  throw new InternalServerErrorException({ error: 'Analytics unavailable' });
}
```

---

### MINOR — Local `LogEntry` Duplicates Inline Type from `dashboard.types.ts`

#### M6 — `sessions.service.ts` redeclares `LogEntry` locally

**File:** `apps/dashboard-api/src/dashboard/sessions.service.ts`
**Line:** 8

```typescript
type LogEntry = { readonly timestamp: string; readonly source: string; readonly event: string };
```

`SessionData.log` in `dashboard.types.ts` (line 210) already has this exact inline shape. The local type should either be extracted as a named export in `dashboard.types.ts` and imported here, or removed if `SessionData['log'][number]` can be used as the parameter type.

---

### INFO — `readSessionDirs` returns mutable `string[]`

**File:** `apps/dashboard-api/src/dashboard/analytics.service.ts`
**Line:** 55

```typescript
private async readSessionDirs(): Promise<string[]>
```

Minor inconsistency with the codebase's `ReadonlyArray` preference for return types. Should be `Promise<ReadonlyArray<string>>`.

---

## Summary Table

| ID | File | Line(s) | Severity | Rule Violated |
|----|------|---------|----------|---------------|
| S1 | `pipeline.service.ts` | whole file (681 lines) | Serious | Max 200 lines per service |
| S2 | `analytics.service.ts` | whole file (280 lines) | Serious | Max 200 lines per service |
| S3 | `pipeline.service.ts` | 64, 87, 91, 95, 424, 425, 478, 479, 595–599, 618 | Serious | Inline import() instead of top-level import |
| S4 | `pipeline.service.ts` | 237–238 | Serious | No `as` type assertions |
| S5 | `analytics.service.ts` | 69–75 | Serious | Never swallow errors silently |
| S6 | `pipeline.service.ts` | 66–71 | Serious | Explicit access modifiers (`readonly`) on all class members |
| M1 | `dashboard.types.ts` | 34 | Minor | Use union types, not bare `string` |
| M2 | `dashboard.types.ts` | 83, 87 | Minor | Use union types, not bare `string` |
| M3 | `dashboard.types.ts` | 57–62 | Minor | Use union types, not bare `string` |
| M4 | `dashboard.types.ts` | 45 | Minor | Use union types, not bare `string` |
| M5 | `dashboard.controller.ts` | 154–156, 161–163, 167–169, 174–176 | Minor | Log errors before rethrowing |
| M6 | `sessions.service.ts` | 8 | Minor | Avoid duplicating types already declared in types file |
| I1 | `analytics.service.ts` | 55 | Info | Prefer `ReadonlyArray` for return types |

**Totals:** 0 blocking · 6 serious · 4 minor · 1 info
