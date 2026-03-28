# Code Style Review — TASK_2026_083

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Scope:** New Task view — models, components, service, routes

---

## Summary

The implementation is largely clean and well-structured. Sub-components are correctly split, signal inputs/outputs are used properly, and access modifiers are explicit throughout. There are 4 high-severity violations of explicit project conventions and several medium/low concerns detailed below.

---

## HIGH — Explicit Convention Violations

### H1. `as` Type Assertions in Event Handlers
**Files:** `new-task.component.ts:78, 82, 98`
**Convention:** "No `as` type assertions — if the type system fights you, the type is wrong"

Three DOM type assertions in event handlers:
```typescript
// line 78
this.title = (event.target as HTMLInputElement).value;

// line 82
this.description = (event.target as HTMLTextAreaElement).value;

// line 98
this.modelOverrides[role] = (event.target as HTMLSelectElement).value;
```
The idiomatic Angular approach is to use typed event bindings or reactive forms, avoiding unsafe DOM casts entirely. With reactive forms (or `[(ngModel)]`), none of these casts would be needed.

---

### H2. Bare `href="#"` Instead of `routerLink`
**File:** `new-task.component.html:6`

```html
<a href="#">e-commerce-api</a>
```
A bare fragment link causes a scroll-to-top side effect and bypasses Angular's router. All in-app navigation must use `[routerLink]`. This is a confirmed routing regression pattern in Angular projects.

---

### H3. Eager Route Registration — No Lazy Loading
**File:** `app.routes.ts:8-10`

```typescript
import { ModelAssignmentsComponent } from './views/models/model-assignments.component';
import { NewTaskComponent } from './views/new-task/new-task.component';
import { OnboardingComponent } from './views/onboarding/onboarding.component';
```
All three new components are registered as eager imports. The architecture constraint explicitly requires: "Production-grade Angular: lazy-loaded feature module." Routes for `models`, `new-task`, and `onboarding` must use `loadComponent` (or `loadChildren` for feature modules).

---

### H4. Inline Mock Data in `getProviderGroups()` — Breaks Service Convention
**File:** `mock-data.service.ts:111–116`

```typescript
public getProviderGroups(): readonly ProviderGroup[] {
  return [
    { provider: 'Anthropic', models: ['Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4'] },
    { provider: 'OpenAI', models: ['GPT-4o', 'Codex Mini'] },
  ];
}
```
Every other method in `MockDataService` delegates to a `MOCK_*` named constant (imported from a constants file). This method inlines the data directly. This breaks the established pattern: data must live in a `MOCK_PROVIDER_GROUPS` constant in an appropriate constants file, not inline in the service method.

---

## MEDIUM — Best Practice Deviations

### M1. `[value]` + `(input)` Pattern Instead of Reactive Forms or `ngModel`
**File:** `new-task.component.html:25–26, 35–36`

```html
[value]="title"
(input)="onTitleInput($event)"
```
This is a manual two-binding emulation. It requires the `as HTMLInputElement` type assertions flagged in H1 and is precisely the pattern that reactive forms or `[(ngModel)]` eliminate. For a production Angular form with multiple fields, this approach does not scale and deviates from Angular best practices.

---

### M2. `autoDetectLabel` Getter Hardcodes `'FEATURE'` Regardless of Selection
**File:** `new-task.component.ts:68–71`

```typescript
public get autoDetectLabel(): string | null {
  if (!this.description.trim()) return null;
  return 'FEATURE \u2014 based on keywords';
}
```
The returned label always says `'FEATURE'` regardless of `this.selectedStrategy`. The label should reflect the actual selected strategy (or detected strategy). As written, selecting "Bugfix" and typing a description still shows "FEATURE — based on keywords". This is a placeholder stub that was not replaced with real logic.

---

### M3. `.btn` and `.badge` Styles Defined Locally in Component SCSS
**File:** `new-task.component.scss:253–280, 335–385`

`.badge`, `.badge--blue/purple/orange/green`, `.btn`, `.btn-ghost`, `.btn-secondary`, `.btn-primary`, `.btn-lg` are all defined inside this component's stylesheet. These are generic utility classes that are used (or will be used) across views. Defining them per-component leads to duplication and drift. They belong in a shared stylesheet or a shared component library.

---

## LOW — Minor Style Concerns

### L1. Raw `#fff` Hex Values Break CSS Variable Pattern
**File:** `new-task.component.scss:200, 373, 379`

```scss
background: #fff;       // line 200 — toggle knob
color: #fff;            // line 373 — .btn-primary
color: #fff;            // line 379 — .btn-primary:hover
```
The rest of the stylesheet consistently uses CSS custom properties (`var(--text-primary)`, `var(--bg-primary)`, etc.). Three instances use raw `#fff`. A `--color-white` or `--text-on-accent` token would keep the stylesheet consistent and support potential theme overrides.

---

### L2. Attachment Zone is Non-Interactive — `cursor: pointer` Without Handler
**File:** `new-task.component.html:42–44`, `new-task.component.scss:127`

```html
<div class="attachment-zone">
  &#x1F4CE; Drop files here or click to browse...
</div>
```
The element has `cursor: pointer` in CSS (line 127) but no `(click)` handler, no `<input type="file">`, and no drag event handlers. If this is intentional placeholder UI, the cursor style should not suggest interactivity. If it is meant to be functional, it needs an accessible interactive element (`<button>` or `role="button"` with event bindings).

---

## Findings Table

| ID | Severity | File | Line(s) | Issue |
|----|----------|------|---------|-------|
| H1 | HIGH | `new-task.component.ts` | 78, 82, 98 | `as` type assertions in event handlers |
| H2 | HIGH | `new-task.component.html` | 6 | Bare `href="#"` — must use `routerLink` |
| H3 | HIGH | `app.routes.ts` | 8–10, 22–24 | Eager imports — must use lazy loading (`loadComponent`) |
| H4 | HIGH | `mock-data.service.ts` | 111–116 | Inline mock data — must extract to `MOCK_*` constant |
| M1 | MEDIUM | `new-task.component.html` | 25–26, 35–36 | `[value]`+`(input)` pattern — use reactive forms or `ngModel` |
| M2 | MEDIUM | `new-task.component.ts` | 68–71 | `autoDetectLabel` always returns `'FEATURE'` (stub not replaced) |
| M3 | MEDIUM | `new-task.component.scss` | 253–280, 335–385 | `.btn` and `.badge` utility classes defined locally |
| L1 | LOW | `new-task.component.scss` | 200, 373, 379 | Raw `#fff` hex instead of CSS variable token |
| L2 | LOW | `new-task.component.html` | 42–44 | `cursor: pointer` on non-interactive `<div>` |

---

## What Passed

- All class members have explicit access modifiers (`public`, `private`) ✓
- No `any` types used ✓
- `readonly` used on all immutable data members and model interfaces ✓
- Signal inputs/outputs used correctly in sub-components ✓
- `ChangeDetectionStrategy.OnPush` applied to all three components ✓
- Sub-components correctly split into their own files ✓
- `@if` / `@for` Angular 17+ control flow syntax used throughout ✓
- `track` expressions provided in all `@for` loops ✓
- Model interfaces defined in dedicated model file (not inline in components) ✓
- `new-task.component.ts` at 104 lines — within 150-line limit ✓
- `new-task.component.html` at 143 lines — within 150-line limit ✓
- `MockDataService` at 117 lines — within 200-line limit ✓
