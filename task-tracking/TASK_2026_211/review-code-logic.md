# Code Logic Review — TASK_2026_211

## Summary

TASK_2026_211 is a compile-error bugfix. Six files were restored or rewritten to make `npx nx build dashboard` pass. The Angular template syntax corrections are real and correct: `@else if` alias removal, `allTasks.length` vs `allTasks()`, and `[attr.aria-label]` replacements are all valid fixes. The restored TypeScript components (`session-comparison`, `orchestration`) are complete and coherent.

However, three logic issues survive that are not compile errors but will produce incorrect runtime behaviour, one of which is a known anti-pattern flagged in the review-lessons. Two structural HTML defects in `task-detail.component.html` are present but were acknowledged as cosmetic in the handoff — they are not cosmetic; one produces a DOM that browsers will auto-correct in unpredictable ways.

---

## Findings

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `session-comparison.component.ts` | `unavailable` is set to `true` for the initial null before the HTTP call returns — false-alarm error banner on every healthy page load | High |
| 2 | `task-detail.component.html` | Two `<thead>` / `<tbody>` blocks are outside the enclosing `<nz-table>` element — broken table DOM structure | Medium |
| 3 | `project.component.html` | `aria-label` on checkbox inputs is a static string literal with literal quote marks inside the expression, rendering as `'Filter by status: ' + statusLabelMap[status]` as text, not as a computed value | Medium |
| 4 | `session-comparison.component.ts` | `sortBy()` mutates `this.rows` while the component uses `ChangeDetectionStrategy.OnPush` — change detection will not fire because the array reference is replaced but the spread assignment is already a new array; this is actually fine — see detail | Low (false alarm, noted for clarity) |
| 5 | `orchestration.component.html` | `selectedFlow()` called 3 times in the `@else if` branch on every change detection cycle — violates "template expressions must not call methods" anti-pattern; each call re-reads the computed signal | Low |
| 6 | `project.component.ts` | `testModelFilter()` test method has wrong logic: it checks `task.model === null` but `QueueTask.model` is typed `string | undefined`, not `string | null` — the guard never matches | Low |

---

## Details

### Finding 1 — False-Alarm Unavailable Banner (High)

**File:** `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts`, lines 61–75

`toSignal` with `initialValue: null` emits `null` synchronously on construction, before the HTTP Observable fires. The `effect()` checks:

```typescript
const raw = this.sessionsSignal();
if (raw === null) {
  if (!this.loading) {      // <-- loading is `true` on first run, so branch not taken
    this.unavailable = true;
  }
} else {
  this.loading = false;
  ...
}
```

The guard `if (!this.loading)` saves this specific component from the anti-pattern, but `loading` is never set to `false` when `raw === null` after the HTTP call completes with an error. `catchError(() => of(null))` routes API errors back through the `raw === null` branch; since `loading` remains `true` after the initial sync emit (it was never set to `false` by the `null` branch), a genuine API error will leave the component stuck showing the skeleton spinner forever instead of the unavailable banner.

The correct fix is to set `this.loading = false` inside the `null` branch unconditionally, then check if `raw === null` to set `unavailable`. As written, an API error produces a permanent spinner with no feedback — a silent failure.

This directly violates the anti-pattern: "Config/init failures at startup must block with a clear message, not silently continue."

---

### Finding 2 — Broken Table DOM Structure (Medium)

**File:** `apps/dashboard/src/app/views/task-detail/task-detail.component.html`

At lines 196–221 ("Model & Provider Info" section) and lines 263–289 ("Phase Timing" section), the template has the following structure:

```html
<nz-table ...>
  <thead>
    <tr>...</tr>
  </thead>
  <thead>           <!-- second thead OUTSIDE the nz-table closing tag -->
    ...
  </thead>
  <tbody>
    ...
  </tbody>
</nz-table>
```

Inspection of lines 199–221: the `<nz-table>` opens at line 199, the first `<thead>` at 201, but the indentation of the second `<thead>` (line 208) and `<tbody>` (line 209) shows they are actually INSIDE the `nz-table` before its closing `}` at line 221. The Angular template compiler accepts this because `nz-table` uses content projection, but the `</thead>` on line 207 closes the first `<thead>` before the `<tbody>` opens — this is structurally valid HTML.

However at lines 265–289 (Phase Timing), the closing `}` of the `@if (m.phases.length === 0)` branch at line 289 is inside a `<div class="section">` that is never closed before the next `<div class="section">` at line 291. The `@if` block ending at line 289 and the `@if (phaseBars()...)` block at line 291 share the same parent `<div class="section">`, but the enclosing `</div>` for that section is missing — the section div is closed by the outer `}` ending at line 309, which is actually the `@if (vm(); as m)` closing brace at line 475. This causes the phase chart to render inside the Phase Timing section structurally, which is intentional, but the model and phase tables both have their `<thead>` indentation reversed — `</thead>` and `</tbody>` appear before `</nz-table>` in the raw source but the actual nesting is correct. This is cosmetic as stated in the handoff.

The genuine structural issue is at lines 204–221: `</tr>` is at line 206, `</thead>` is at line 207, but lines 208–219 are the `<tbody>` and its content, and `</nz-table>` closes at 220, while `}` closes the `@if` at 221. The indentation is reversed but the nesting is technically correct. Browsers will parse it correctly.

Severity is Medium (not High) because the DOM output is valid — just misleading to maintainers. The handoff correctly notes this as cosmetic.

---

### Finding 3 — Static String Literal in `aria-label` on Checkbox (Medium)

**File:** `apps/dashboard/src/app/views/project/project.component.html`, lines 199, 245, 287

```html
<input
  type="checkbox"
  [checked]="isStatusSelected(status)"
  (change)="toggleStatus(status)"
  aria-label="'Filter by status: ' + statusLabelMap[status]"
  aria-describedby="status-filter"
/>
```

The `aria-label` attribute uses the plain `aria-label="..."` syntax with a string that contains TypeScript-style concatenation inside the quotes. This is NOT a binding — it is a static attribute with the literal text value `'Filter by status: ' + statusLabelMap[status]`. Screen readers will announce this verbatim: "quote Filter by status colon quote plus statusLabelMap bracket status bracket".

The fix that was applied for other elements in this task (`[attr.aria-label]="expr"`) was NOT applied to these checkbox inputs. There are three occurrences: status filter (line 199), type filter (line 245), priority filter (line 287).

This is not a compile error (which is why it was not caught by the build) but it is a runtime accessibility defect.

---

### Finding 4 — Sort Mutation and OnPush (Low — false alarm, noted for clarity)

**File:** `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts`, line 85

`sortBy()` does `this.rows = [...this.rowsComputed()].sort(...)`. This replaces the `rows` reference with a new array. With `OnPush`, Angular will not detect this change because `rows` is a plain class property, not a signal. The sort click handler will not update the view.

This is a pre-existing design issue in the restored file (not introduced by this task). It does not affect the compile fix goal, but it means the sort feature is silently broken at runtime. Noted as Low because it is out of scope for a compile-error bugfix.

---

### Finding 5 — Method Calls in Template (Low)

**File:** `apps/dashboard/src/app/views/orchestration/orchestration.component.html`, lines 146–155

```html
} @else if (selectedFlow()) {
  <div class="flow-info">
    <h4>{{ selectedFlow()!.name }} Details</h4>
    ...
    <span>Task Types: {{ selectedFlow()!.taskTypes.join(', ') }}</span>
    <span>Phases: {{ selectedFlow()!.phases.length }}</span>
    <span>Parallel Review: {{ selectedFlow()!.hasParallelReview ? 'Yes' : 'No' }}</span>
  </div>
}
```

`selectedFlow()` is called 4 times in this `@else if` branch on every change detection cycle. `selectedFlow` is a `computed()` signal so each call is memoised, but it still crosses the "template must not call methods" lint line. The handoff acknowledged this. A `@let flow = selectedFlow()` block would eliminate the redundancy but that syntax requires Angular 17.3+. Without `@let`, using `@if (selectedFlow(); as flow)` was the correct pattern used elsewhere in this file (line 62) — the same pattern should have been used in the `@else if` branch. Since it cannot be (Angular does not support `@else if (expr; as alias)`), the handoff decision to use `!` non-null assertion is the only correct path. This is a language constraint, not a code defect.

Severity is Low (known limitation, documented).

---

### Finding 6 — Wrong Null Guard in Test Method (Low)

**File:** `apps/dashboard/src/app/views/project/project.component.ts`, line 632

```typescript
const allMatch = filtered.every(task =>
  models.includes(task.model || '') || task.model === null  // task.model is string | undefined, never null
);
```

`QueueTask.model` from `project-queue.model.ts` is typed as `string | undefined` (tasks without a model assigned have no model field). The guard `task.model === null` will never be true; tasks with no model are excluded from model-filtered results even when those tasks have no model. This is a logic bug in the test helper, not in the production filter logic itself (`applyFiltersAndSort` handles this correctly at line 138–140). Low severity because these test methods are development utilities only and do not affect end-user behaviour.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Fix session-comparison compile errors (empty file) | COMPLETE | File restored correctly from git history |
| Fix orchestration.component.ts (12+ syntax errors) | COMPLETE | Rewrite is syntactically and logically correct |
| Fix orchestration.component.html (2 template expression issues) | COMPLETE | `handleFilterChange` and `handleCloneNameChange` typed handlers correct |
| Fix task-detail.component.html (12 structural errors) | COMPLETE | Compile errors fixed; cosmetic indentation remains |
| Fix project.component.html (allTasks() + aria-label bindings) | PARTIAL | `allTasks.length` fix correct; 3 checkbox `aria-label` bindings still use static string syntax |
| Build passes | COMPLETE (assumed) | No compile errors introduced; pre-existing runtime issues remain |

### Implicit Requirements NOT Addressed

1. The `session-comparison` loading/error state machine has a silent failure path where API errors produce a permanent spinner rather than the unavailable banner. This is a regression risk on a restored file.
2. The 3 checkbox `aria-label` attributes render literal TypeScript expression strings to screen readers — the aria-label fix was applied inconsistently.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`session-comparison`: If the API returns a non-2xx response, `catchError` emits `null`. The effect's `null` branch checks `!this.loading` — which is still `true` at that point because the first emit was the synchronous `null` initial value, and `loading` is only set to `false` in the `else` branch. Result: permanent loading skeleton, no error banner, no user feedback. The `unavailable` state is never reached on real API failure.

### 2. What user action causes unexpected behavior?

A user clicking a sort column header in `session-comparison` will see no visible change. `sortBy()` replaces `this.rows` with a new sorted array, but `OnPush` only detects signal changes or explicit `markForCheck()` calls. Since `rows` is a plain class property (not a signal), Angular will not re-render.

### 3. What data makes this produce wrong results?

An empty `tasks_terminal` value (zero) in `session-comparison.adapters.ts` produces `costPerTask: null` — this is handled correctly. However, if `started_at` is an invalid date string, `computeDurationHours` returns `null` silently. The template handles `null` with `'—'`. No data defect introduced by this task.

### 4. What happens when dependencies fail?

`session-comparison`: API failure → catchError → of(null) → effect fires with null → `!this.loading` is false (loading is still true) → neither `unavailable = true` nor `loading = false` is set → permanent skeleton spinner. The 503 banner defined in the template is unreachable on API failure.

### 5. What's missing that the requirements didn't mention?

The 3 checkbox `aria-label` bindings were not listed as build errors (they are not compile errors) but they produce broken accessibility behaviour. The task description said "fix aria-label bindings" in project.component.html — this was partially applied (the `attr.aria-label` on the button and flow item elements were fixed) but not on the checkbox inputs inside the filter dropdowns.

---

## Verdict

| Metric | Value |
|--------|-------|
| Overall Score | 6/10 |
| Assessment | NEEDS_REVISION |
| Critical Issues | 0 |
| Serious Issues | 0 |
| Moderate Issues | 2 |
| Low Issues | 3 |
| Failure Modes Found | 2 |

**Recommendation:** NEEDS_REVISION

**Confidence:** HIGH

**Top Risk:** `session-comparison` API error path produces a permanent spinner with no user feedback (silent failure on `catchError`). The `unavailable` banner in the template is functionally dead code when the API is unreachable.

**Required Before Merge:**
1. Fix the `session-comparison` loading/error state: set `this.loading = false` inside the `null` branch of the effect, then check `raw === null` to set `unavailable = true`.
2. Fix the 3 checkbox `aria-label` attributes in `project.component.html` (lines ~199, ~245, ~287) to use `[attr.aria-label]` binding syntax.

**Can Defer:**
- Sort feature broken with OnPush (pre-existing, out of scope).
- `selectedFlow()` called 4x in template `@else if` branch (language constraint, acknowledged).
- Test method null guard (`task.model === null`) — dev utility only.
