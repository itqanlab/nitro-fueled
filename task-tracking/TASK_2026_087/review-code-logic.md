# Code Logic Review — TASK_2026_087

**Reviewer**: nitro-code-logic-reviewer
**Date**: 2026-03-28
**Task**: Migrate state services + REST controllers to NestJS
**Scope**: 7 files in `apps/dashboard-api/src/dashboard/`

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Serious | 2 |
| Moderate | 3 |
| Minor | 1 |

**Overall Assessment**: The migration is functionally complete with good structure. Two serious logic bugs affect analytics accuracy. Type definitions have consistency issues that weaken type safety.

---

## Findings

### SERIOUS-1: Model task count duplication in analytics aggregation

**File**: `analytics.service.ts:186-189`
**Category**: Algorithmic Error

```typescript
for (const [model, cost] of Object.entries(p.costByModel)) {
  const existing = modelMap.get(model) ?? { cost: 0, tasks: 0 };
  modelMap.set(model, { cost: existing.cost + cost, tasks: existing.tasks + p.taskCount });
}
```

**Problem**: When a session uses multiple models (e.g., both opus and sonnet), the session's total `taskCount` is added to each model's task count. A session with 5 tasks using 2 models would record 10 tasks total (5 per model).

**Impact**: `ModelUsagePoint.taskCount` values are inflated, making model efficiency comparisons inaccurate.

**Fix Required**: Track which tasks used which model at the source, or don't aggregate task counts by model (remove from `ModelUsagePoint`).

---

### SERIOUS-2: Partial comma removal in cost parsing

**File**: `analytics.service.ts:81`
**Category**: Data Parsing Error

```typescript
const totalCost = costMatch ? parseFloat(costMatch[1].replace(',', '')) : 0;
```

**Problem**: `replace(',', '')` only removes the first comma. Costs >= $1,000,000 (e.g., "1,234,567.89") would parse as `1234` instead of `1234567.89` because `parseFloat` stops at the second comma.

**Impact**: Large cost values would be truncated to ~1/1000th of actual value.

**Fix Required**: Use `replaceAll(',', '')` or `.replace(/,/g, '')`.

---

### MODERATE-1: Type inconsistency in TaskRecord

**File**: `dashboard.types.ts:34`
**Category**: Type Safety

```typescript
export interface TaskRecord {
  readonly type: string;  // Should be TaskType
```

**Problem**: `TaskType` is defined as a string literal union on lines 14-21, but `TaskRecord.type` uses bare `string`. This allows invalid task types to pass type checking.

**Impact**: Reduces compile-time type safety; invalid types slip through.

---

### MODERATE-2: Type inconsistency in ActiveWorker

**File**: `dashboard.types.ts:84-85`
**Category**: Type Safety

```typescript
export interface ActiveWorker {
  readonly workerType: string;  // Should be WorkerType
  readonly status: string;      // Should be WorkerStatus
```

**Problem**: `WorkerType` and `WorkerStatus` are defined on lines 25 and 27, but `ActiveWorker` uses bare `string` for both fields.

**Impact**: Same as MODERATE-1 — weakened type safety.

---

### MODERATE-3: Swallowed errors in analytics endpoints

**File**: `dashboard.controller.ts:150-184`
**Category**: Error Handling

```typescript
@Get('analytics/cost')
public async getAnalyticsCost(): Promise<...> {
  try {
    return await this.analyticsService.getCostData();
  } catch {
    throw new InternalServerErrorException({ error: 'Analytics unavailable' });
  }
}
```

**Problem**: All four analytics endpoints catch errors without logging them. The catch block has no error variable, so the original error is silently discarded.

**Impact**: Debugging production issues becomes difficult; no trace of what actually failed.

---

### MINOR-1: Inconsistent error response patterns

**File**: `dashboard.controller.ts:53-56, 61-64`
**Category**: API Consistency

```typescript
@Get('plan')
public getPlan(): ... | { error: string } {
  const plan = this.pipelineService.getPlan();
  return plan ?? { error: 'Plan not found' };
}
```

**Problem**: `getPlan` and `getState` return 200 OK with an error object when data is missing, while `getTask`, `getTaskPipeline`, and `getSession` throw `NotFoundException` (404). This inconsistency can confuse API consumers.

**Impact**: Clients must handle two different error patterns for similar "not found" conditions.

---

## No Issues Found

The following files passed logic review:

- **sessions.service.ts** — Session extraction, storage, and retrieval logic is correct. Edge cases handled appropriately.
- **watcher.service.ts** — File watching setup, subscription management, and cleanup are correct.
- **dashboard.module.ts** — Module registration and factory injection are correct.
- **pipeline.service.ts** — Despite its size, the pipeline phases, worker tree building, diff algorithms, and graph generation logic are correct. Complex `isUnblocked` calculation handles all edge cases properly.

---

## Verification Notes

1. **No stubs or placeholders detected** — All methods have complete implementations.
2. **No TODO/FIXME comments** — Code is production-ready.
3. **Data shape consistency** — Return types match documented shapes from event-types.ts.
4. **Edge case handling** — Null checks, empty array handling, and NaN guards are present throughout.

---

## Recommendations

1. Fix SERIOUS-1 and SERIOUS-2 before merging — they affect data accuracy.
2. MODERATE-1 and MODERATE-2 can be fixed in a follow-up if the types come from an external source.
3. MODERATE-3 should add error logging even if the generic message is kept for clients.
