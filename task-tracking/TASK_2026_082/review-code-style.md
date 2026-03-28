# Code Style Review — TASK_2026_082

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit:** `3d27d36` — feat(dashboard): implement Model Assignments view at /models route
**Verdict:** CHANGES REQUIRED

---

## Summary

4 violations require changes before merge. 7 additional minor findings are lower priority but should be addressed.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Major    | 3 |
| Minor    | 7 |

---

## Critical

### C1 — `assignments-table.component.scss` is 466 lines (limit: 150)

**File:** `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.scss`
**Rule:** Component SCSS max 150 lines
**Lines:** 466 (3× over limit)

The file bundles styles for three distinct responsibilities: the assignment table, the table footer, and the sub-agent section. These should be split by concern. Each child section can either be extracted to its own scoped file or the sub-agent section could be promoted to its own sub-component with its own SCSS file.

---

## Major

### M1 — `app.routes.ts` uses eager loading instead of lazy loading

**File:** `apps/dashboard/src/app/app.routes.ts`
**Rule:** Angular 19 best practices — lazy-loaded feature modules (from task architectural constraint)

All routes eagerly import components at the top of the file. The task specification explicitly requires lazy-loaded feature modules. The pattern should use `loadComponent`:

```ts
// Current (eager — violates constraint)
import { ModelAssignmentsComponent } from './views/models/model-assignments.component';
{ path: 'models', component: ModelAssignmentsComponent }

// Required (lazy)
{ path: 'models', loadComponent: () => import('./views/models/model-assignments.component').then(m => m.ModelAssignmentsComponent) }
```

This applies to all routes in the file, but is within scope only for `ModelAssignmentsComponent` (line 8 import and line 23 route).

---

### M2 — `getProviderBadgeClass` parameter typed as `string` instead of `ProviderType`

**File:** `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts` line 48
**Rule:** TypeScript strict — use defined string literal unions, not loose `string`

```ts
// Current — accepts any string, bypasses ProviderType union
public getProviderBadgeClass(type: string): string {

// Required
public getProviderBadgeClass(type: ProviderType): string {
```

`ProviderType` is already imported indirectly through `AgentAssignment`. It should be imported directly and used here. The same issue applies to `getSubAgentIconClass(color: string)` — but there is no defined type for `iconColor`, so that one is acceptable as `string`.

---

### M3 — `assignments-table.component.html` is 151 lines (limit: 150)

**File:** `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.html`
**Lines:** 151 (1 line over)

Just over the limit. If the sub-agent section is promoted to its own component (as suggested for C1 above), this template would drop well within the limit. The two issues share the same fix.

---

## Minor

### m1 — Unused parameters in stub methods lack `_` prefix

**File:** `apps/dashboard/src/app/views/models/model-assignments.component.ts` lines 24, 36
**Rule:** TypeScript strict — unused variables should be prefixed with `_`

```ts
// Current
public onResetRole(role: string): void { }
public onPresetSelected(presetName: string): void { }

// Correct for stub/mock methods
public onResetRole(_role: string): void { }
public onPresetSelected(_presetName: string): void { }
```

---

### m2 — `activeScope` is a plain class field, not a signal

**File:** `apps/dashboard/src/app/views/models/model-assignments.component.ts` line 18
**Rule:** Angular 19 best practices — reactive state should use signals

```ts
// Current
public activeScope = 'Global Defaults';

// Angular 19 idiomatic
public readonly activeScope = signal('Global Defaults');
// with: this.activeScope.set(label) in setActiveScope()
```

Mutable class fields that drive template bindings bypass Angular's signal-based change detection model. This is especially notable here because Angular 17+ `@for` / `@if` control flow was used throughout, indicating an intent to adopt modern Angular patterns.

---

### m3 — Optgroup constants are untyped in `model-assignment.constants.ts`

**File:** `apps/dashboard/src/app/services/model-assignment.constants.ts` lines 10–43
**Rule:** Explicit typing on exported and module-level constants

`CLAUDE_CLI_OPTGROUP`, `API_ANTHROPIC_OPTGROUP`, `API_OPENAI_OPTGROUP`, `OAUTH_COPILOT_OPTGROUP` use `as const` inference but are not annotated with `ModelOptgroup`. Neither `ModelOptgroup` nor `ModelOption` are imported. If the `ModelOptgroup` interface changes, these constants will silently stay out of sync.

```ts
// Current
const CLAUDE_CLI_OPTGROUP = { ... } as const;

// Better
import { ModelOptgroup } from '../models/model-assignment.model';
const CLAUDE_CLI_OPTGROUP: ModelOptgroup = { ... };
```

Note: `as const` and an interface annotation are not mutually exclusive — the annotation provides the contract check.

---

### m4 — Hardcoded hex colors instead of CSS variables in SCSS

**Files:**
- `model-assignments.component.scss` line 28: `#177ddc40`
- `assignments-table.component.scss` lines 72, 78, 83, 88, 395, 436, 441, 446

Hardcoded hex values (especially semi-transparent variants like `#177ddc40`, `#177ddc20`, `#49aa1920`, `#722ed120`, `#d8961420`) should use CSS custom properties. This breaks theming support and makes color updates error-prone.

```scss
// Current
border: 1px solid #177ddc40;
background: #177ddc20;

// Preferred (if CSS variables are defined in the design system)
border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
// or define: --accent-border: #177ddc40 in global theme
```

At minimum, the same hex literal appearing in multiple files (`#177ddc40` in both `model-assignments.component.scss` and `assignments-table.component.scss`) should be consolidated into a CSS variable.

---

### m5 — Clickable `<div>` elements lack accessibility attributes

**Files:**
- `assignments-table.component.html` line 114: `<div class="sub-agent-header" (click)="toggleSubAgents()">`
- `preset-cards.component.html` line 5: `<div class="preset-card" (click)="onPresetClick(preset.name)">`

Interactive `<div>` elements are not keyboard-accessible and are not announced by screen readers as interactive. Per Angular best practices, these should either use `<button>` elements or include `role="button"` and `tabindex="0"`.

```html
<!-- Option A: Use <button> -->
<button class="sub-agent-header" type="button" (click)="toggleSubAgents()">

<!-- Option B: Add ARIA -->
<div class="sub-agent-header" role="button" tabindex="0"
     (click)="toggleSubAgents()" (keydown.enter)="toggleSubAgents()">
```

---

### m6 — `.cli` and `.budget` preset badge variants share identical styles

**File:** `apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.scss` lines 55–78

Both `.cli` and `.budget` variants use the same colors (`var(--success-bg)` / `var(--success)`). This is implicit duplication and will diverge if one is updated:

```scss
// Current — duplicated
&.budget { background: var(--success-bg); color: var(--success); }
&.cli    { background: var(--success-bg); color: var(--success); }

// Cleaner
&.budget, &.cli { background: var(--success-bg); color: var(--success); }
```

---

### m7 — `getProviderGroups()` return type relies on inference instead of explicit annotation

**File:** `apps/dashboard/src/app/services/mock-data.service.ts` line 111
**Rule:** Consistency — all other public methods in this service have explicit return type annotations

```ts
// Current — inferred return type
public getProviderGroups(): readonly ProviderGroup[] {

// Wait — actually the return type IS annotated here.
```

Correction on review: line 111 does declare `readonly ProviderGroup[]`. No issue here. Disregard this item.

---

## Files With No Issues

- `apps/dashboard/src/app/views/models/model-assignments.component.html` — clean
- `apps/dashboard/src/app/views/models/model-assignments.component.scss` (129 lines, within limit — one hex hardcode noted in m4)
- `apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.ts` — clean
- `apps/dashboard/src/app/models/model-assignment.model.ts` — clean; multiple interfaces in one file is acceptable for co-located domain models

---

## Required Actions Before Merge

1. **[C1]** Split `assignments-table.component.scss` — extract sub-agent styles to a separate concern (either sub-component or scoped partial)
2. **[M1]** Convert `ModelAssignmentsComponent` route to `loadComponent` lazy loading in `app.routes.ts`
3. **[M2]** Change `getProviderBadgeClass(type: string)` to `getProviderBadgeClass(type: ProviderType)` in `assignments-table.component.ts`
4. **[M3]** Resolve the 151-line HTML template (likely resolved as a side-effect of C1 if sub-agents become a child component)
