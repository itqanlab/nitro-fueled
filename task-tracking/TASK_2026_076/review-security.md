# Security Review — TASK_2026_076

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** bdd89df "feat(dashboard): scaffold Angular 19 + NG-ZORRO app at apps/dashboard"
**Scope:** Angular 19 + NG-ZORRO dashboard scaffold

---

## Summary

No critical or high-severity vulnerabilities found. The scaffold is minimal and uses Angular's built-in security model (template sanitization, strict TypeScript). Three medium/low findings are documented below, all related to defense-in-depth hardening that should be addressed before this app handles real user sessions or is deployed beyond local dev.

---

## Findings

### MEDIUM — No Content Security Policy in `index.html`

**File:** `apps/dashboard/src/index.html`
**OWASP Category:** A03:2021 – Injection / XSS

No `<meta http-equiv="Content-Security-Policy">` tag is present. Angular's template engine provides strong XSS protection by default (automatic escaping, no direct DOM writes), but without a CSP the browser will execute any inline scripts or load resources from any origin if the protection is ever bypassed (e.g., via a misconfigured `DomSanitizer.bypassSecurityTrustHtml` call added later, or a vulnerable third-party library).

**Current state:**
```html
<head>
  <meta charset="utf-8">
  <title>Nitro-Fueled Dashboard</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
```

**Recommendation:** Add a restrictive CSP meta tag. A starting point for an Angular SPA:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self';">
```
Note: NG-ZORRO may require `'unsafe-inline'` for styles until nonce-based CSP is configured. The exact policy must be validated against the running app, but the absence of any CSP is the gap.

---

### LOW — Source Maps Enabled as Default Build Output

**File:** `apps/dashboard/project.json` (line 44: `"defaultConfiguration": "development"`) and `apps/dashboard/tsconfig.json` (line 12: `"sourceMap": true`)

The build target's `defaultConfiguration` is `"development"`, which includes `"sourceMap": true`. Running `nx build dashboard` without an explicit `--configuration=production` flag produces source maps in the output directory. Source maps reconstruct the original TypeScript source and expose internal logic, component names, and file paths to anyone with DevTools access. For an internal orchestration dashboard this is low risk today, but the default should be production-safe.

**Risk:** Source exposure if the built output (`apps/dashboard/dist`) is ever served without specifying the production configuration explicitly.

**Recommendation:** Change `defaultConfiguration` to `"production"` in the build target once the app is past active scaffolding, or add a CI/CD guard that always passes `--configuration=production` to build commands.

---

### LOW — Unpinned Caret Ranges on Runtime Dependencies

**File:** `package.json` (workspace root)

All runtime Angular packages and `ng-zorro-antd` use `^` (caret) semver ranges:

```json
"@angular/core": "^19.2.20",
"ng-zorro-antd": "^19.3.1",
"zone.js": "^0.15.1"
```

Caret ranges allow any minor or patch bump on the next `npm install`. If a compromised or buggy patch is published to any of these packages (supply chain attack or accidental regression), it will be silently installed. Only `rxjs` uses the safer `~` (tilde, patch-only) range.

**Risk:** Supply chain exposure. Low probability but non-trivial consequence given Angular's ecosystem footprint.

**Recommendation:** After stabilizing, pin exact versions or use `npm ci` with a committed `package-lock.json`. If `package-lock.json` is intentionally excluded (it is in `.gitignore`), consider moving to exact pinning in `package.json`.

---

### INFORMATIONAL — No Authentication Scaffold

**File:** `apps/dashboard/src/app/app.config.ts` (line 17: `provideRouter([])`)

The router is initialized with an empty routes array and no route guards or authentication providers are wired in. This is expected for a scaffold task. Flagged here so the next task that adds routes explicitly provisions authentication/authorization guards from the start rather than retrofitting them later.

**No action required for this task.**

---

### INFORMATIONAL — Bootstrap Error Logs to Console Only

**File:** `apps/dashboard/src/main.ts` (line 6)

```typescript
.catch((err: unknown) => console.error(err));
```

Bootstrap failures are swallowed to the browser console. For a local dev scaffold this is fine. When real monitoring is added (error tracking service, telemetry), this catch handler should forward to that service. The `unknown` type annotation is correct.

**No action required for this task.**

---

## Files With No Findings

| File | Verdict |
|------|---------|
| `apps/dashboard/package.json` | Clean — metadata only, no scripts, no deps |
| `apps/dashboard/tsconfig.json` | Clean — `strict: true`, `skipLibCheck` is standard practice |
| `apps/dashboard/src/app/app.component.ts` | Clean — static template, no user input binding, no `innerHTML` |
| `apps/dashboard/src/app/app.config.ts` | Clean — no hardcoded secrets, no unsafe providers |
| `apps/dashboard/src/styles.scss` | Clean — CSS custom properties only |
| `apps/dashboard/public/.gitkeep` | Clean — empty placeholder |
| `.gitignore` | Clean — `.angular/` correctly excluded |

---

## Verdict

**PASS with recommendations.** The scaffold contains no exploitable vulnerabilities in its current state. The two actionable findings (CSP and source map default) should be addressed before the dashboard is deployed or serves real orchestration data. The dependency pinning finding is a best-practice note for the stabilization phase.
