# Security Review — TASK_2026_131

## Review Summary
WebSocket authentication guard implementation for DashboardGateway, with focus on token handling and environment variable security.

## Files Reviewed
- apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts (new, 64 lines)
- apps/dashboard-api/src/dashboard/dashboard.module.ts (modified, +2 lines)
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts (modified, +3 lines)
- apps/dashboard-api/test/dashboard/dashboard.gateway.spec.ts (new, 157 lines)

## Critical Findings - Token Handling

| ID | Severity | Category | Description | Line |
|----|----------|----------|-------------|------|
| SEC-001 | CRITICAL | Secrets Management | Tokens stored in plain text in WS_API_KEYS environment variable (comma-separated) | ws-auth.guard.ts:11-16 |
| SEC-002 | CRITICAL | DoS Risk | Application starts but rejects all connections when WS_API_KEYS is empty/misconfigured | ws-auth.guard.ts:18-39 |
| SEC-003 | HIGH | Logging | Token count and client IDs logged to console - potential information disclosure | ws-auth.guard.ts:24, 37, 52, 59 |

## High Priority Findings - Token Security

| ID | Severity | Category | Description | Line |
|----|----------|----------|-------------|------|
| SEC-004 | HIGH | Cryptographic | No token hashing - tokens compared in plain text using Set.has() | ws-auth.guard.ts:56 |
| SEC-005 | HIGH | Secrets Management | No integration with secrets management system (HashiCorp Vault, AWS Secrets Manager, etc.) | ws-auth.guard.ts:11 |
| SEC-006 | HIGH | Access Control | No token expiration, rotation, or revocation mechanism | ws-auth.guard.ts:11-16 |

## Medium Priority Findings - Environment Variables

| ID | Severity | Category | Description | Line |
|----|----------|----------|-------------|------|
| SEC-007 | MEDIUM | Input Validation | No validation of WS_API_KEYS format or token content | ws-auth.guard.ts:12-15 |
| SEC-008 | MEDIUM | Error Handling | Missing error handling for corrupted/malformed environment variable | ws-auth.guard.ts:11 |
| SEC-009 | MEDIUM | Memory Safety | Tokens stored in memory as plain text in Set<string> - vulnerable to memory dump attacks | ws-auth.guard.ts:8 |

## Low Priority Findings

| ID | Severity | Category | Description | Line |
|----|----------|----------|-------------|------|
| SEC-010 | LOW | Authentication | No support for JWT or OAuth integration - only static API keys | ws-auth.guard.ts:10-26 |
| SEC-011 | LOW | Rate Limiting | No rate limiting or brute force protection on connection attempts | ws-auth.guard.ts:28-63 |

## Detailed Findings

### SEC-001: Plain Text Token Storage in Environment Variable
**Severity:** CRITICAL  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:11-16

The guard loads API keys from `WS_API_KEYS` environment variable and stores them as plain text strings in a Set. This exposes tokens to:
- Process listing (`ps aux` shows environment variables)
- Log aggregation systems if process info is captured
- Container orchestration platforms (Kubernetes, Docker) that expose env vars
- Server compromise scenarios

```typescript
const tokens = process.env['WS_API_KEYS'];
this.validTokens = new Set(
  tokens
    ? tokens.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    : []
);
```

**Recommendation:**
- Use hashed tokens (bcrypt, scrypt, or Argon2)
- Store hashed tokens only, not plain text
- Compare incoming tokens by hashing them first with the same algorithm

### SEC-002: DoS Risk When Env Var Misconfigured
**Severity:** CRITICAL  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:18-39

When `WS_API_KEYS` is empty or not set:
- The guard logs a warning but the application continues to start
- ALL connection attempts are rejected with `this.validTokens.size === 0` check
- This creates a silent DoS condition that may go unnoticed until deployment

```typescript
if (this.validTokens.size === 0) {
  this.logger.warn(
    'No WS_API_KEYS configured — all connections will be REJECTED. ' +
      'Set WS_API_KEYS environment variable with comma-separated API keys.'
  );
}
```

**Recommendation:**
- Fail-fast: throw an error during construction if no tokens are configured
- Or implement a developer mode flag to allow connections without tokens in dev environments
- Add health check endpoint to report authentication configuration status

### SEC-003: Information Disclosure in Logs
**Severity:** HIGH  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:24, 37, 52, 59

The guard logs sensitive information:
- Number of valid API keys (line 24) - reveals security posture
- Client IDs with rejection reasons (lines 37, 52, 59) - aids reconnaissance attacks

```typescript
this.logger.log(`Initialized with ${this.validTokens.size} valid API key(s)`);
this.logger.error(`Connection rejected (no API keys configured): ${client.id}`);
this.logger.warn(`Connection rejected (no token provided): ${client.id}`);
this.logger.warn(`Connection rejected (invalid token): ${client.id}`);
```

**Recommendation:**
- Remove or redact token count logging
- Log client IDs only with IP addresses and timestamps for security monitoring
- Consider rate-limiting failed authentication logs to prevent log flooding

### SEC-004: No Token Hashing
**Severity:** HIGH  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:56

Tokens are compared in plain text using `Set.has()`. If the environment or memory is compromised, all valid tokens are immediately exposed.

```typescript
const isValid = this.validTokens.has(token);
```

**Recommendation:**
- Store token hashes instead of plain text
- Use constant-time comparison: `crypto.timingSafeEqual()`
- Generate tokens with sufficient entropy (256-bit minimum)

### SEC-005: No Secrets Management Integration
**Severity:** HIGH  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:11

Tokens are read directly from `process.env` with no integration with production-grade secrets management systems:
- No HashiCorp Vault support
- No AWS Secrets Manager / Parameter Store support
- No Azure Key Vault support
- No automatic token rotation

**Recommendation:**
- Integrate with cloud secrets management for production
- Support token rotation via environment variable reload or secrets watcher
- Document production deployment requirements

### SEC-006: No Token Expiration or Rotation
**Severity:** HIGH  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:11-16

Tokens loaded from environment variable are valid indefinitely. There's no mechanism to:
- Expire tokens after a time period
- Rotate tokens without restarting the server
- Revoke compromised tokens
- Implement token versioning

**Recommendation:**
- Add token metadata (issued_at, expires_at) to environment variable format
- Check expiration during validation
- Support hot reload of token configuration
- Document token rotation procedures

### SEC-007: No Environment Variable Validation
**Severity:** MEDIUM  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:12-15

The code accepts any comma-separated string without validation:
- No minimum token length check
- No character set validation (allows control characters, newlines, etc.)
- No maximum token length to prevent DoS via long tokens
- No duplicate token detection

```typescript
tokens.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
```

**Recommendation:**
- Validate each token meets minimum length (e.g., 32 characters)
- Reject tokens with invalid characters (control characters, whitespace)
- Limit maximum token length (e.g., 256 characters)
- Detect and warn about duplicate tokens

### SEC-008: Missing Error Handling for Environment Variable
**Severity:** MEDIUM  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:11

No error handling for:
- Malformed environment variable (non-string values)
- Circular references or object values instead of string
- Encoding issues (UTF-8, binary data)

**Recommendation:**
- Add try-catch around environment variable parsing
- Validate that `process.env['WS_API_KEYS']` is a string
- Provide clear error messages for configuration errors

### SEC-009: Plain Text Tokens in Memory
**Severity:** MEDIUM  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:8

Tokens stored in `Set<string>` remain in plain text in memory for the lifetime of the application. Memory dump attacks or heap inspection can expose all valid tokens.

```typescript
private readonly validTokens: Set<string>;
```

**Recommendation:**
- Consider using a secure string/buffer type if available
- Store only token hashes in memory
- Minimize token lifetime in memory (clear after validation, though this impacts performance)

### SEC-010: No JWT/OAuth Support
**Severity:** LOW  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:10-26

The implementation only supports static API keys, not industry-standard authentication:
- No JWT token support
- No OAuth 2.0 integration
- No OpenID Connect support
- No token introspection or revocation

**Recommendation:**
- Consider JWT support for future scalability
- Document the decision to use static API keys for this minimal implementation
- Provide migration path to full JWT/OAuth if needed

### SEC-011: No Rate Limiting
**Severity:** LOW  
**File:** apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts:28-63

No protection against:
- Brute force attacks on tokens
- Connection flooding
- Denial of service via repeated failed authentication attempts

**Recommendation:**
- Implement rate limiting at WebSocket gateway level
- Track failed attempts per IP address
- Add exponential backoff for repeated failures

## Positive Security Aspects
- Guard correctly prevents unauthorized connections when properly configured
- Proper handling of both Bearer token and plain token formats
- No sensitive token information leaked in error messages to clients
- Guard applied at method level using `@UseGuards()` decorator (appropriate NestJS pattern)
- CORS configured with specific, restricted origins
- Clean separation of concerns with dedicated WsAuthGuard class
- Comprehensive test coverage in dashboard.gateway.spec.ts

## Known Risks (from handoff.md)
Already documented and acknowledged in task documentation:
- WS_API_KEYS must be configured before server starts
- Tokens stored in plain text in environment variable (now elevated to CRITICAL)
- No user identity or permission granularity
- Token passed via auth.query or auth.auth.token may not be available for non-browser clients

## Overall Verdict

| Verdict | PASS/FAIL |
|---------|-----------|
| Security Review | FAIL |

## Rationale

The implementation has **CRITICAL** security vulnerabilities that must be addressed before production deployment:

1. **SEC-001 (CRITICAL):** Plain text token storage in environment variable exposes secrets to process inspection, container platforms, and log aggregation. This is a fundamental security weakness.

2. **SEC-002 (CRITICAL):** Silent DoS condition when environment variable is misconfigured. The application starts but rejects all connections, which could go unnoticed in production.

These findings represent actionable security flaws that should be fixed for this task. The implementation addresses the basic requirement (preventing unauthorized access) but introduces new security concerns that must be resolved.

### Required Actions Before Merge:
1. Implement token hashing (replace plain text storage)
2. Add validation and fail-fast behavior for missing/misconfigured WS_API_KEYS
3. Remove or sanitize sensitive logging (token count, client IDs)
4. Add comprehensive error handling for environment variable parsing

### Recommended for Follow-up:
- Integration with secrets management for production
- Token expiration and rotation mechanism
- Rate limiting and brute force protection

The implementation demonstrates correct NestJS patterns and good test coverage, but the security concerns require remediation.
