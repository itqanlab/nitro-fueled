# Code Logic Review — TASK_2026_092

**Reviewer:** nitro-code-logic-reviewer
**Date:** 2026-03-28
**Scope:** Angular <-> NestJS integration + CLI build pipeline update

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major    | 3 |
| Minor    | 5 |
| Info     | 2 |

**Verdict:** PASS with minor issues

---

## Issues Found

### Major Issues

#### 1. Division by Zero Risk in provider-hub.component.ts

**File:** `apps/dashboard/src/app/views/providers/provider-hub.component.ts`
**Lines:** 18-19

```typescript
public readonly budgetPercent =
  this.data.costSummary.totalCost / this.data.costSummary.budget;
```

**Problem:** If `budget` is 0, this produces `Infinity` or `NaN` which propagates to `budgetBarWidth`. While `Math.min(100, Infinity)` returns 100, `Math.min(100, NaN)` returns `NaN`, which would break the UI.

**Risk:** Runtime UI corruption if budget is zero.

**Fix:** Guard against zero budget:
```typescript
public readonly budgetPercent =
  this.data.costSummary.budget > 0
    ? this.data.costSummary.totalCost / this.data.costSummary.budget
    : 0;
```

---

#### 2. Type Assertion Bypasses Safety in dashboard.adapters.ts

**File:** `apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts`
**Line:** 21

```typescript
type: r.type === 'REFACTORING' ? 'REFACTOR' : (r.type as Task['type']),
```

**Problem:** The `as Task['type']` assertion bypasses TypeScript's type checking. If `TaskRecord.type` contains a value not in `Task['type']` union (other than 'REFACTORING'), this silently passes invalid data.

**Risk:** Runtime type mismatch if API returns unexpected task type values.

**Fix:** Add exhaustive mapping or validation:
```typescript
function mapTaskType(apiType: TaskRecord['type']): Task['type'] {
  switch (apiType) {
    case 'REFACTORING': return 'REFACTOR';
    case 'FEATURE': return 'FEATURE';
    case 'BUGFIX': return 'BUGFIX';
    // ... exhaustive cases
    default: return 'FEATURE'; // explicit fallback
  }
}
```

---

#### 3. socket.io-client in devDependencies Instead of dependencies

**File:** `package.json`
**Lines:** 18-19

```json
"devDependencies": {
  "socket.io-client": "^4.8.1",
```

**Problem:** `socket.io-client` is imported at runtime by `websocket.service.ts` but is listed under `devDependencies`. When dependencies are pruned for production (`npm ci --omit=dev`), this package will be missing.

**Risk:** Production build failure or runtime error when WebSocket service initializes.

**Fix:** Move `socket.io-client` from `devDependencies` to `dependencies`:
```json
"dependencies": {
  "socket.io-client": "^4.8.1",
  // ... other runtime deps
}
```

---

### Minor Issues

#### 4. Missing Access Modifier on events$ in websocket.service.ts

**File:** `apps/dashboard/src/app/services/websocket.service.ts`
**Line:** 13

```typescript
readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();
```

**Problem:** Per project conventions, all class members require explicit access modifiers (`public`, `private`, `protected`). The `events$` property lacks the `public` modifier.

**Impact:** Low — code works correctly, but violates codebase conventions.

**Fix:** Add explicit modifier:
```typescript
public readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();
```

---

#### 5. Daily Costs Lose Date Information in analytics.adapters.ts

**File:** `apps/dashboard/src/app/views/analytics/analytics.adapters.ts`
**Lines:** 52-54

```typescript
const dailyCosts = (cost?.sessions ?? [])
  .slice(-30)
  .map((session, index) => ({ day: index + 1, amount: session.totalCost }));
```

**Problem:** Uses array index as `day` value (1, 2, 3...) instead of actual session dates. This loses temporal information and makes gaps in data invisible.

**Impact:** Chart X-axis will show "Day 1, Day 2..." instead of actual dates. Non-contiguous dates appear contiguous.

---

#### 6. Effect Writing to Mutable Properties in dashboard.component.ts

**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`
**Lines:** 112-121

```typescript
constructor() {
  effect(() => {
    this.activeTasks = this.activeTasksSignal();
    this.completedTasks = this.completedTasksSignal();
    this.analytics = this.analyticsSignal();
    // ...
  });
}
```

**Problem:** Effect copies signal values to mutable class properties. This creates duplicate state that can get out of sync and is considered an Angular signals anti-pattern.

**Impact:** Works correctly but adds unnecessary complexity. Prefer accessing signals directly in templates: `{{ activeTasksSignal() }}`.

---

#### 7. OnPush + Mutable Property Pattern in analytics.component.ts

**File:** `apps/dashboard/src/app/views/analytics/analytics.component.ts`

**Problem:** Component uses `ChangeDetectionStrategy.OnPush` but updates mutable properties in an effect. While effects do trigger change detection, this pattern is fragile and inconsistent with OnPush semantics.

**Impact:** Currently works but could break if effect timing changes in future Angular versions.

---

#### 8. Assumed Numeric currentVersion in agent-editor.store.ts

**File:** `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts`
**Line:** 139

```typescript
this.selectedAgent.set({ ...agent, currentVersion: agent.currentVersion + 1 });
```

**Problem:** Assumes `currentVersion` is always defined and numeric. If undefined, this produces `NaN`.

**Impact:** Low risk since this is mock data, but defensive coding would use `(agent.currentVersion ?? 0) + 1`.

---

### Info

#### 9. Stub Methods in Components

Several components have stub methods with "Mock: would..." comments:

- `model-assignments.component.ts`: `onResetRole()`, `onResetAll()`, `onSave()`, `onPresetSelected()`
- `new-task.component.ts`: `onSaveDraft()`, `onStartTask()` (console.log only)
- `provider-hub.component.ts`: `onToggleModel()` (no-op)

**Status:** Acknowledged as intentional — these require future API integration.

---

#### 10. Unused Class Properties in dashboard.component.ts

```typescript
public readonly agents: readonly Agent[] = [];
public readonly activity: readonly never[] = [];
public teamGroups: readonly TeamGroup[] = [];
```

**Status:** These are declared but never populated. Acceptable as placeholders for future functionality.

---

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| api.service.ts | PASS | Clean typed HTTP methods |
| websocket.service.ts | MINOR | Missing access modifier (Issue #4) |
| environment.ts | PASS | Dev config |
| environment.prod.ts | PASS | Empty strings for same-origin |
| dashboard.adapters.ts | MAJOR | Type assertion (Issue #2) |
| analytics.adapters.ts | MINOR | Date info lost (Issue #5) |
| app.config.ts | PASS | HttpClient provider added |
| project.json | PASS | File replacements configured |
| dashboard.component.ts | MINOR | Effect anti-pattern (Issue #6) |
| analytics.component.ts | MINOR | OnPush pattern (Issue #7) |
| status-bar.component.ts | PASS | Clean implementation |
| sidebar.component.ts | PASS | Uses constant file |
| mcp-integrations.component.ts | PASS | Uses constant file |
| model-assignments.component.ts | INFO | Stub methods |
| new-task.component.ts | INFO | Stub methods |
| provider-hub.component.ts | MAJOR | Division by zero (Issue #1) |
| agent-editor.store.ts | MINOR | Undefined safety (Issue #8) |
| apps/cli/package.json | PASS | Correct path |
| package.json | MAJOR | socket.io-client in devDependencies (Issue #3) |

---

## Recommendations

1. **Fix Issue #1** (division by zero) before production use
2. **Fix Issue #2** (type assertion) for robustness against API schema changes
3. **Fix Issue #3** (socket.io-client in devDependencies) before production build
4. **Fix Issue #4** (missing access modifier) per codebase conventions
5. Issues #5-8 are acceptable for MVP but should be addressed in future iterations
