# Code Style Review - TASK_2026_166

## Review Summary

| Metric          | Value                       |
| --------------- | --------------------------- |
| Overall Score   | 5/10                        |
| Assessment      | NEEDS_REVISION              |
| Blocking Issues | 4                           |
| Serious Issues  | 5                           |
| Minor Issues    | 4                           |
| Files Reviewed  | 4                           |
| Verdict         | FAIL                        |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`vm` and `loading` are writable `signal()` instances exposed as `public`, so any future
developer — or a unit test — can call `component.vm.set(...)` from outside the class and
silently corrupt the display state. The signals are driven exclusively by the private
`effect()` in the constructor, but that contract is invisible to callers because the signals
are public and mutable. The pattern should be `private readonly _vm = signal(...)` with a
`public readonly vm = this._vm.asReadonly()`, or use `computed()` directly (see Blocking
Issue 1).

The `@keyframes pulse-dot` uses hardcoded `rgba(23, 125, 220, 0.4)` and
`rgba(23, 125, 220, 0)` at lines 158–159 of the SCSS. When the theme is updated or a
dark-mode palette is swapped in, the animation will use the wrong colour and this will not
be caught because hardcoded values don't surface in a token diff.

### 2. What would confuse a new team member?

The `vm` / `loading` signal + `viewModelComputed` computed + `effect()` pattern is a
three-layer indirection for a two-step operation. The component holds a private
`viewModelComputed` that is never read in the template (confirmed by Grep — all template
bindings go through `vm()`). The `effect()` then copies the computed into `vm`. A new
developer will see the `computed()`, assume the template uses it, search the template, find
nothing, then hunt for the copy-in-effect. This is unnecessary indirection.

The `TaskDataBundle` type alias lives in the component file (line 34–39 in
`task-detail.component.ts`), not in `task-detail.model.ts`. The anti-pattern rule states:
"Interfaces and types must be defined at module scope in `*.model.ts` files — never inside
component or function bodies."

### 3. What's the hidden complexity cost?

`workerRows()` is called four times in the template (lines 210, 230, 336, 349) across three
separate sections: "Model & Provider Info", "Launcher Info", and "Worker Activity". Each
call invokes the `computed()` function. Because Angular's `computed()` memoises between
change detection cycles this is not a runtime performance problem today, but it means the
same data is iterated four times in the template, and any future addition of a fifth table
that re-uses workers requires a fifth callsite rather than a structural refactor. The real
cost is readability and maintenance consistency.

The component stands at 234 lines, which exceeds the 150-line component limit from the
review-lessons. The HTML template is 506 lines against the 50-line inline limit (external
file is the right call, but the volume signals a split may be warranted).

### 4. What pattern inconsistencies exist?

The sibling `task-trace.component.ts` (same codebase) exposes `viewModel`, `tasksLoading`,
and `traceLoading` as plain mutable class properties (not signals) and copies them from
effects, following the old pre-signals pattern. `task-detail.component.ts` follows the
newer signals-based pattern — but incompletely, because `vm` and `loading` are still
mutable writable signals rather than `asReadonly()` projections of private signals, which
is the idiomatic pattern when a signal must be externally read but not externally written.

The `[class]="r.score >= 7 ? 'quality-good' : r.score >= 4 ? 'quality-warn' : 'quality-bad'"`
binding on line 320 of the HTML violates the well-documented rule from review-lessons:
"`[class]='computed()'` overwrites ALL static classes." The element at line 319 has
`class="quality-card"` on the parent, but the `quality-score` `div` at line 320 has no
static class combined with the `[class]` binding, so while it does not trigger the
specific bug today, it also encodes conditional display logic as an inline ternary
expression inside a template binding rather than as a `computed()` signal — which directly
violates the "template expressions must not call methods or evaluate logic" rule. The
lesson from TASK_2026_203 says: "`computed()` signals on components must always be
`public readonly`"; a precomputed `qualityCards` array with a `scoreClass` field should be
used instead.

### 5. What would I do differently?

- Remove `viewModelComputed` and `vm` signal entirely; make `vm` a direct `computed()`
  alias of the adapter call, exposed via `asReadonly()` if external mutation protection is
  needed.
- Replace `loading` signal with a `computed(() => this.dataSignal() === undefined)` (note:
  `toSignal` with `initialValue` returns that value synchronously, so `=== undefined` would
  use the pre-`initialValue` state — alternatively drive loading purely from `dataSignal()
  === null` and rely on `initialValue` being `null`).
- Move `TaskDataBundle` to `task-detail.model.ts`.
- Replace the ternary `[class]=` binding with a precomputed `qualityCards` computed signal
  that includes a `scoreClass` field.
- Fix the SCSS animation `rgba` values to reference CSS variables with appropriate opacity.
- Add SCSS rules for `.h-timeline-arrow` and the entire flow-override block which are
  missing from the stylesheet.

---

## Blocking Issues

### Issue 1: `vm` and `loading` are mutable public signals — `viewModelComputed` is never directly used

- **File**: `task-detail.component.ts:96–104, 204–211`
- **Problem**: The component defines a private `viewModelComputed` (a `computed()` that
  calls the adapter), then an `effect()` that copies it into a writable public `vm` signal.
  The `vm` signal is then used in the template. This is unnecessary indirection. The
  computed already has memoisation and change-propagation semantics. Wrapping it in a
  writable signal and copying via effect strips away that safety — any caller can call
  `vm.set(null)` and the template goes blank with no type error and no console warning.
- **Impact**: Public writability allows accidental or malicious mutation from tests,
  directives, or future child components that hold a reference. The signal-to-computed
  pattern is also the anti-pattern documented in review-lessons (T08, TASK_2026_203):
  "use `computed()` for derived state, not mutable properties with manual recalculation."
- **Fix**: Remove the `vm` writable signal and the `viewModelComputed` private field.
  Rename `viewModelComputed` to `vm` and declare it `public readonly`. If needed, the
  `loading` state can be a `computed(() => this.dataSignal() === null)`.

### Issue 2: Hardcoded `rgba` color values in SCSS animation

- **File**: `task-detail.component.scss:158–159`
- **Problem**: The `@keyframes pulse-dot` block contains `rgba(23, 125, 220, 0.4)` and
  `rgba(23, 125, 220, 0)` — raw hex-derived color values that bypass the project's CSS
  variable token system.
- **Impact**: Anti-patterns rule states "NEVER use hardcoded hex/rgba colors — use CSS
  variable tokens or the project's design token system." Review-lessons (T08, TASK_2026_203)
  reinforces this. The blue hue (`#177ddc`) matches NG-ZORRO's processing color; if the
  theme palette changes, this animation will silently diverge.
- **Fix**: Replace with `rgba(var(--running-rgb), 0.4)` or a project-defined CSS variable
  such as `var(--running-glow)`. Add the variable to the project theme if it does not
  exist.

### Issue 3: `TaskDataBundle` type defined inside component file — not in model file

- **File**: `task-detail.component.ts:34–39`
- **Problem**: The `type TaskDataBundle` alias is declared at module scope inside the
  component `.ts` file, not in `task-detail.model.ts`. The anti-patterns rule states:
  "Interfaces and types must be defined at module scope in `*.model.ts` files — never
  inside component or function bodies."
- **Impact**: The type is directly relevant to the adapter contract. Keeping it hidden
  inside the component file means the adapter and any test that instantiates a
  `TaskDataBundle` must import from the component, creating a backwards dependency on the
  UI layer.
- **Fix**: Move `TaskDataBundle` to `task-detail.model.ts` and import it from there.

### Issue 4: `.h-timeline-arrow` and `.flow-override-*` CSS classes are referenced in the template but have no SCSS rules

- **File**: `task-detail.component.html:105` and `task-detail.component.html:475–503`
- **Problem**: The template uses `.h-timeline-arrow` (line 105) and the entire
  `.flow-override-section`, `.flow-override-body`, `.flow-override-label`,
  `.flow-override-controls`, `.flow-override-select`, `.flow-override-saving`, and
  `.flow-override-badge` classes (lines 475–503), none of which exist anywhere in
  `task-detail.component.scss`.
- **Impact**: These elements will render with zero layout styling. The flow-override
  section is an interactive control — the unstyled `<select>` and status text will look
  broken. The `.h-timeline-arrow` `&rarr;` will render inline with no spacing, making
  the horizontal timeline hard to read.
- **Fix**: Add corresponding SCSS rules for all missing classes.

---

## Serious Issues

### Issue 1: `[class]=` binding with inline ternary in template (quality-score)

- **File**: `task-detail.component.html:320`
- **Problem**: `[class]="r.score >= 7 ? 'quality-good' : r.score >= 4 ? 'quality-warn' : 'quality-bad'"` encodes conditional logic inline in the template. Review-lesson from TASK_2026_079 and frontend.md states: "per-item template method calls must be replaced with precomputed collections." This ternary fires on every change detection cycle for every review item.
- **Tradeoff**: With `OnPush` and a small review list the performance impact is minimal
  today. The maintainability impact is what matters — this logic will be duplicated if a
  second component needs the same colour mapping.
- **Recommendation**: Add a `scoreClass` field to the `ReviewEntry` model (or a separate
  display model) and precompute it in a `qualityCards` computed signal, eliminating the
  inline ternary.

### Issue 2: `workerRows()` called four times across three unrelated sections

- **File**: `task-detail.component.html:210, 230, 336, 349`
- **Problem**: The "Model & Provider Info" section, the "Launcher Info" section, and the
  "Worker Activity" section each call `workerRows()` separately. The data is identical in
  each case; the only difference is which columns are rendered. A future developer adding a
  new per-worker section would add a fifth `workerRows()` callsite without realising the
  data is already iterated three times above.
- **Tradeoff**: Angular's `computed()` memoises, so this is not a current performance
  issue. But three separate sections displaying overlapping subsets of the same data is a
  UX design smell that suggests the worker table should be one section with toggleable
  column groups, not three separate tables.
- **Recommendation**: At minimum, document the intentional three-section split with a
  comment. Ideally consolidate into one worker table with configurable visible columns.

### Issue 3: `effect()` in constructor setting mutable state — side effects not tracked

- **File**: `task-detail.component.ts:204–225`
- **Problem**: There are two `effect()` calls inside the constructor, both writing back
  to mutable signals (`vm.set`, `loading.set`, `selectedFlowOverrideId.set`). Writing to
  signals inside effects is the pattern Angular 17+ marks as potentially producing
  `ExpressionChangedAfterItHasBeenChecked` errors and documents as requiring
  `allowSignalWrites: true` in strict contexts. There is no such flag here, meaning this
  relies on default permissive behaviour that may be tightened in future Angular versions.
- **Recommendation**: Convert the first effect to a `computed()` (see Blocking Issue 1).
  Convert the second effect (flow override initialisation) to read `contextData` from the
  computed vm directly rather than from `dataSignal()?.contextData`, and use
  `allowSignalWrites: true` explicitly if the effect must write.

### Issue 4: `h-timeline-node` uses `flex: 1` + `flex-direction: column` simultaneously with `h-timeline-arrow`

- **File**: `task-detail.component.scss:128–136`, `task-detail.component.html:94–109`
- **Problem**: Each `.h-timeline-node` is laid out as a vertical column (`flex-direction:
  column`). The `.h-timeline-arrow` `div` is rendered as a sibling of the node, not inside
  it, but the node itself has `flex: 1` making every node occupy equal horizontal space.
  The arrow therefore appears inside the node's flex column rather than between nodes at
  the row level. The result is an arrow that renders below the dot and content within the
  same column, not between the two nodes horizontally as intended.
- **Recommendation**: Either move the arrow outside the `.h-timeline-node` div (make it a
  sibling at the `.h-timeline` flex row level), or restructure so the arrow is an
  `::after` pseudo-element on the node. Also add SCSS rules for `.h-timeline-arrow` (see
  Blocking Issue 4).

### Issue 5: `nzSimple nzTip` combination on `<nz-spin>` is not valid in NG-ZORRO

- **File**: `task-detail.component.html:5`
- **Problem**: `nzSimple` renders only a spinning icon with no wrapper; `nzTip` only takes
  effect when `nzSimple` is NOT set (the tip requires the wrapper element). Using both
  means the "Loading task data..." tip is silently discarded. The loading state gives no
  textual feedback to users.
- **Recommendation**: Remove `nzSimple` to allow `nzTip` to render, or remove `nzTip` if
  a plain spinner is preferred.

---

## Minor Issues

1. **`task-detail.component.scss` — `.h-timeline-track` class defined but never used in
   template (line 119–126).** The old vertical track element was removed when converting
   to horizontal layout but the rule was left behind. Dead CSS.

2. **`task-detail.component.html:251` — `nz-tag nzColor="warning"` value renders as
   `#>1` instead of `Retry #1`.** The template has `#>{{ w.retryNumber }}` — the `>`
   character appears to be a copy-paste artefact. Should be `#{{ w.retryNumber }}`.

3. **`task-detail.model.ts:5` — `timestamp` field on `StatusTransition` is `string`, not
   `Date`.** The component then calls `new Date(t.timestamp).toLocaleString()` in
   `transitionNodes` at line 201. This is defensible since ISO strings are common from
   APIs, but the model type does not document the expected format. If the API ever returns
   a non-ISO string, `new Date(...)` returns `Invalid Date` silently. A branded type
   (`type ISODateString = string & { readonly _brand: 'iso' }`) or a doc comment would
   make the contract explicit.

4. **Import group ordering** — `task-detail.component.ts` lines 1–32 list Angular core,
   then `@angular/common` and `@angular/forms` mixed with NG-ZORRO modules in one block,
   then the internal imports. The project convention requires a blank line between each
   import group (Angular core / third-party / shared libs / feature-local). Lines 9–21
   run together without a separator between the Angular platform imports and the NG-ZORRO
   third-party imports.

---

## File-by-File Analysis

### task-detail.component.ts

**Score**: 5/10
**Issues Found**: 3 blocking, 2 serious, 1 minor

**Analysis**: The signal-based state management is a genuine improvement over the old
pattern — `OnPush` is set, `inject()` is used throughout, and all public members carry
explicit access modifiers. However the `viewModelComputed` + writable `vm` signal + effect
indirection is the most significant code smell. The component is also 234 lines against the
150-line limit. The `TaskDataBundle` type and the `formatTokenCount` utility function
(lines 41–45) both belong outside the component file — the function is a pure utility that
should live in a `task-detail.utils.ts` or `format-tokens.pipe.ts`, and the type belongs
in the model file.

**Specific Concerns**:
1. Lines 96–104, 204–211: `viewModelComputed` → `effect()` → `vm.set()` indirection
   should be collapsed to a single `public readonly vm = computed(...)`.
2. Lines 34–39: `TaskDataBundle` type must move to `task-detail.model.ts`.
3. Lines 41–45: `formatTokenCount` free function inside component file — should be a
   pure utility.

### task-detail.component.html

**Score**: 5/10
**Issues Found**: 2 blocking, 3 serious, 2 minor

**Analysis**: Template correctly uses `@if`/`@for`/`@switch` block syntax throughout (no
old structural directive regressions). `OnPush`-safe `computed()` signals are used for
all derived data. The main problems are the missing SCSS for `.h-timeline-arrow` and the
entire flow-override block, the `[class]=` ternary on quality-score, and the structural
issue with the arrow placement inside a vertical flex column. The template is 506 lines —
long but external-file convention is used, which is appropriate for this scope.

**Specific Concerns**:
1. Line 105: `.h-timeline-arrow` has no SCSS definition (unstyled arrow).
2. Lines 475–503: entire flow-override block has no SCSS definitions.
3. Line 320: `[class]=` ternary should be a precomputed signal field.
4. Line 251: `#>{{ w.retryNumber }}` renders a stray `>` character.
5. Line 5: `nzSimple` + `nzTip` conflict — tip will be silently ignored.

### task-detail.component.scss

**Score**: 6/10
**Issues Found**: 1 blocking, 1 serious, 1 minor

**Analysis**: The conversion from hardcoded hex values to CSS variables is thorough and
correct across the entire file. Token names used (`--accent`, `--success`, `--error`,
`--warning`, `--running`, `--border`, `--bg-primary`, `--bg-secondary`, `--text-primary`,
`--text-secondary`, `--radius`, `--radius-lg`) are consistent with the project theme
vocabulary. The only regression is the `rgba` values in the animation keyframes.

**Specific Concerns**:
1. Lines 158–159: `rgba(23, 125, 220, ...)` in `@keyframes` hardcodes a color value —
   must use a CSS variable.
2. Lines 119–126: `.h-timeline-track` is dead CSS — never referenced in the template.
3. Missing: `.h-timeline-arrow`, `.flow-override-section`, `.flow-override-body`,
   `.flow-override-label`, `.flow-override-controls`, `.flow-override-select`,
   `.flow-override-saving`, `.flow-override-badge`.

### task-detail.model.ts

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The file is well-structured. All interfaces follow PascalCase naming. New
interfaces `TransitionNode` and `WorkerRow` correctly extend their base interfaces using
inheritance rather than duplicating fields. The model is 102 lines — within the 80-line
guideline for model files, though close. The only concern is that `status`, `workerType`,
`outcome`, `priority`, `type`, `complexity`, `launcher`, and `provider` fields are typed
as bare `string` throughout rather than string literal unions, which is a standing
rule violation per the review-lessons general file.

**Specific Concerns**:
1. `WorkerEntry.status`, `WorkerEntry.workerType`, `WorkerEntry.launcher`,
   `ReviewEntry.reviewType`, `TaskDetailViewModel.type`, `TaskDetailViewModel.priority`,
   `TaskDetailViewModel.complexity`, `TaskDetailViewModel.status` — all bare `string`
   fields that should be string literal unions or typed enums. At minimum, map them to
   existing union types if they exist elsewhere in `api.types`.

---

## Pattern Compliance

| Pattern                         | Status | Concern                                                                          |
| ------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Standalone component            | PASS   | `standalone: true` present                                                       |
| OnPush change detection         | PASS   | `ChangeDetectionStrategy.OnPush` present                                         |
| `inject()` for DI               | PASS   | No constructor injection                                                         |
| `@if`/`@for` control flow       | PASS   | No `*ngIf`/`*ngFor` present                                                      |
| `computed()` for derived state  | FAIL   | `vm` is a writable signal driven by an effect instead of a `computed()`          |
| Signal `readonly` enforcement   | FAIL   | `vm` and `loading` are public writable signals, not `asReadonly()` projections   |
| No hardcoded colors             | FAIL   | `rgba(23, 125, 220, ...)` in `@keyframes pulse-dot` (SCSS lines 158–159)         |
| Types in model files            | FAIL   | `TaskDataBundle` defined in component file                                       |
| Explicit access modifiers       | PASS   | All members carry `public`/`private`                                             |
| No `any` type                   | PASS   | No `any` found                                                                   |
| No `as` type assertions         | PASS   | No casting assertions found                                                      |
| String unions for status fields | FAIL   | All status/type/outcome fields are bare `string` in model                        |
| CSS completeness                | FAIL   | `.h-timeline-arrow` and entire flow-override block have no SCSS                  |

---

## Technical Debt Assessment

**Introduced**:
- Mutable public writable signals pattern (`vm`, `loading`) sets a precedent that other
  components may follow, making the codebase inconsistent between components that use
  `computed()` directly and those that copy into writable signals via effects.
- Missing SCSS for new UI sections means the flow-override feature ships visually broken.
- `TaskDataBundle` type stranded in the component file is the first type-in-component
  violation in this feature's model layer, establishing a bad precedent for future additions.

**Mitigated**:
- Hardcoded hex colours largely eliminated (one regression in animation keyframes).
- Template method calls replaced with `computed()` signals throughout — correct.
- `SlicePipe` usage replaced with precomputed signals — correct.

**Net Impact**: Slight increase. The colour and pipe improvements are real wins, but the
writable signal anti-pattern and missing SCSS for an entire interactive section are
regressions that need addressing before this is production-stable.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `.h-timeline-arrow` and entire flow-override interactive block have
zero CSS rules, meaning the flow-override `<select>` and status label ship visually broken.
This alone blocks merge. The writable `vm`/`loading` signal pattern and the missing
`rgba`-to-CSS-variable migration in the animation are required follow-ups.

---

## What Excellence Would Look Like

A 10/10 implementation would:
- Have `vm` declared as `public readonly vm = computed(() => ...)` with no intermediate
  writable copy.
- Have `loading` declared as `public readonly loading = computed(() => this.dataSignal() === null)`.
- Have `TaskDataBundle` in `task-detail.model.ts` alongside all other types.
- Have all status/type/outcome fields typed as string literal unions matching the unions
  already defined in `api.types`.
- Have complete SCSS coverage for every class referenced in the template, including
  `.h-timeline-arrow` and the full flow-override block.
- Replace `rgba(23, 125, 220, ...)` with `var(--running-glow)` or equivalent token.
- Consolidate the three separate worker tables into one configurable worker table to
  eliminate the `workerRows()` × 4 pattern.
- Have `formatTokenCount` extracted to a separate pipe or utility file.
- Have import groups separated by blank lines.
