# Code Style Review — TASK_2026_160

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | OpenCode |
| Task | TASK_2026_160 — Shared Badge, StatusIndicator, and EmptyState components |
| Files Reviewed | 7 scoped implementation files listed in `handoff.md` |
| Verdict | FAIL |

---

## Findings

### SERIOUS

#### S1 — New shared presentational components omit explicit `OnPush` change detection

**Files**:
- `apps/dashboard/src/app/shared/badge/badge.component.ts:1-63`
- `apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts:1-60`
- `apps/dashboard/src/app/shared/empty-state/empty-state.component.ts:1-61`

These three new reusable UI components are simple input-driven presentation components, but none of them sets `changeDetection: ChangeDetectionStrategy.OnPush`. In the same task scope, the feature views importing them (`dashboard.component.ts` and `analytics.component.ts`) do use `OnPush`, and the handoff explicitly documents `OnPush` as a task decision. Leaving the shared components on Angular's default change detection is a style and consistency regression for this codebase's component patterns.

**Recommendation**: Import `ChangeDetectionStrategy` in each new shared component and set `changeDetection: ChangeDetectionStrategy.OnPush` in the component metadata.

---

### MINOR

#### M1 — Derived `badgeClass` view data is dead code after the badge refactor

**File**: `apps/dashboard/src/app/views/analytics/analytics.component.ts:89-93`

`recomputeDerived()` still reshapes each agent row with a `badgeClass` property:

```typescript
this.agentRows = this.data.agentPerformance.map(a => ({
  ...a,
  badgeClass:
    a.successRate >= 90 ? 'badge-high' : a.successRate >= 80 ? 'badge-medium' : 'badge-low',
}));
```

The scoped template no longer consumes that field after switching to `<app-badge>` and instead recomputes the badge variant inline in `analytics.component.html`. Keeping unused derived state around makes the view-model shaping noisier and harder to follow.

**Recommendation**: Remove the unused `badgeClass` shaping, or replace it with a derived field the template actually binds to directly.

---

## Scoped File Notes

| File | Verdict | Notes |
|------|---------|-------|
| `apps/dashboard/src/app/shared/badge/badge.component.ts` | FAIL | Clean small component, but it should declare `OnPush` like the rest of the Angular task scope. |
| `apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts` | FAIL | Reusable input-only component missing explicit `OnPush`. |
| `apps/dashboard/src/app/shared/empty-state/empty-state.component.ts` | FAIL | Reusable input/output component missing explicit `OnPush`. |
| `apps/dashboard/src/app/views/dashboard/dashboard.component.html` | PASS | Shared-component adoption is consistent and readable. |
| `apps/dashboard/src/app/views/dashboard/dashboard.component.ts` | PASS | Imports and computed view state stay consistent with local conventions. |
| `apps/dashboard/src/app/views/analytics/analytics.component.html` | PASS WITH NOTES | Badge and status-indicator usage is consistent, but the badge variant is still recomputed inline. |
| `apps/dashboard/src/app/views/analytics/analytics.component.ts` | FAIL | Leaves behind unused derived `badgeClass` state after the shared badge migration. |

---

## Final Verdict

| Verdict | FAIL |

The scoped implementation is close, but the missing `OnPush` declarations on the new shared components and the dead derived badge state mean it does not fully meet the repo's current code style conventions.
