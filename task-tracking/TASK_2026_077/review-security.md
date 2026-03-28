# Security Review — TASK_2026_077

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** `d3107bf feat(dashboard): add application shell with layout, sidebar, routing, and mock data service`
**Verdict:** PASS — no blocking issues. 2 minor findings documented below.

---

## Summary

This diff introduces an Angular 19 application shell: layout components, routing, a mock data service, and CSS-only styles. There are no HTTP calls, no user input processing, no authentication flows, and no external data sources. The attack surface is narrow. Angular's built-in template security (auto-escaping, style binding sanitization) is used correctly throughout.

---

## Findings

### MINOR-1 — `SidebarItem.route` is an unvalidated `string` type

**File:** `apps/dashboard/src/app/models/sidebar.model.ts:14`
**Also:** `apps/dashboard/src/app/layout/sidebar/sidebar.component.html:11`

```typescript
// sidebar.model.ts
readonly route?: string;   // accepts any string
```

```html
<!-- sidebar.component.html -->
<a [routerLink]="item.route" ...>
```

**Risk:** Open redirect. Angular's `[routerLink]` with a `string` value navigates within the SPA by default, but if an absolute URL (e.g. `https://evil.example.com`) is passed, the browser will follow it as a full navigation. Currently all route values come from `mock-data.constants.ts` (static, trusted), so there is no immediate exploit path. However, if `SidebarSection`/`SidebarItem` data is ever loaded from a backend API, attacker-controlled `route` values could redirect users to external sites.

**Recommendation (non-blocking):** Restrict the `route` field to a union of known route strings, or validate at the service boundary before binding.

---

### MINOR-2 — Inline component styles incompatible with strict CSP

**Files:**
- `apps/dashboard/src/app/layout/layout.component.ts` (styles array, lines 23–41)
- `apps/dashboard/src/app/layout/header/header.component.ts` (styles array, lines 27–80)
- `apps/dashboard/src/app/views/placeholder-view.component.ts` (styles array, lines 16–32)

Angular compiles component styles into `<style>` tags injected into the document. A `Content-Security-Policy` header with `style-src 'self'` (without `'unsafe-inline'`) would block these inline styles in production.

**Risk:** If CSP is deployed (recommended for a dashboard app), these components will render unstyled, breaking the layout.

**Recommendation (non-blocking):** Move inline styles to external `.scss` files (matching the pattern used by `sidebar.component.ts` and `status-bar.component.ts` which already use `styleUrl`). This is a pre-requisite for any future CSP rollout.

---

## Areas Verified Clean

| Area | Verdict |
|------|---------|
| XSS — template interpolation (`{{ }}`) | Safe — Angular auto-escapes all text bindings |
| XSS — `[innerHTML]` / `bypassSecurityTrust*` usage | None present |
| XSS — `eval()`, `Function()`, `document.write()` | None present |
| Style injection — `[style.width.%]="progressPercent"` | Safe — Angular coerces to number before style application |
| CSS class injection — `[ngClass]="indicator.status"` | Safe — value is a typed union (`'ok' \| 'busy' \| 'off'`), no user input |
| Secrets / credentials in source | None — only display mock data (costs, labels, counts) |
| Sensitive data in route `data: {}` config | None — only page titles |
| Route wildcard to external URL | None — all routes are relative internal paths |
| CSRF | Not applicable — no HTTP calls in this diff |
| Supply chain — third-party imports | `@ant-design/icons-angular`, `ng-zorro-antd`, Angular — all standard trusted libraries |
| `data['title'] as string` type assertion | Safe in current scope — route data is static strings set in `app.routes.ts`; no runtime injection vector |

---

## Out-of-Scope Observations

None — no security concerns observed in adjacent files outside the review scope.
