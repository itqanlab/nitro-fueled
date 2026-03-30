# Code Style Review — TASK_2026_086

**Reviewer:** nitro-code-style-reviewer
**Task:** Scaffold NestJS app (apps/dashboard-api)
**Commit:** `78ce821 feat(dashboard-api): scaffold NestJS 11 app at apps/dashboard-api`
**Date:** 2026-03-28

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Serious  | 2 |
| Minor    | 4 |

No blocking style issues. Two serious violations of project conventions (explicit access modifiers). Four minor issues relating to TypeScript strictness, logging, and configuration.

---

## Serious Issues

### S-01 — Missing explicit access modifier on `getHealth()`
**File:** `apps/dashboard-api/src/app/health.controller.ts:6`
**Convention:** "Explicit access modifiers on ALL class members — `public`, `private`, `protected`. Never bare."

```ts
// Current
getHealth(): { status: string; service: string } {

// Expected
public getHealth(): { status: string; service: string } {
```

All class methods must have an explicit access modifier. `getHealth` is bare.

---

### S-02 — Missing explicit access modifier on `getDashboard()`
**File:** `apps/dashboard-api/src/dashboard/dashboard.controller.ts:6`
**Convention:** Same as S-01.

```ts
// Current
getDashboard(): void {

// Expected
public getDashboard(): void {
```

---

## Minor Issues

### M-01 — Multiple TypeScript strict checks disabled in `tsconfig.json`
**File:** `apps/dashboard-api/tsconfig.json:15-19`

The following compiler flags are all explicitly set to `false`:
- `strictNullChecks: false` (line 15)
- `noImplicitAny: false` (line 16)
- `strictBindCallApply: false` (line 17)
- `forceConsistentCasingInFileNames: false` (line 18)
- `noFallthroughCasesInSwitch: false` (line 19)

Disabling `noImplicitAny` directly conflicts with the project convention "No `any` type ever" — with this setting off, implicit `any` is silently permitted by the compiler. The convention is not enforced at the tooling level. Consider enabling at minimum `strictNullChecks` and `noImplicitAny` to align with project standards.

---

### M-02 — `console.log` / `console.error` used instead of NestJS `Logger`
**File:** `apps/dashboard-api/src/main.ts:18,23`

```ts
console.log(`[dashboard-api] Server running at ${url}`);
console.error(`[dashboard-api] Failed to start: ${message}`);
```

NestJS convention is to use `new Logger('bootstrap')` from `@nestjs/common` for consistent log formatting and level control. Plain `console.*` calls bypass the NestJS logging pipeline. For bootstrap code outside the DI container this is a common pattern, but given the project already prefixes messages (`[dashboard-api]`), adopting `Logger` would be consistent with how NestJS itself structures startup logs.

Note: the error handling itself is correct — error is not swallowed and process exits with code 1.

---

### M-03 — Missing `tsconfig-paths` devDependency
**File:** `apps/dashboard-api/package.json:8`

The `start:dev` script uses `ts-node -r tsconfig-paths/register`:
```json
"start:dev": "ts-node -r tsconfig-paths/register src/main.ts"
```

`tsconfig-paths` is not listed in `devDependencies`. Neither is `ts-node`. Both are required for this script to run. The script will fail in a clean install unless these are added.

---

### M-04 — `serve` target runs `npm install` on every invocation
**File:** `apps/dashboard-api/project.json:17`

```json
"command": "npm install && npm run build && node dist/main.js"
```

Running `npm install` as part of every `nx serve` invocation is slow and unnecessary in normal development workflows where dependencies are stable. The `npm install` step is appropriate for CI or first-time setup, not repeated local development serves. Splitting into a separate `install` target or moving to a `start:dev` target that uses `ts-node` directly would be more appropriate for DX.

---

## Files with No Issues

| File | Status |
|------|--------|
| `apps/dashboard-api/src/app/app.module.ts` | Clean — correct decorator usage, imports all used |
| `apps/dashboard-api/src/dashboard/dashboard.module.ts` | Clean — correct decorator usage, all symbols declared and imported |
| `apps/dashboard-api/src/dashboard/dashboard.service.ts` | Clean — acceptable empty placeholder |
| `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` | Clean — acceptable empty placeholder |
| `apps/dashboard-api/package-lock.json` | Not reviewed — auto-generated file |

---

## Out-of-Scope Observations (document only, do not fix)

- `main.ts:14`: Fallback port is `0` (OS-assigned random port) when `PORT` env var is unset. The acceptance criterion requires matching the `dashboard-service` port. This is a logic/correctness concern, not a style issue — flagged for the logic reviewer.
