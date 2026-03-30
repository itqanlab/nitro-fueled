# Code Style Review — TASK_2026_147

## Review Summary

| Metric          | Value                                                       |
|-----------------|-------------------------------------------------------------|
| Overall Score   | 5/10                                                        |
| Assessment      | NEEDS_REVISION                                              |
| Blocking Issues | 4                                                           |
| Serious Issues  | 4                                                           |
| Minor Issues    | 3                                                           |
| Files Reviewed  | 6                                                           |
| Verdict         | FAIL                                                        |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`dashboard.component.ts:60–79` — `getStatusValueClass` and `getSessionStatusClass` are plain arrow-function properties assigned to `public readonly`. They are called directly in the template (`[valueClass]="getStatusValueClass('CREATED')"`) on every stat card. Per the codebase rule established in TASK_2026_079, per-item method calls inside `@for` (or any template binding that fires on change detection) must be replaced with precomputed structures. Here the calls are not inside a loop but they still fire on every change detection cycle. More critically, as `TaskStatusKey` grows or statuses are renamed, the `switch` block silently falls through to `''` — no compile-time guard. If a caller passes a new status, the stat card renders with no CSS class and no error.

`dashboard.component.scss:89` and `:105` — Two hardcoded hex values (`#a78bfa` for `status-implemented`, `#ef4444` for `status-blocked`) exist alongside `var(--error)` on line 101 for `status-failed`. `status-failed` uses the CSS variable; `status-blocked` does not, and both are meant to represent error-level states. These will diverge silently if the theme changes. The project color rule is absolute: ALL colors via CSS variables. Six months from now, a theme change will fix `status-failed` but leave `status-blocked` stuck at `#ef4444`.

### 2. What would confuse a new team member?

`dashboard.component.ts:18–49` — The component has 9 public `computed()` signals. Many are single-line delegation chains: `commandCenterData -> tokenCost -> totalTokens` and `commandCenterData -> tokenCost -> totalCost`. Each is `public` and exposed to the template individually. A new developer reading this will reasonably ask: why not expose `tokenCost` directly and access `.totalTokens` and `.totalCost` in the template? The deep flattening adds indirection without explanation.

`dashboard.component.scss:163,175,246,249,262,297` — `.session-id` is defined twice: once at line 174 (inside the "recent sessions" panel, monospace styling for truncated 12-char IDs) and again at line 245 (inside `.session-details`, slightly different font size). The same class name carries different visual contracts depending on which section it appears in. In the SCSS this works because of natural cascade context, but a developer searching for `.session-id` will find two definitions and have to determine which applies where.

### 3. What's the hidden complexity cost?

`dashboard.component.ts` has no `changeDetection: ChangeDetectionStrategy.OnPush`. The `analytics.component.ts` in the same codebase uses `OnPush` (line 21). The project style guide requires `OnPush` for all components. Without it, this component re-runs all signal reads and template bindings on every application-level change detection cycle — even unrelated events from sibling routes. When real API polling is added, this will become a performance liability.

`apps/dashboard/src/app/shared/stat-card/stat-card.component.ts:1–2,47–48` — `StatCardComponent` still uses the old `@Input({ required: true })` decorator syntax with `!` non-null assertion, and `@Component({ imports: [NgClass] })` from `@angular/common`. The dashboard component itself uses `inject()` and signal patterns. Two different DI and input conventions coexist, and the new component does nothing to close that gap — it just calls the old component. This is not a blocker for this task, but the inconsistency grows with each task that reuses `StatCardComponent`.

### 4. What pattern inconsistencies exist?

`dashboard.component.ts:60–84` — Two public arrow-function properties are used as template helpers. The review lesson from TASK_2026_079 is explicit: "Per-item template method calls must be replaced with precomputed collections." And from TASK_2026_080: "`get` accessors that read signals are equivalent to method calls in templates — always use `computed()`." The same principle applies to plain properties used as functions. `getStatusValueClass('CREATED')` is called 7 times in the template (once per stat card). Each call is a function invocation on every change detection cycle. A `computed()` map of `status -> class` evaluated once would be correct and consistent with the rest of the codebase.

`dashboard.component.ts` — Missing `changeDetection: ChangeDetectionStrategy.OnPush`. Every other component reviewed in this codebase (analytics, agent-editor, stat-card) that has been touched recently carries `OnPush`. This is a first-class project standard per `CLAUDE.md`.

`dashboard.component.ts:1` — The import list omits `ChangeDetectionStrategy` and `ChangeDetectionRef` entirely because `OnPush` was never set. This compounds the omission.

`dashboard.model.ts:54` — `ActiveTask.type` and `ActiveTask.priority` are typed as bare `string`. The anti-patterns rule is explicit: "Use typed string unions / enums for status, type, and category fields — not bare `string`." `type` can be `'FEATURE' | 'BUGFIX' | 'REFACTOR' | 'CHORE'` (per existing `Task` model usage in the same file family). `priority` should be `'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low'`. Using bare `string` means template expressions like `task.priority.toLowerCase()` are silently correct for some inputs and silently wrong for others.

### 5. What would I do differently?

1. Add `changeDetection: ChangeDetectionStrategy.OnPush` to `DashboardComponent` immediately — it is a one-line change that closes a whole class of future performance bugs.
2. Replace `getStatusValueClass` with a `readonly statusClassMap` object (`Record<TaskStatusKey, string>`) so the template does a property lookup (`statusClassMap[status]`) and the class definition is exhaustive at compile time.
3. Move both hardcoded hex values to CSS variables in the theme definition file (`--color-implemented`, `--color-blocked`) and reference them via `var()` in the SCSS.
4. Type `ActiveTask.type` and `ActiveTask.priority` as string unions, matching the precision used in every other model in the codebase.

---

## Blocking Issues

### Issue 1: Missing `OnPush` change detection

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:11–17`
- **Problem**: The `@Component` decorator has no `changeDetection` property. Every other recently-touched component in this codebase (analytics, provider-card, etc.) uses `ChangeDetectionStrategy.OnPush`. The project standard (`CLAUDE.md` Angular Rules) requires `OnPush` on all components.
- **Impact**: The component re-evaluates all template bindings on every application-level change detection cycle. When real data integration replaces the mock calls, this will visibly degrade performance and cause spurious re-renders in the dashboard shell.
- **Fix**: Add `changeDetection: ChangeDetectionStrategy.OnPush` to the decorator and import `ChangeDetectionStrategy` from `@angular/core`.

### Issue 2: Hardcoded hex color values in component SCSS

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.scss:89,105`
- **Problem**: `color: #a78bfa` (status-implemented) and `color: #ef4444` (status-blocked) are hardcoded hex values. `status-failed` on line 101 correctly uses `var(--error)`. The project rule in `CLAUDE.md` and `review-lessons/frontend.md` is absolute: "ALL colors via CSS variables. NEVER hardcoded hex/rgb values in components."
- **Impact**: Theme changes will fix `status-failed` but leave `status-implemented` and `status-blocked` visually broken. They diverge silently — no build error, no lint warning.
- **Fix**: Add `--color-implemented` and `--color-blocked` (or reuse `--warning` for `status-blocked` in-review) to the theme file, then reference them via `var()` in the SCSS.

### Issue 3: Template calls plain-function properties on every change detection cycle

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:60–84` and `apps/dashboard/src/app/views/dashboard/dashboard.component.html:17,20,23,26,29,32,35,84`
- **Problem**: `getStatusValueClass` and `getSessionStatusClass` are arrow-function properties called in the template. `getStatusValueClass` is invoked 7 times per template render (once per stat card). The review lesson TASK_2026_079 is explicit: "Per-item template method calls must be replaced with precomputed collections." The same principle applies to any function property used in a binding expression.
- **Impact**: Each function call fires on every change detection cycle. Without `OnPush` this is every cycle in the application. Even with `OnPush`, the `switch` statement runs 7 times whenever the component re-renders instead of being evaluated once.
- **Fix**: Replace both functions with a precomputed `readonly` map: `readonly statusClassMap: Record<TaskStatusKey, string> = { CREATED: 'status-created', ... }`. Template becomes `[valueClass]="statusClassMap[status]"`. This is also exhaustively typed — a missing key is a compile error.

### Issue 4: `ActiveTask.type` and `ActiveTask.priority` typed as bare `string`

- **File**: `apps/dashboard/src/app/models/dashboard.model.ts:54–55`
- **Problem**: Both fields are `readonly type: string` and `readonly priority: string`. The anti-patterns rule: "Use typed string unions / enums for status, type, and category fields — not bare `string`." The `Task` model (`mock-data.constants.ts:54`) uses `priority: 'high' | 'medium' | 'low'` (albeit inconsistently named). The template at `dashboard.component.html:115` computes `task.priority.toLowerCase()` and interpolates into `priority-{{ task.priority.toLowerCase() }}`. If the priority format changes, the CSS class silently breaks with no type error.
- **Impact**: Untyped fields remove compile-time protection from the template interpolation. New priority values added without updating the CSS produce invisible styling failures.
- **Fix**: `type: 'FEATURE' | 'BUGFIX' | 'REFACTOR' | 'CHORE'` and `priority: 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low'` (matching the actual mock data values and SCSS class names).

---

## Serious Issues

### Issue 1: Project name and client hardcoded in template

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.html:5–6`
- **Problem**: `<span class="project-name">nitro-fueled</span>` and `<span class="project-client">local</span>` are hardcoded strings. The `CommandCenterData` model has no `projectName` or `environment` field. This means every project that installs nitro-fueled will show "nitro-fueled / local" on their dashboard.
- **Tradeoff**: Acceptable for MVP, but because `CommandCenterData` is the authoritative data interface for this view, the right fix is to add `projectName` and `environment` to the model rather than leaving raw strings in the template.
- **Recommendation**: Add `readonly projectName: string` and `readonly environment: string` to `CommandCenterData`, populate them in `MOCK_COMMAND_CENTER_DATA`, and bind them in the template. This is a small model change that prevents future confusion.

### Issue 2: `.session-id` CSS class defined twice with different semantics

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.scss:174,245`
- **Problem**: `.session-id` appears twice — once in the "recent sessions" panel context (12-char truncated ID) and once in the active session card details. They have slightly different font sizes (`12px` vs `11px`) and the same monospace styling. The class name suggests identical semantics but the visual treatment diverges.
- **Tradeoff**: Works today because CSS cascade context distinguishes them, but it will confuse any developer modifying session styling who searches for `.session-id` and finds two definitions.
- **Recommendation**: Rename the inner active-session instance to `.session-card-id` or `.active-session-id` to make the distinction explicit.

### Issue 3: `commandCenterData` computed wraps a non-reactive service call

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:21–23`
- **Problem**: `computed(() => this.mockData.getCommandCenterData())` wraps a plain method call that returns a static constant. `computed()` re-executes its factory function when its signal dependencies change. `MockDataService.getCommandCenterData()` has no signal dependencies — it returns `MOCK_COMMAND_CENTER_DATA` directly. The `computed()` wrapper provides no reactivity benefit here; it will evaluate exactly once and never again. All downstream `computed()` signals (`taskBreakdown`, `tokenCost`, etc.) therefore also derive from a one-time evaluation.
- **Tradeoff**: Not a bug today — mock data doesn't change. But when real API integration is added, developers will see a `computed()` chain and assume reactivity is already wired. They may add a signal-based data source inside `MockDataService` without realising the component's `commandCenterData` computed is not tracking it.
- **Recommendation**: Either document this explicitly (`// NOTE: not reactive — will need toSignal() wrapper when switching to real API`) or convert `MockDataService.getCommandCenterData()` to return a `Signal<CommandCenterData>` from the start.

### Issue 4: `rgba()` hardcoded values in box-shadow declarations

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.scss:228,232`
- **Problem**: `box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2)` (running glow) and `box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2)` (paused glow) use raw RGB values. These are the RGB equivalents of `--success` and `--warning` respectively. The project rule covers `rgba()` values too: hardcoded colors are only allowed in theme definition files.
- **Tradeoff**: Glows are cosmetic and will not break functionality. But they are the most visible part of the status indicator — the pulsing dot — and if the theme's success/warning colors change, the glow will mismatch the dot color.
- **Recommendation**: Use CSS `color-mix()` with `transparent` or `color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent)` (supported in all modern browsers). Alternatively add `--success-glow` and `--warning-glow` to the theme.

---

## Minor Issues

- `apps/dashboard/src/app/views/dashboard/dashboard.component.html:54` — `${{ totalCost().toFixed(2) }}` calls `toFixed(2)` in the template. Method calls in templates are a known anti-pattern in this codebase. Add a `readonly costDisplay = computed(() => this.totalCost().toFixed(2))` signal and bind `{{ costDisplay() }}`.
- `apps/dashboard/src/app/services/mock-data.service.ts` is now at approximately 122 lines with a single method per data type returning constants. The service is growing toward a large index of getters. When real API integration arrives, each getter will need to be replaced by an HTTP call. Consider whether this warrants an early split into domain-specific services (e.g., `DashboardDataService`, `McpDataService`) while it is still small.
- `apps/dashboard/src/app/models/dashboard.model.ts:36` — `SessionCost.date` is `readonly date: string`. The field represents a date string but provides no format contract. A consuming developer cannot determine from the type whether this is ISO 8601, a formatted display string, or a Unix timestamp string. Add a JSDoc comment: `/** ISO 8601 date string, e.g. '2026-03-30' */`.

---

## File-by-File Analysis

### `dashboard.model.ts`

**Score**: 6/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The model is clean and uses `readonly` throughout, which is consistent with the project's immutable data conventions. The use of `as const` style typing with a union type for `TaskStatusKey` is correct. The primary problem is that `ActiveTask.type` and `ActiveTask.priority` are bare `string`, losing compile-time safety that the rest of the model correctly provides.

**Specific Concerns**:
1. `ActiveTask.type: string` and `ActiveTask.priority: string` (lines 54–55) — should be typed string unions.
2. `SessionCost.date: string` (line 36) — no format contract documented.

---

### `dashboard.component.ts`

**Score**: 5/10
**Issues Found**: 2 blocking, 1 serious, 0 minor

**Analysis**: The signal-based architecture is structurally sound. `inject()` is used for DI (correct). `computed()` is used for derived state (correct). The file is 85 lines, well under the 150-line limit. However, three issues undermine what is otherwise a clean implementation: missing `OnPush`, function properties used as template helpers, and a non-reactive `computed()` wrapping a static service call.

**Specific Concerns**:
1. No `changeDetection: ChangeDetectionStrategy.OnPush` in decorator (line 11).
2. `getStatusValueClass` and `getSessionStatusClass` are function properties called in the template (lines 60–84) — should be a precomputed map.
3. `commandCenterData = computed(() => this.mockData.getCommandCenterData())` wraps a non-reactive call (line 21) — misleads future developers.

---

### `dashboard.component.html`

**Score**: 6/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

**Analysis**: The Angular 17+ block syntax (`@for`, `@if`) is used correctly throughout. Track expressions are correct (`track session.sessionId`, `track task.taskId`). The template length (122 lines) is within the 50-line inline limit guideline for external HTML files. The structure is readable and well-commented.

**Specific Concerns**:
1. `${{ totalCost().toFixed(2) }}` (line 54) — method call in template, should be a `computed()` signal.
2. Hardcoded `nitro-fueled` and `local` strings (lines 5–6) — should be data-driven.

---

### `dashboard.component.scss`

**Score**: 4/10
**Issues Found**: 2 blocking, 2 serious, 0 minor

**Analysis**: The SCSS is well-structured with clear section comments. The responsive breakpoints are reasonable. The CSS variable usage is mostly correct. However, there are four color violations: two hardcoded hex values (`#a78bfa`, `#ef4444`) and two hardcoded `rgba()` values in `box-shadow`. These are in the most visible parts of the component (status dots and status colors), making them the most likely to diverge from the theme in practice.

**Specific Concerns**:
1. `#a78bfa` at line 89 — hardcoded hex for `status-implemented`.
2. `#ef4444` at line 105 — hardcoded hex for `status-blocked` (inconsistent with `var(--error)` used for `status-failed` at line 101).
3. `rgba(16, 185, 129, 0.2)` at line 228 and `rgba(251, 191, 36, 0.2)` at line 232 — hardcoded glow colors.
4. Duplicate `.session-id` class at lines 174 and 245.

---

### `mock-data.constants.ts` (additions only)

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The new `MOCK_COMMAND_CENTER_DATA` constant (not fully visible in this review but imported cleanly) follows the existing constant naming convention. The import additions are correctly organized. No issues with the additions to this file.

**Specific Concerns**:
1. `SessionCost.date` field values in mock data — format should be documented on the type.

---

### `mock-data.service.ts` (additions only)

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: `getCommandCenterData()` follows the exact same pattern as every other getter in the service. The import is correctly placed. The method is correctly typed. No issues with this addition in isolation.

---

## Pattern Compliance

| Pattern                    | Status | Concern                                                              |
|----------------------------|--------|----------------------------------------------------------------------|
| Signal-based state         | PASS   | `computed()` used throughout; no mutable properties                 |
| `inject()` DI              | PASS   | No constructor injection                                             |
| `@if`/`@for` block syntax  | PASS   | All loops and conditionals use Angular 17+ block syntax              |
| `OnPush` change detection  | FAIL   | Not set on `DashboardComponent`                                      |
| No hardcoded colors        | FAIL   | 4 violations: 2 hex, 2 rgba in SCSS                                  |
| No method calls in template| FAIL   | `getStatusValueClass()` called 7× in template                        |
| Typed string fields        | FAIL   | `ActiveTask.type` and `priority` are bare `string`                   |
| Layer separation           | PASS   | Component reads from service, does not bypass layers                 |
| File size limits           | PASS   | All files within limits                                              |
| Import order               | PASS   | Angular core → third-party → shared → local                         |

---

## Technical Debt Assessment

**Introduced**:
- Non-`OnPush` component that will become a performance concern when real data polling is added.
- `computed()` chain wrapping a static service call — creates a misleading reactivity contract that future developers will trust incorrectly.
- Two hardcoded hex colors that will diverge from the theme silently.
- Untyped `type` and `priority` fields that will cause silent template breakage if formats change.

**Mitigated**:
- The mock-only data model is explicitly scoped and clearly flagged in comments, which prevents false confidence about real-time data.

**Net Impact**: Negative. The four blocking issues each introduce a category of future silent failure that will be difficult to trace back to this PR.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `OnPush` is missing and hardcoded colors violate the absolute color rule. Both must be fixed before this lands. The function-property template calls are a performance and pattern violation. All four blocking issues are small, targeted fixes — this is not a redesign request.

---

## What Excellence Would Look Like

A 10/10 implementation of this feature would:

1. Have `changeDetection: ChangeDetectionStrategy.OnPush` in the decorator from the start.
2. Replace both template helper functions with a single `readonly statusClassMap: Record<TaskStatusKey, string>` — exhaustive, typed, and O(1) in the template.
3. Have zero hardcoded colors, with `--color-implemented` and `--color-blocked` added to the theme and referenced via `var()`.
4. Type `ActiveTask.type` as a string union matching the real task type enum used elsewhere in the codebase.
5. Add `projectName` and `environment` to `CommandCenterData` so the template has no hardcoded strings.
6. Document the non-reactive mock wrapper with a clear `// TODO: replace with toSignal() when real API is wired` comment.
