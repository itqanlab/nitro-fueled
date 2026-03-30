# Security Review — TASK_2026_086

**Reviewer:** nitro-code-security-reviewer
**Task:** Scaffold NestJS app (apps/dashboard-api)
**Commit:** `78ce821 feat(dashboard-api): scaffold NestJS 11 app at apps/dashboard-api`
**Date:** 2026-03-28

---

## Summary

| Severity  | Count |
|-----------|-------|
| Blocking  | 0     |
| Serious   | 4     |
| Minor     | 5     |
| Info      | 2     |

No blocking issues. This is a scaffold with placeholder endpoints; the serious findings should be addressed before any business logic is added to prevent them from becoming load-bearing security gaps.

---

## Serious Findings

### S1 — WebSocket Gateway has no CORS configuration
**File:** `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:3`
**OWASP:** A05:2021 Security Misconfiguration

```ts
@WebSocketGateway()
export class DashboardGateway {}
```

`@WebSocketGateway()` uses Socket.IO under the hood. NestJS passes CORS options to the Socket.IO server separately from the HTTP CORS config set in `main.ts`. With no options provided, the Socket.IO server defaults to allowing **all origins** (`cors: true` or no restriction depending on the adapter version). The HTTP CORS guard in `main.ts` does not protect WebSocket upgrade requests.

**Risk:** Any origin — not just localhost — can open a WebSocket connection to this gateway once deployed. If future handlers process sensitive data, there is no origin restriction protecting them.

**Recommendation:** Add explicit CORS options to the decorator:
```ts
@WebSocketGateway({ cors: { origin: /^https?:\/\/localhost(:\d+)?$/, credentials: true } })
```

---

### S2 — `credentials: true` with regex origin admits all local processes
**File:** `apps/dashboard-api/src/main.ts:8-12`
**OWASP:** A05:2021 Security Misconfiguration

```ts
app.enableCors({
  origin: /^https?:\/\/localhost(:\d+)?$/,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});
```

`credentials: true` instructs browsers to include cookies and `Authorization` headers on cross-origin requests. The origin regex matches any port on localhost, meaning any locally running process — including a compromised dependency or a malicious local app — can make fully credentialed requests to this API.

For a development scaffold this is acceptable, but the pattern will be copied forward. Before credentials-bearing auth is added (sessions, JWT cookies), the CORS origin must be tightened to known ports, or credentials should be disabled until explicitly needed.

**Risk:** Medium now; High once authentication is added without revisiting this config.

**Recommendation:** Set `credentials: false` (or omit it) until the auth strategy is defined. If cookie-based auth is adopted, restrict `origin` to specific known ports rather than the full regex.

---

### S3 — `PORT` environment variable not validated before use
**File:** `apps/dashboard-api/src/main.ts:14`
**OWASP:** A03:2021 Injection (environment variable injection)

```ts
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 0;
```

`parseInt` on an out-of-range or non-numeric value returns `NaN` (for non-numeric) or a valid integer that is outside the valid TCP port range (1–65535). Examples:
- `PORT=abc` → `parseInt` returns `NaN`, NestJS/Node will throw at `app.listen(NaN)`
- `PORT=99999` → `parseInt` returns `99999`, `app.listen` will fail silently or throw

No validation or clamping occurs between parsing and passing to `app.listen`. The fallback value of `0` (OS-assigned random port) is also problematic: the service may start on an unpredictable port.

**Risk:** Misconfigured environment could cause the server to start on port 0 (random) or crash with an unhelpful error.

**Recommendation:** Validate the parsed value is in range `[1, 65535]` and use a sensible fixed default (e.g., `3000`) instead of `0`.

---

### S4 — Missing devDependencies for `start:dev` script
**File:** `apps/dashboard-api/package.json:8`
**OWASP:** A06:2021 Vulnerable and Outdated Components

```json
"start:dev": "ts-node -r tsconfig-paths/register src/main.ts"
```

`ts-node` and `tsconfig-paths` are invoked in the `start:dev` script but neither is listed in `devDependencies`. This means:
1. `npm install` in this package directory will not install them.
2. If they happen to exist in the workspace root `node_modules`, they will be used silently — but at whatever version the root resolves, not a pinned version.
3. A clean install in a CI or containerized environment will fail at runtime, not at install time.

**Risk:** Silent dependency on unpinned ambient packages; supply chain integrity reduced.

**Recommendation:** Add `ts-node` and `tsconfig-paths` to `devDependencies` with pinned ranges.

---

## Minor Findings

### M1 — Health endpoint leaks internal service name without authentication
**File:** `apps/dashboard-api/src/app/health.controller.ts:6-8`
**OWASP:** A01:2021 Broken Access Control (information disclosure)

```ts
return { status: 'ok', service: 'nitro-fueled-dashboard-api' };
```

`GET /health` is unauthenticated and returns the internal service name in the response body. In a public-facing or semi-public deployment this is information disclosure. An attacker can fingerprint the service and target known vulnerabilities in `nitro-fueled-dashboard-api`.

**Recommendation:** Either remove the `service` field, or protect the endpoint with an IP allowlist / internal-only routing rule before deploying beyond localhost.

---

### M2 — `serve` target runs `npm install` on every invocation — supply chain risk
**File:** `apps/dashboard-api/project.json:17`
**OWASP:** A06:2021 Vulnerable and Outdated Components

```json
"command": "npm install && npm run build && node dist/main.js"
```

Running `npm install` unconditionally on every `nx serve` means that each serve may fetch updated package versions from the registry. Any new minor/patch release published between serves (including a compromised package) will be installed silently. There is no integrity check beyond `package-lock.json`, which is regenerated by `npm install` if out of sync.

**Recommendation:** Remove `npm install` from the `serve` command. Installs should be an explicit, audited step in CI. For local dev, rely on the developer's own `npm install` run.

---

### M3 — `strictNullChecks: false` and `noImplicitAny: false` weaken safety guarantees
**File:** `apps/dashboard-api/tsconfig.json:15-16`
**OWASP:** A03:2021 Injection (type confusion)

```json
"strictNullChecks": false,
"noImplicitAny": false,
```

These flags suppress type errors that can mask null-dereference bugs and implicit `any` usage. Once business logic is added, missing null checks and implicit `any` casts become a source of runtime errors that could be exploited (e.g., passing user-controlled data into functions expecting typed objects). The project conventions explicitly prohibit `any` — these flags undermine that rule at the compiler level.

**Recommendation:** Enable `strict: true` (which includes `strictNullChecks` and `noImplicitAny`) before any business logic is added.

---

### M4 — No security headers configured (missing Helmet)
**File:** `apps/dashboard-api/src/main.ts`
**OWASP:** A05:2021 Security Misconfiguration

The application does not install `helmet` middleware, which sets protective HTTP response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.). Without these headers, browsers apply less restrictive defaults.

This is a scaffold so there is no content yet to protect, but the pattern must be established before the first real endpoint ships.

**Recommendation:** Add `helmet` to dependencies and call `app.use(helmet())` in `main.ts` before `app.listen`.

---

### M5 — Broad semver ranges for all production dependencies
**File:** `apps/dashboard-api/package.json:10-17`
**OWASP:** A06:2021 Vulnerable and Outdated Components

All production dependencies use `^` ranges (e.g., `"@nestjs/common": "^11.0.0"`). This means any compatible minor/patch version — including one with a newly disclosed vulnerability — will be installed without a code change. `package-lock.json` mitigates this locally but does not prevent silent version drift in environments where the lock file is not respected or regenerated.

**Recommendation:** Pin exact versions (`"11.0.x"`) or use `~` (patch-only) ranges for production dependencies in security-sensitive applications. At minimum, run `npm audit` in CI and block on high-severity findings.

---

## Informational

### I1 — HTTP (non-TLS) origins accepted in CORS regex
**File:** `apps/dashboard-api/src/main.ts:9`

The regex `^https?:\/\/localhost(:\d+)?$` includes the `s?` group, allowing `http://localhost` in addition to `https://localhost`. For local development this is expected. Note this for production hardening — the regex should be updated to HTTPS-only before any non-localhost deployment.

---

### I2 — `@WebSocketGateway()` creates an open WebSocket endpoint with no auth guard
**File:** `apps/dashboard-api/src/dashboard/dashboard.gateway.ts`

The gateway is registered as a provider and will be active on server start, even though it has no handlers. Socket.IO will accept connection events from any matching origin (see S1). There is no authentication guard on the gateway. This is acceptable for a placeholder, but a guard (e.g., `WsJwtAuthGuard`) must be applied before any message handlers are added.

---

## Scope Boundary

All findings are within the declared file scope. No out-of-scope files were reviewed.
