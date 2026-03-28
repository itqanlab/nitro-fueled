# Security Review — TASK_2026_083

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Scope:** New Task view (12 files — models, components, mock service, routes)
**Verdict:** NO BLOCKERS — 1 medium finding, 2 low findings, 3 informational

---

## Summary

This is a pure presentation-layer Angular feature with no real backend interaction, no authentication flows, no file I/O, and no secret handling. All dynamic content rendered in templates originates from module-level constants or Angular signal inputs — not from raw user-controlled strings injected into the DOM. Angular's template compiler auto-escapes all `{{ }}` interpolations and attribute bindings, so no XSS vectors are present in the current implementation.

The findings below are relevant now (route guards) or will become relevant when mock data is replaced with real API calls.

---

## Findings

### SEC-01 — MEDIUM: No route guards on any application routes

**File:** `apps/dashboard/src/app/app.routes.ts`
**Lines:** 12–28

No `canActivate` or `canMatch` guards are applied to any route, including `/new-task`, `/models`, `/onboarding`, or `/agents`. Once this dashboard is connected to a real backend with real user sessions, any unauthenticated or unauthorized user who loads the app can navigate freely to every route.

```typescript
// All routes — no guards
{ path: 'new-task', component: NewTaskComponent },
{ path: 'models', component: ModelAssignmentsComponent },
{ path: 'onboarding', component: OnboardingComponent },
```

**Risk:** When real API calls replace mock data, sensitive data (agent configurations, model assignments, onboarding state) will be exposed without authentication enforcement at the routing layer.

**Recommendation:** Add an `AuthGuard` (or equivalent functional guard) to the parent `LayoutComponent` route so all child routes are protected by a single guard. This should be implemented before any route is wired to a real API endpoint.

---

### SEC-02 — LOW: Unsafe `as` type assertions on DOM event targets

**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts`
**Lines:** 78, 82, 98

```typescript
public onTitleInput(event: Event): void {
  this.title = (event.target as HTMLInputElement).value;  // line 78
}

public onDescriptionInput(event: Event): void {
  this.description = (event.target as HTMLTextAreaElement).value;  // line 82
}

public onModelOverrideChange(role: string, event: Event): void {
  this.modelOverrides[role] = (event.target as HTMLSelectElement).value;  // line 98
}
```

Force-casting `event.target` bypasses TypeScript's null safety. If `event.target` is null (e.g., element detached before the event fires) or the event is somehow re-used on an unexpected element, accessing `.value` will throw a runtime error or silently return `undefined`, which would be stored as the string `"undefined"` in the component state.

This pattern also explicitly violates the project convention: **"No `as` type assertions — if the type system fights you, the type is wrong"** (`review-context.md` line 93).

**Risk (current):** Low — the events are bound to specific known elements in the template. Runtime error in edge case.
**Risk (future):** If these handlers are ever reused or the template changes, the unchecked casts become silent data corruption vectors.

**Recommendation:** Use proper type narrowing via `instanceof`:

```typescript
public onTitleInput(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    this.title = event.target.value;
  }
}
```

---

### SEC-03 — LOW: Hardcoded provider names in `getProviderGroups()` violates architectural constraint

**File:** `apps/dashboard/src/app/services/mock-data.service.ts`
**Lines:** 111–116

```typescript
public getProviderGroups(): readonly ProviderGroup[] {
  return [
    { provider: 'Anthropic', models: ['Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4'] },
    { provider: 'OpenAI', models: ['GPT-4o', 'Codex Mini'] },
  ];
}
```

The architectural constraint in both `task.md` and `review-context.md` is explicit: **"Dynamic providers — model selects render whatever providers the user has configured. Do not hardcode provider names — read from API."**

Hardcoding provider names and model lists here means:
1. The model dropdown in Advanced Options always shows Anthropic and OpenAI, regardless of what the user has actually configured.
2. If this mock survives as-is into a production path, users may see and select models they do not have access to, causing silent API failures downstream.
3. The `AGENT_ROLES` constant in `new-task.component.ts` also hardcodes `projectDefault` model names (`'Claude Sonnet'`, `'Claude Opus'`, `'Codex Mini'`) — same category of violation.

**Risk:** Data integrity — users may submit task configurations referencing non-existent or inaccessible models.

**Recommendation:** The `getProviderGroups()` call path should be replaced with an API call to fetch the user's configured providers before this view is wired to real task creation. The `AGENT_ROLES` `projectDefault` values should also be dynamically derived from the configured provider data, not hardcoded strings.

---

## Informational (No Action Required)

### SEC-04: `<a href="#">` bare fragment link — not a security issue

**File:** `apps/dashboard/src/app/views/new-task/new-task.component.html`, line 6
A `href="#"` does not introduce any XSS risk. It is a navigation convention issue (should use `routerLink`) noted in `review-context.md`. No security action required.

---

### SEC-05: `modelOverrides` mutable Record — key set is bounded

**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts`, line 66
`modelOverrides: Record<string, string>` is mutated directly using `role.role` as the key. The key values originate exclusively from the module-level `AGENT_ROLES` constant (5 fixed string values), not from user input. No unbounded growth, no injection risk. The mutability is an architectural/style concern already noted in `review-context.md`.

---

### SEC-06: Attachment zone has no functional file input — future risk

**File:** `apps/dashboard/src/app/views/new-task/new-task.component.html`, lines 42–45
The drop zone is a static `<div>` with no file `<input>` or drag event handlers. When file upload is implemented, the backend handling will need MIME type validation, file size limits, and content sanitization. No security action needed in current scope — the feature is not implemented.

---

## Files Reviewed

| File | Result |
|---|---|
| `models/new-task.model.ts` | Clean — readonly interfaces, string literal unions, no issues |
| `views/new-task/new-task.component.ts` | SEC-02 (unsafe type assertions) |
| `views/new-task/new-task.component.html` | SEC-04 informational only |
| `views/new-task/new-task.component.scss` | N/A — styles only |
| `views/new-task/strategy-selector/strategy-selector.component.ts` | Clean — signals API, no issues |
| `views/new-task/strategy-selector/strategy-selector.component.html` | Clean — all data from constants |
| `views/new-task/strategy-selector/strategy-selector.component.scss` | N/A — styles only |
| `views/new-task/workflow-preview/workflow-preview.component.ts` | Clean |
| `views/new-task/workflow-preview/workflow-preview.component.html` | Clean |
| `views/new-task/workflow-preview/workflow-preview.component.scss` | N/A — styles only |
| `services/mock-data.service.ts` | SEC-03 (hardcoded providers) |
| `app.routes.ts` | SEC-01 (no route guards) |
