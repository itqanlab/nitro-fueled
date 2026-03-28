# Code Style Review — TASK_2026_078

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit:** b382677

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 4     |
| Medium   | 3     |
| Low      | 2     |
| **Total**| **12**|

---

## Critical Issues

### C1 — Interfaces defined inside component file
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`, lines 7–16
**Rule:** One interface/type per file.

`QuickAction` and `TeamGroup` are declared at the top of `dashboard.component.ts`. Both must be extracted to their own model files (e.g. `quick-action.model.ts` and `team-group.model.ts`) and imported.

```ts
// Current — violation
interface QuickAction {
  readonly icon: string;
  ...
}
interface TeamGroup {
  readonly team: string;
  ...
}
```

---

### C2 — task-card.component.ts exceeds 150-line component limit
**File:** `apps/dashboard/src/app/shared/task-card/task-card.component.ts`
**Rule:** Components max 150 lines. This file is **271 lines**.

The inline styles block alone (lines 83–267) is 185 lines. The component must be refactored: extract styles to a separate `.scss` file and extract the template to a `.html` file.

---

### C3 — Inline template in task-card.component.ts exceeds 50-line limit
**File:** `apps/dashboard/src/app/shared/task-card/task-card.component.ts`, lines 9–82
**Rule:** Inline templates max 50 lines. This inline template is **~73 lines**.

The template must be extracted to `task-card.component.html`.

---

## High Issues

### H1 — Missing explicit `public` access modifier on `@Input` properties
**Files:**
- `apps/dashboard/src/app/shared/task-card/task-card.component.ts`, line 270
- `apps/dashboard/src/app/shared/stat-card/stat-card.component.ts`, lines 47–49
**Rule:** Explicit access modifiers on ALL class members.

```ts
// task-card.component.ts — violation
@Input({ required: true }) task!: Task;

// stat-card.component.ts — violations
@Input({ required: true }) label!: string;
@Input() valueClass = '';
@Input() sub = '';
```

All `@Input` properties must declare `public` explicitly.

---

### H2 — `track entry.timeAgo` uses a non-stable, non-unique identifier
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.html`, line 142
**Rule:** Angular `@for track` must use unique, stable identifiers.

`entry.timeAgo` is a relative time string (e.g. `"2m"`, `"5m"`). If two activity entries share the same relative time value, Angular cannot distinguish them, causing incorrect DOM reconciliation. The activity model should expose a stable `id` or `index` field for tracking.

```html
<!-- Current — fragile -->
@for (entry of activity; track entry.timeAgo) {
```

---

### H3 — Hardcoded color values in dashboard.component.scss
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.scss`
**Rule:** All colors must use CSS custom properties, not hardcoded hex values.

Violations:
- Line 34: `background: #1a1325` (`.client-pill`)
- Line 35: `color: #9254de` (`.client-pill`)
- Line 36: `border: 1px solid #3a1d5e` (`.client-pill`)
- Line 68: `background: #1a1325` (`.team-pill &.design`)
- Line 69: `color: #9254de` (`.team-pill &.design`)
- Line 242: `background: #1a1325` (`.quick-action-icon &.purple`)
- Line 242: `color: #9254de` (`.quick-action-icon &.purple`)
- Line 244: `background: #112123` (`.quick-action-icon &.teal`)
- Line 244: `color: #13c2c2` (`.quick-action-icon &.teal`)

These must be mapped to named CSS variables (e.g. `--purple-bg`, `--purple`, `--teal-bg`, `--teal`).

---

### H4 — Hardcoded color values in task-card.component.ts inline styles
**File:** `apps/dashboard/src/app/shared/task-card/task-card.component.ts`

- Line 133: `.task-status-indicator.running { background: #111d2c; }` — all other status states use CSS vars; this one is hardcoded
- Line 194: `.task-strategy-badge.refactor { background: #1a1325; color: #9254de; }` — hardcoded; consistent with the pattern violation in H3

---

## Medium Issues

### M1 — Inline `style` attributes in dashboard.component.html
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.html`, lines 67, 95, 112

```html
<div class="card" style="margin-bottom: 20px;">
```

This pattern appears three times. Inline styles should be moved to CSS classes (e.g. `.card--spaced`).

---

### M2 — `[style.margin-bottom]` binding instead of CSS class toggle
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.html`, line 123

```html
<div class="team-grid" [style.margin-bottom]="last ? '0' : '12px'">
```

Inline style bindings are harder to maintain and override. Prefer a CSS class toggle (e.g. `[class.last]="last"` with `.last { margin-bottom: 0; }`).

---

### M3 — `.btn` styles duplicated between dashboard.component.scss and task-card.component.ts
**Files:**
- `apps/dashboard/src/app/views/dashboard/dashboard.component.scss`, lines 79–115
- `apps/dashboard/src/app/shared/task-card/task-card.component.ts`, lines 242–266

The `.btn`, `.btn-sm`, `.btn-icon` styles are defined twice. Because Angular's ViewEncapsulation scopes component styles, the task card needs its own copy — but this indicates these should be global/shared styles in a `styles.scss` or a shared stylesheet, not duplicated per component.

---

## Low Issues

### L1 — Unicode surrogate pair escapes for emoji icons (readability)
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`, lines 41–44

```ts
{ icon: '\uD83D\uDD0D', label: 'Review Code', color: 'orange' },
{ icon: '\uD83D\uDCC4', label: 'Generate Docs', color: 'purple' },
```

Surrogate pair escapes (`\uD83D\uXXXX`) are opaque. Use actual emoji literals directly or a dedicated icon enum/constant for clarity and maintainability.

---

### L2 — dashboard.component.html is 153 lines — exceeds 150-line limit
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.html`
**Rule:** Components (and their templates) max 150 lines.

At 153 lines this is a minor overage (3 lines). The inline style attributes removed in M1 and the `[style.margin-bottom]` binding removed in M2 would bring the file closer to or at the limit.

---

## Files with No Style Issues

- `apps/dashboard/src/app/app.routes.ts` — clean; correct import, no dead code.
- `apps/dashboard/src/app/shared/stat-card/stat-card.component.ts` (beyond H1) — inline template is ~10 lines (well within limit), 50 lines total; no hardcoded colors in styles.

---

## Issue Index by File

| File | Issues |
|------|--------|
| `dashboard.component.ts` | C1, L1 |
| `dashboard.component.html` | H2, M1, M2, L2 |
| `dashboard.component.scss` | H3, M3 |
| `task-card.component.ts` | C2, C3, H1, H4, M3 |
| `stat-card.component.ts` | H1 |
| `app.routes.ts` | — |
