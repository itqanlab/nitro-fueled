# Security Review — TASK_2026_082

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** `3d27d36` — feat(dashboard): implement Model Assignments view at /models route
**Verdict:** PASS with minor findings (all low severity)

---

## Executive Summary

This implementation is a **pure mock/presentation layer** with no HTTP calls, no user input processing, and no external data ingestion. All data originates from compile-time constants. Angular's template engine provides automatic XSS protection for all text interpolations. No critical or high-severity vulnerabilities were found.

Four low-severity findings are documented below — all are latent risks that activate only when real API data replaces the current mock constants.

---

## Findings

### SEC-082-01 — CSS Class Injection via Data-Driven `[ngClass]` Bindings (LOW)

**Files:**
- `assignments-table.component.html:19` — `[ngClass]="agent.iconClass"`
- `assignments-table.component.html:27` — `[ngClass]="getProviderBadgeClass(agent.providerType)"`
- `assignments-table.component.html:141` — `[ngClass]="getProviderBadgeClass(sub.providerType)"`
- `assignments-table.component.html:133` — `[ngClass]="getSubAgentIconClass(sub.iconColor)"`
- `model-assignments.component.html:17` — `[ngClass]="level.cssClass"`
- `preset-cards.component.html:8` — `[ngClass]="preset.badgeType"`

**Description:**
Multiple `[ngClass]` bindings receive values directly from data model fields (`iconClass`, `cssClass`, `iconColor`, `badgeType`). Currently all values come from hardcoded constants, so this is safe. When this transitions to real API data, these bindings become **server-controlled CSS class injection points**.

While Angular's security model prevents CSS class names from executing JavaScript directly, server-controlled class names can:
- Apply arbitrary pre-existing CSS rules (e.g., `d-none`, `admin-only`, `hidden`) to manipulate UI visibility
- Cause unintended visual state if the CSS ruleset grows
- Enable UI redressing if class names from other UI frameworks are injected

`getSubAgentIconClass` in `assignments-table.component.ts:54` is particularly direct — it concatenates the raw `iconColor` string: `return \`sub-icon-${color}\`` — no allowlist check.

**Severity:** LOW (currently inert; latent risk on API transition)
**Recommendation:** Before connecting to a real API, add allowlist validation for all fields used in `[ngClass]` bindings. For `iconClass`, `iconColor`, `cssClass`, and `badgeType`, accept only values within the defined string literal unions from the model.

---

### SEC-082-02 — Loose String Typing in Badge/Icon Class Methods (LOW)

**File:** `assignments-table.component.ts:48,54`

```typescript
public getProviderBadgeClass(type: string): string { ... }
public getSubAgentIconClass(color: string): string { ... }
```

**Description:**
Both methods accept `string` rather than the typed unions defined in the model (`ProviderType` and the implicit `iconColor` values). This bypasses TypeScript's type checking at the call sites. If API data contains unexpected values:
- `getProviderBadgeClass` silently falls through to `badge-api` for any unknown value — not dangerous but incorrect
- `getSubAgentIconClass` passes the raw value straight into a template literal CSS class — no validation at all

**Severity:** LOW
**Recommendation:** Change parameter types to the appropriate union types: `getProviderBadgeClass(type: ProviderType)`. For `iconColor`, define a union type (e.g., `SubAgentIconColor = 'accent' | 'success' | 'purple'`) and enforce it.

---

### SEC-082-03 — No Route Authorization Guard on `/models` (LOW)

**File:** `app.routes.ts:23`

```typescript
{ path: 'models', component: ModelAssignmentsComponent },
```

**Description:**
The `/models` route has no `canActivate` guard. Model assignment configuration (which models/providers are used per agent role) is a security-sensitive area — unauthorized users could view (and eventually modify) the AI model routing configuration. No other routes in `app.routes.ts` have guards either, so this is a systemic gap, not specific to this task.

**Severity:** LOW (systemic issue; not introduced by this task)
**Note:** This is documented here per review scope conventions. The fix belongs at the router or layout level, outside this task's file scope.

---

### SEC-082-04 — Unvalidated String Length for `overrideNote` Display (LOW / INFO)

**File:** `assignments-table.component.html:52-54`

```html
@if (agent.overrideNote) {
  <span> — {{ agent.overrideNote }}</span>
}
```

**Description:**
`overrideNote` is rendered inline within a table cell with no length constraint. Currently hardcoded values are short (e.g., `"best reasoning needed"`). When real API data is used, a long or maliciously crafted string from a server could cause layout breakage or table overflow. Angular's `{{ }}` interpolation escapes HTML, so no XSS risk, but a very long string could degrade UI integrity.

**Severity:** LOW / INFO (no code execution risk; UX/layout concern)
**Recommendation:** Cap display length with a CSS `max-width` + `overflow: hidden` / `text-overflow: ellipsis` on the override badge, or truncate in the component before binding.

---

## Confirmed Safe Patterns

| Pattern | Finding |
|---|---|
| Template interpolation `{{ }}` | Angular auto-escaping active throughout — no raw HTML injection risk |
| No `[innerHTML]` bindings | Confirmed absent across all 6 HTML files |
| No `DomSanitizer.bypassSecurityTrust*` | Confirmed absent |
| No `eval`, `Function()`, or dynamic script | Confirmed absent |
| No `HttpClient` calls in scope | No network requests — no SSRF, insecure TLS, or request forgery surface |
| No secret/credential handling | No API keys, tokens, or sensitive values in constants |
| `<select>` / `<optgroup>` values | `[value]` bindings are property bindings — no HTML injection |
| Event emitters (`resetRole`, `save`, `presetSelected`) | Emit typed values from data; handlers are stubs — no side effects |
| `budgetPercent` used in `[style.width.%]` | Numeric binding — no CSS injection risk |

---

## Summary Table

| ID | Severity | File | Description | Status |
|---|---|---|---|---|
| SEC-082-01 | LOW | Multiple HTML | Server-controlled CSS class names via `[ngClass]` on data fields | Document only |
| SEC-082-02 | LOW | assignments-table.component.ts | `string` param instead of typed union in badge/icon methods | Document only |
| SEC-082-03 | LOW | app.routes.ts | No `canActivate` guard on `/models` route (systemic gap) | Document only |
| SEC-082-04 | LOW/INFO | assignments-table.component.html | No length constraint on `overrideNote` display | Document only |

No blockers. No critical or high findings. Implementation is safe for its current mock-data scope.
