# Code Logic Review — TASK_2026_083

**Reviewer:** nitro-code-logic-reviewer
**Task:** New Task view
**Date:** 2026-03-28
**Verdict:** FAIL

---

## Summary

The implementation renders the UI correctly but contains multiple incomplete/stub implementations that prevent the feature from functioning as specified. Critical form actions are non-functional, the auto-detect logic is faked, and provider data is hardcoded in violation of architectural constraints.

---

## Critical Issues

### L01: Form action buttons are non-functional stubs
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.html:136-140`
**Severity:** CRITICAL

The Cancel, Save as Draft, and Start Task buttons have no click handlers:
```html
<button type="button" class="btn btn-ghost">Cancel</button>
<button type="button" class="btn btn-secondary">Save as Draft</button>
<button type="button" class="btn btn-primary btn-lg">&#x25B6; Start Task</button>
```

The form collects user input but has no way to submit it. Users cannot create tasks with this view.

**Expected:** Each button should have a `(click)` handler that invokes component methods for navigation (Cancel), saving draft state, or triggering task creation via API.

---

### L02: Attachment zone is a non-functional stub
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.html:42-44`
**Severity:** CRITICAL

The attachment zone is a static `<div>` with no interactivity:
```html
<div class="attachment-zone">
  &#x1F4CE; Drop files here or click to browse &mdash; screenshots, specs, diagrams
</div>
```

There is no hidden `<input type="file">`, no `(click)` handler, no `(drop)`/`(dragover)` handlers. The acceptance criteria states "Attachment drop zone renders with dashed border and drag-and-drop visual state" but the functional implementation is missing.

**Expected:** Hidden file input, click-to-browse functionality, drag-and-drop handlers, and file list state management.

---

### L03: Provider groups hardcoded (violates architectural constraint)
**File:** `apps/dashboard/src/app/services/mock-data.service.ts:111-116`
**Severity:** CRITICAL

```typescript
public getProviderGroups(): readonly ProviderGroup[] {
  return [
    { provider: 'Anthropic', models: ['Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4'] },
    { provider: 'OpenAI', models: ['GPT-4o', 'Codex Mini'] },
  ];
}
```

Task description explicitly states: **"Dynamic providers — model selects render whatever providers the user has configured. Do not hardcode provider names — read from API."**

This hardcoding violates the stated architectural constraint. Even as mock data, the pattern should demonstrate the intent to fetch from an API or project configuration.

---

## Major Issues

### L04: `autoDetectLabel` does not analyze keywords
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts:68-71`
**Severity:** MAJOR

```typescript
public get autoDetectLabel(): string | null {
  if (!this.description.trim()) return null;
  return 'FEATURE — based on keywords';
}
```

The getter always returns "FEATURE" regardless of description content. Per the task description, the auto-detect should analyze keywords to determine the appropriate strategy type (bugfix, refactor, docs, etc.).

**Expected:** Keyword analysis logic that examines the description text and returns the most likely strategy type based on detected keywords (e.g., "fix", "broken", "error" -> "BUGFIX"; "document", "readme", "guide" -> "DOCS").

---

### L05: `costEstimate` returns hardcoded value
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts:73-75`
**Severity:** MAJOR

```typescript
public get costEstimate(): string {
  return '$2.50 – $5.00';
}
```

The cost estimate should vary based on:
- Selected strategy type (different workflows have different complexity)
- Selected model overrides (different models have different costs)

Currently it shows the same estimate regardless of user selections, which is misleading.

---

## Minor Issues

### L06: Breadcrumb uses `href="#"` instead of routerLink
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.html:6`
**Severity:** MINOR

```html
<a href="#">e-commerce-api</a>
```

Using `href="#"` will cause a page navigation/scroll instead of client-side routing. Should use `[routerLink]` for SPA navigation.

---

### L07: Default option missing value attribute
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.html:110`
**Severity:** MINOR

```html
<option>{{ getDefaultLabel(role) }}</option>
```

The default option has no `[value]` attribute, so its value will be the text content (e.g., "Use default (Claude Sonnet)"). This makes it difficult to distinguish "user explicitly chose default" from "user selected a specific model" in `modelOverrides`.

**Expected:** Add `value=""` to the default option and handle empty string specially in `onModelOverrideChange`.

---

### L08: Model override state management incomplete
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts:66,97-99`
**Severity:** MINOR

```typescript
public modelOverrides: Record<string, string> = {};

public onModelOverrideChange(role: string, event: Event): void {
  this.modelOverrides[role] = (event.target as HTMLSelectElement).value;
}
```

When a user:
1. Selects a model override
2. Then switches back to "Use default"

The `modelOverrides` record stores the default label text string, not a sentinel value. There's no way to reset to "no override" state. Should use `null` or `undefined` for "use project default" vs a specific model string.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| models/new-task.model.ts | 37 | PASS |
| views/new-task/new-task.component.ts | 104 | FAIL |
| views/new-task/new-task.component.html | 143 | FAIL |
| views/new-task/new-task.component.scss | 385 | PASS (style-only) |
| views/new-task/strategy-selector/strategy-selector.component.ts | 20 | PASS |
| views/new-task/strategy-selector/strategy-selector.component.html | 20 | PASS |
| views/new-task/strategy-selector/strategy-selector.component.scss | 63 | PASS (style-only) |
| views/new-task/workflow-preview/workflow-preview.component.ts | 14 | PASS |
| views/new-task/workflow-preview/workflow-preview.component.html | 14 | PASS |
| views/new-task/workflow-preview/workflow-preview.component.scss | 43 | PASS (style-only) |
| services/mock-data.service.ts | 117 | FAIL |
| app.routes.ts | 29 | PASS |

---

## Issue Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| MAJOR | 2 |
| MINOR | 3 |
| **Total** | **8** |

---

## Verdict

**FAIL** — Critical issues prevent the feature from functioning. The form cannot submit, attachments cannot be uploaded, and the provider data violates architectural constraints.

The CRITICAL issues must be addressed before this task can be marked COMPLETE.
