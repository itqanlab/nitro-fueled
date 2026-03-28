# Security Review — TASK_2026_078

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** b382677
**Verdict:** PASS with advisory notes

---

## Summary

All files in scope are frontend display-only Angular components backed exclusively by `MockDataService` (static in-memory data). No secrets, no external HTTP calls, no eval/dynamic code execution, no user-supplied input reaching the DOM unsanitized. No high or critical severity findings.

---

## Findings

### SEC-01 — CSS Class Injection via Unvalidated Data Values (Low / Advisory)

**Files:**
- `dashboard.component.html:14` — `[class]="team.toLowerCase()"`
- `task-card.component.ts:26` — `[ngClass]="task.status"`
- `task-card.component.ts:36` — `[ngClass]="task.priority"`
- `task-card.component.ts:43` — `[ngClass]="task.type.toLowerCase()"`
- `task-card.component.ts:13` — `[ngClass]="step.status"`
- `stat-card.component.ts:12` — `[ngClass]="valueClass"`

**Description:**
Data-derived strings are injected directly into CSS class names without allowlist validation. Angular's `[ngClass]` and `[class]` bindings do not sanitize class values — any string is applied as-is. If any of these fields are later sourced from user-supplied or API-provided data rather than the current static mock, an attacker could inject arbitrary CSS class names. In the most benign case this causes visual inconsistency; in a malicious case with custom CSS loaded by a compromised stylesheet, it could be used to trigger unintended styles.

**Current risk:** LOW — data comes entirely from `MockDataService` which is static and hardcoded. No attack surface today.

**Future risk:** MEDIUM — when `MockDataService` is replaced by real API calls, these bindings must be validated against known string literal unions before being applied as classes.

**Recommendation (non-blocking):** When real data is wired up, enforce that `task.status`, `task.priority`, `task.type`, and `step.status` are validated against their declared union types before they reach these bindings. Consider a pipe or utility that maps domain values to CSS class names rather than using domain values directly as class names.

---

### SEC-02 — Division by Zero in Budget Percentage (Informational)

**File:** `dashboard.component.ts:36`

```ts
public readonly budgetPercent =
  (this.analytics.budgetUsed / this.analytics.budgetTotal) * 100;
```

**Description:**
If `analytics.budgetTotal` is `0`, this evaluates to `Infinity` or `NaN`, which is then used in `[style.width.%]="budgetPercent"` in the template. Angular will silently set the width to an invalid value. Not a security vulnerability in the classical sense, but could produce NaN-driven rendering anomalies that mask financial data incorrectly.

**Current risk:** Informational — mock data has a non-zero total.

**Recommendation (non-blocking):** Guard with `Math.min(100, budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0)`.

---

### SEC-03 — Buttons Without Event Handlers (Informational)

**Files:**
- `dashboard.component.html:19-25` — Settings and New Task buttons
- `dashboard.component.html:70` — View All History button
- `dashboard.component.html:115` — Manage button
- `task-card.component.ts:71-74` — Pause/Resume and View buttons

**Description:**
Multiple buttons have no `(click)` handler. They are inert elements that do nothing on activation. This is not a security issue but is noted: inert buttons are safe (no handler = no action), and there is no risk of accidental state mutation.

**Current risk:** None — confirmed harmless given mock-only context.

---

## Confirmed Safe

| Concern | Assessment |
|---|---|
| XSS via template interpolation (`{{ }}`) | Safe — Angular auto-escapes all interpolated values |
| XSS via property bindings (`[property]`) | Safe — no `innerHTML`, no `bypassSecurityTrust*` usage found |
| `DomSanitizer` bypass | Not present in any file in scope |
| Secret/credential exposure | None — no API keys, tokens, or credentials in any file |
| SQL injection | Not applicable — frontend only, no DB access |
| Command injection | Not applicable — no `eval()`, `Function()`, or shell execution |
| Open redirect | Not present — all routes are static string literals |
| CSRF | Not applicable — no form submissions to external endpoints |
| Prototype pollution | Not present — `Map` usage in `buildTeamGroups()` is safe; no `Object.assign` from untrusted input |
| Dependency injection abuse | `inject(MockDataService)` is framework-standard; no token spoofing risk |
| Route path manipulation | Routes are static; no wildcard with dynamic redirects |

---

## Out-of-Scope Observations

None identified.

---

## Verdict

**PASS.** No blocking security issues. Two advisory items (SEC-01, SEC-02) should be addressed before connecting real API data to these components.
