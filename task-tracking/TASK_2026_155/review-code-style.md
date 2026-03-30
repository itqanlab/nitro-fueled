# Code Style Review - TASK_2026_155

## Review Summary

| Metric          | Value          |
| --------------- | -------------- |
| Overall Score   | 6/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 2              |
| Serious Issues  | 4              |
| Minor Issues    | 3              |
| Files Reviewed  | 6              |
| Verdict         | FAIL           |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`project.component.ts:101` — `priorityClassMap` is typed `Record<string, string>` instead of `Record<QueueTaskPriority, string>`. When a new priority value is added to `QueueTaskPriority`, TypeScript will not flag a missing entry here. A task with the new priority silently gets no CSS class, and the badge renders with no visual treatment — a quiet regression with no compile-time signal.

`project.component.scss:232` — `.status-dot` for `status-implemented` uses `var(--purple, #9254de)`. The `--purple` token does not exist in the global theme (`styles.scss` defines none of the standard semantic tokens with that name). The `#9254de` fallback is therefore always used. If a future theme update introduces `--purple` at a different hue, the dot changes color while the corresponding status badge in `.status-badge.status-implemented` references `var(--accent)` — the two representations of the same status diverge silently.

### 2. What would confuse a new team member?

`project.component.html:103-104` — The pattern of conditionally binding `role="button"` and `tabindex="0"` on a `<div>` only for IN_PROGRESS tasks is non-obvious. A new developer reading the template will not immediately understand why keyboard accessibility is selectively applied. The clickability condition (`task.status === 'IN_PROGRESS' && task.sessionId`) is repeated verbatim four times in the list view alone (lines 102, 103, 104, 162) and three more times in the kanban view. If the clickability rule changes, all seven sites must be updated consistently.

`project.component.ts:18` — `StatusFilter` is a local type alias for `QueueTaskStatus | 'ALL'`. The model file already exports `QueueFilter` which contains a `statusFilter: QueueTaskStatus | 'ALL'` field — the same domain concept expressed differently. A new developer will wonder which is canonical, or whether they are the same thing.

### 3. What's the hidden complexity cost?

`project.component.ts:70-75` — `kanbanColumns` is a `computed()` that calls `filteredTasks()`, which is itself a `computed()`. The inner computed iterates the full filtered list 7 times (one per `KANBAN_COLUMNS` entry) to build the column buckets. For mock data this is invisible. When this is replaced with a real task list (100-500 items), every keystroke in the search input triggers 7 linear scans of the filtered array. A single-pass bucket fill (`reduce` into a `Map`) would reduce this to O(n) regardless of column count.

`project.component.scss` — 365 lines. The file size limit defined in the anti-patterns and general review lessons is 300 lines. The handoff acknowledges this but frames it as "all content is necessary." Content being necessary does not exempt a file from the limit — it means the file should be split. The list view styles and kanban view styles are fully independent concerns and could trivially be extracted into `project-list.scss` and `project-kanban.scss` partials.

### 4. What pattern inconsistencies exist?

`project.component.ts:101` — `priorityClassMap` is typed `Record<string, string>` while `statusClassMap` on the same component is correctly typed `Record<QueueTaskStatus, string>`. Inconsistent precision within the same class. The `priorityClassMap` type should be `Record<QueueTaskPriority, string>`.

`project.constants.ts` — Mock data is placed in a file named `project.constants.ts` inside `app/services/`. The established pattern in this codebase is `mock-data.constants.ts` (which already exists in the same `services/` folder) for mock data. Introducing a second constants file for mock data creates two parallel conventions. If mock tasks belong with project-related constants, the file would be more coherent at `app/models/project-queue.mock.ts` or the data should be absorbed into the existing `mock-data.constants.ts`.

`project.component.scss:71` — `.btn-primary:hover` sets `color: #fff` — a hardcoded hex value. All other color references in this file use CSS variables. The project rule is explicit: all colors via CSS variables, never hardcoded hex/rgb in components. `#fff` should be `var(--white)` or `var(--bg-primary)` depending on theme definition.

`project.component.scss` — The `rgba(16, 185, 129, ...)` literal appears 11 times across the file for success-green tints. `--success-bg` is already defined in `styles.scss` as `#162312`. For the "running" background tints specifically, the SCSS should derive from `--success` via a standard tint approach rather than baking in the RGB components of the success color. When the success color changes, all 11 hardcoded `rgba` instances are orphaned.

### 5. What would I do differently?

**Computed clickability predicate** — Extract `isTaskClickable(task)` as a `computed()` collection or a readonly predicate to avoid repeating the multi-condition check 7 times across the template.

**Single-pass kanban bucketing** — Replace the 7-scan `map(status => filteredTasks().filter(...))` with a single `reduce` over `filteredTasks()` that fills a `Map<QueueTaskStatus, QueueTask[]>`, then project the KANBAN_COLUMNS order.

**CSS variables for alpha tints** — Define `--success-tint-10` and `--success-tint-30` tokens in the theme file and reference them everywhere instead of inlining `rgba(16, 185, 129, ...)`.

**Model co-location** — `StatusFilter` local type (component file line 18) vs `QueueFilter.statusFilter` (model file line 36) duplicates the same domain concept. Remove the local alias and use the exported model type.

---

## Blocking Issues

### Issue 1: Hardcoded hex color in component SCSS

- **File**: `project.component.scss:71`
- **Problem**: `.btn-primary:hover { color: #fff; }` uses a hardcoded hex value. Every other color in this file uses CSS variables.
- **Impact**: When the theme is switched or a dark/light mode variation is introduced, this one `#fff` will not respond to the token system. It is directly in violation of the project color rule and the `frontend.md` lesson "Never hardcoded hex colors".
- **Fix**: Replace `#fff` with `var(--white)` or the appropriate theme token. If the token does not exist yet, add it to `styles.scss` alongside other base color tokens.

### Issue 2: SCSS file exceeds the 300-line hard limit

- **File**: `project.component.scss` (365 lines)
- **Problem**: Anti-patterns explicitly state: "Files over 300 lines signal a missing abstraction. Split by concern before the file grows further." The general review lessons confirm this limit.
- **Impact**: The file will only grow as kanban column theming, responsive tweaks, and future view modes are added. At 365 lines it is already past the threshold where splitting is overdue. Technical debt compounds here.
- **Fix**: Extract kanban styles into `_project-kanban.scss` and `@use` or `@forward` it from `project.component.scss`. List-view styles can remain in the primary file or likewise be extracted. This brings the primary file under 300 lines and separates concerns cleanly.

---

## Serious Issues

### Issue 1: `priorityClassMap` typed as `Record<string, string>` instead of `Record<QueueTaskPriority, string>`

- **File**: `project.component.ts:101`
- **Problem**: `statusClassMap` on the same component is correctly typed `Record<QueueTaskStatus, string>`, but `priorityClassMap` uses the weaker `Record<string, string>`. TypeScript will not warn when a `QueueTaskPriority` variant is added to the model without a corresponding CSS class entry.
- **Tradeoff**: None — the stricter type has no downside.
- **Recommendation**: Change to `Record<QueueTaskPriority, string>`.

### Issue 2: `rgba(16, 185, 129, ...)` hardcoded 11 times in SCSS

- **File**: `project.component.scss:29, 75, 80, 172, 205, 206, 217, 224, 225, 226, 337, 338`
- **Problem**: The RGB triple for the success color is encoded 11 times. `--success-bg` already exists in the global theme. The alpha-tinted variants (0.05, 0.08, 0.1, 0.3, 0.4) do not have matching tokens, but the alternative approach of CSS `color-mix()` or defining `--success-tint-*` variables would keep the success color a single source of truth. This is a lesser violation than the `#fff` blocking issue but still inconsistent with the project pattern.
- **Recommendation**: Define `--success-bg-hover` and `--success-glow` tokens in `styles.scss` and replace all `rgba(16, 185, 129, ...)` usages with them.

### Issue 3: `StatusFilter` local type duplicates `QueueFilter.statusFilter` domain concept

- **File**: `project.component.ts:18` and `project-queue.model.ts:36`
- **Problem**: The component defines `type StatusFilter = QueueTaskStatus | 'ALL'` locally. The exported `QueueFilter` interface already models this exact concept as its `statusFilter` field. Two representations of the same domain concept will drift when one is updated.
- **Recommendation**: Export `StatusFilter` from the model file (e.g., `export type StatusFilter = QueueTaskStatus | 'ALL'`) and import it into the component. Alternatively, derive it from the model: `type StatusFilter = QueueFilter['statusFilter']`.

### Issue 4: `kanbanColumns` performs 7 linear scans of `filteredTasks()`

- **File**: `project.component.ts:70-75`
- **Problem**: `KANBAN_COLUMNS.map(status => ({ ..., tasks: this.filteredTasks().filter(t => t.status === status) }))` iterates the full filtered array once per column. With 7 columns this is O(7n) per change-detection cycle. There is no functional bug with mock data, but the pattern is a maintenance trap — when real data arrives, this will be the first place performance degrades and the fix will require understanding the computed signal chain.
- **Recommendation**: Replace with a single `reduce` over `filteredTasks()` into a `Map<QueueTaskStatus, QueueTask[]>`, then project the ordered columns from that map.

---

## Minor Issues

- `project.component.scss:232` — `.status-dot.status-implemented` uses `var(--purple, #9254de)`. The `--purple` token does not exist in the global theme; the fallback is always used. The corresponding status badge uses `var(--accent)`. Two different visual treatments for the same status. Either align both to `var(--accent)` or define `--purple` in the theme.
- `project.component.ts:18` — Local `StatusFilter` type alias should carry a JSDoc comment if it is intentionally kept separate from the model, explaining why it exists alongside `QueueFilter`.
- `project.constants.ts` — File is named `project.constants.ts` and sits in `app/services/`. The naming implies it holds service-layer constants, but it only holds mock data. A mock data file belongs either in `app/models/` alongside the model it seeds, or in the existing `mock-data.constants.ts`. The current placement creates a second convention for mock data.

---

## File-by-File Analysis

### `project-queue.model.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: Clean, well-structured type definitions. All fields are `readonly`. Nullability is explicit (`sessionId: string | null`). Typed string unions are used throughout.

**Specific Concerns**:
1. `StatusFilter = QueueTaskStatus | 'ALL'` is effectively represented by `QueueFilter.statusFilter` — the model could export the type alias directly to be the single source of truth for the component.

---

### `project.constants.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Data is correctly typed against `QueueTask`. The `readonly` array annotation is appropriate. All mock entries are structurally complete and consistent.

**Specific Concerns**:
1. Placement in `app/services/` under a `project.constants.ts` name is inconsistent with how other mock data is organized in this codebase (see `mock-data.constants.ts`).

---

### `project.component.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

**Analysis**: Signal patterns are correctly used. `inject()` for DI. `OnPush` change detection. `computed()` for derived state. `readonly` access modifier on all public fields. Import grouping is correct.

**Specific Concerns**:
1. Line 101: `priorityClassMap: Record<string, string>` should be `Record<QueueTaskPriority, string>`.
2. Lines 70-75: `kanbanColumns` computed does O(7n) work; see serious issue 4.
3. Line 18: Local `StatusFilter` type should be exported from the model to avoid duplication.

---

### `project.component.html`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Uses Angular 17+ block syntax (`@if`, `@for`, `@switch`) correctly. No method calls in the template — all expressions reference signals or precomputed maps. ARIA attributes are present. `track` is correctly applied in all `@for` loops. `aria-hidden` is used on decorative elements.

**Specific Concerns**:
1. Lines 102-104 and 186-190: The `task.status === 'IN_PROGRESS' && task.sessionId` clickability condition is duplicated 7 times across list and kanban views. A precomputed set of clickable task IDs or a `computed()` boolean field would reduce the template duplication risk.

---

### `project.component.scss`

**Score**: 4/10
**Issues Found**: 2 blocking, 2 serious, 1 minor

**Analysis**: The file is structurally well-organized with clear section comments. However, it accumulates two hard-limit violations simultaneously: file size (365 lines vs 300 limit) and hardcoded colors (`#fff`, 11x `rgba(16, 185, 129, ...)` instances).

**Specific Concerns**:
1. Line 71: `color: #fff` — hardcoded hex in a component stylesheet (blocking).
2. 365 total lines — exceeds 300-line limit (blocking).
3. Lines 29, 75, 80, 172, 205-206, 217, 224-226, 337-338: `rgba(16, 185, 129, ...)` used 11 times (serious).
4. Line 232: `var(--purple, #9254de)` — references an undefined token with a hardcoded fallback.

---

### `app.routes.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: The route addition follows the existing `loadComponent` lazy-loading pattern exactly. No issues found. The route is consistent with all other non-core view routes in the file.

---

## Pattern Compliance

| Pattern                  | Status | Concern                                                                        |
| ------------------------ | ------ | ------------------------------------------------------------------------------ |
| Signal-based state       | PASS   | Signals, computed, and readonly class fields used correctly                    |
| Angular 17+ template syntax | PASS | `@if`/`@for` used throughout, no `*ngIf`/`*ngFor`                           |
| `inject()` for DI        | PASS   | Constructor injection absent                                                   |
| `OnPush` change detection | PASS   | Applied                                                                        |
| `standalone: true`       | PASS   | Applied                                                                        |
| Type safety              | FAIL   | `priorityClassMap: Record<string, string>` is under-typed                      |
| All colors via CSS vars  | FAIL   | `#fff` at line 71; 11 `rgba(16, 185, 129, ...)` literals in SCSS              |
| File size limits         | FAIL   | SCSS at 365 lines exceeds 300-line hard limit                                  |
| No method calls in template | PASS | All values are signals or precomputed maps                                  |
| Lazy route loading       | PASS   | `loadComponent` pattern followed correctly                                     |

---

## Technical Debt Assessment

**Introduced**:
- 11 hardcoded `rgba(16, 185, 129, ...)` instances that will not respond to success-color theme changes.
- O(7n) kanban bucketing that will become a visible bottleneck when mock data is replaced with real API data.
- `StatusFilter` local type that duplicates a concept already expressed in the model layer.

**Mitigated**:
- Precomputed class and label maps (`statusClassMap`, `priorityClassMap`, `statusLabelMap`) correctly avoid per-render function evaluation — a pattern learned from prior task reviews.
- Angular 17+ block syntax throughout — no old structural directives.

**Net Impact**: Slightly negative. The hardcoded color debt and SCSS file size will compound as the view grows. The O(7n) scan is invisible today and painful later.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: Two blocking violations must be resolved before this file ships: `#fff` hardcoded color in SCSS (line 71) and SCSS file size at 365 lines exceeding the 300-line limit. Both are first-class project standards, not preferences.

## What Excellence Would Look Like

A 10/10 implementation would:
1. Define CSS token aliases (`--success-tint-10`, `--success-tint-30`, `--success-glow`) in `styles.scss` and reference them exclusively — zero `rgba(...)` literals in component stylesheets.
2. Split SCSS into `project-list.scss` and `project-kanban.scss` partials, keeping each file under 200 lines and the host under 300.
3. Type `priorityClassMap` as `Record<QueueTaskPriority, string>` for compile-time exhaustiveness.
4. Use a single-pass `reduce` for kanban bucketing.
5. Export `StatusFilter` from the model file, making the component import it rather than re-declare it locally.
