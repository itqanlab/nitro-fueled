# Security Review — TASK_2026_202

## Overview
Review of graceful session drain implementation (`PATCH /api/sessions/:id/stop`) and related frontend components.

## Findings

| Finding | Severity | Verdict |
|---------|----------|---------|
| Missing session ownership authorization | MEDIUM | PASS |
| Potential XSS in session log display | LOW | PASS |
| Race condition in drain flow | LOW | PASS |
| SQL injection protection | N/A | PASS |
| Input validation | N/A | PASS |
| Database operations security | N/A | PASS |
| Authentication coverage | N/A | PASS |

## Detailed Analysis

### 1. Missing Session Ownership Authorization (MEDIUM - PASS)

**Location:** `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:195-202`

The new drain endpoint, like other session management endpoints (`pause`, `resume`, `stop`), does not verify that the authenticated user has permission to operate on the specific session. Any user with valid API keys can drain any session.

```typescript
@Patch(':id/stop')
public drainSession(@Param('id') id: string): SessionActionResponse {
  this.validateSessionId(id);
  const response = this.autoPilotService.drainSession(id);
  // No authorization check for session ownership
```

**Impact:** Malicious or compromised user credentials could disrupt other users' sessions. This is an **existing system-wide issue**, not introduced by this PR.

**Recommendation:** Implement session ownership checks by storing user/session associations and validating ownership before allowing drain operations.

---

### 2. Potential XSS in Session Log Display (LOW - PASS)

**Location:** `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html:180`

Session log content is displayed in a `<pre>` tag without sanitization:

```html
<pre class="log-content">{{ d.logContent }}</pre>
```

**Impact:** If log content contains malicious HTML/JavaScript, it could execute in the browser context. However, Angular's default interpolation sanitization applies, and logs should be system-generated, not user-controlled.

**Recommendation:** Verify that log content is always sanitized at the source (`SupervisorDbService`) before storage. Consider using a dedicated log viewer with safe HTML encoding.

---

### 3. Race Condition in Drain Flow (LOW - PASS)

**Location:** `apps/dashboard-api/src/auto-pilot/session-manager.service.ts:113-118`

Potential race condition between checking session existence and setting drain flag:

```typescript
public drainSession(sessionId: string): boolean {
  const runner = this.runners.get(sessionId);
  if (!runner) return false;
  // Session could be deleted here
  this.supervisorDb.setDrainRequested(sessionId);
  return true;
}
```

**Impact:** If session is deleted after the `get()` call but before `setDrainRequested()`, the DB update will fail silently. However, this is harmless because:
- The session is already being destroyed
- The drain flag would be irrelevant

**Recommendation:** Wrap the operation in a try-catch block to log any unexpected failures, or return more detailed status.

---

### 4. SQL Injection Protection (PASS)

**Location:** `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts:207-213`

All database operations use parameterized queries via `better-sqlite3` prepared statements:

```typescript
public setDrainRequested(sessionId: string): void {
  const db = this.getDb();
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE sessions SET drain_requested = 1, updated_at = ? WHERE id = ?',
  ).run(now, sessionId);
}
```

**Verdict:** Secure. No SQL injection vectors.

---

### 5. Input Validation (PASS)

**Location:** `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:208-214`

Session ID is validated against strict regex pattern:

```typescript
private validateSessionId(id: string): void {
  if (!SESSION_ID_RE.test(id)) {
    throw new BadRequestException(
      'Session ID must match SESSION_YYYY-MM-DDTHH-MM-SS format',
    );
  }
}
```

**Verdict:** Secure. Prevents malformed IDs and injection attacks.

---

### 6. Database Operations Security (PASS)

**Locations:** 
- `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts`
- `packages/mcp-cortex/src/db/schema.ts:257`

- Database stored in `.nitro/cortex.db` with directory permissions `0o700` (owner-only)
- WAL journal mode enabled for concurrent access
- Foreign key constraints enforced
- Migration adds `drain_requested` column with default `0` (correct for existing sessions)

**Verdict:** Secure. Proper access controls and migration handling.

---

### 7. Authentication Coverage (PASS)

**Location:** `apps/dashboard-api/src/app/app.module.ts:13-18`

The drain endpoint inherits protection from `HttpAuthGuard` applied globally as `APP_GUARD`:

```typescript
providers: [
  {
    provide: APP_GUARD,
    useClass: HttpAuthGuard,
  },
],
```

**Behavior:** Authentication is:
- Disabled in development (unless `AUTH_ENABLED=true`)
- Enabled in production (unless `AUTH_ENABLED=false`)
- Requires valid API key via `Authorization: Bearer <key>` or `x-api-key: <key>` header

**Verdict:** Acceptable. The new endpoint follows existing authentication patterns.

---

### 8. Frontend Error Handling (PASS)

**Location:** `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:144-159`

API call uses proper error handling with RxJS `catchError`:

```typescript
this.api.drainSession(sessionId).pipe(
  catchError(() => {
    this.isDraining.set(false);
    this.drainError.set('Failed to request session stop. Please try again.');
    return of(null);
  }),
  takeUntilDestroyed(this.destroyRef),
).subscribe();
```

**Verdict:** Secure. Error message is a literal string (not user input), preventing XSS via error content.

---

## Summary

| Category | Status |
|----------|--------|
| Authentication | ✅ Inherits existing guard |
| Authorization | ⚠️ No session ownership checks (existing issue) |
| Input Validation | ✅ Regex validation on session IDs |
| SQL Injection | ✅ Parameterized queries |
| XSS | ⚠️ Logs displayed unsanitized (existing issue) |
| CSRF | ✅ API uses custom auth headers, not vulnerable to CSRF |
| Data Integrity | ✅ DB migrations and constraints enforced |
| Error Handling | ✅ Proper error handling in frontend |

**Overall Verdict:** **PASS**

The implementation introduces minimal security risk. All findings are either:
1. Existing system-wide issues (ownership checks, log display), or
2. Minor implementation details (race condition) with limited impact

The database operations are secure (parameterized queries, proper migrations), input validation is present, and the new endpoint inherits existing authentication mechanisms.

---

## Recommendations (Future Work)

1. **Implement session ownership model** to prevent cross-user session interference
2. **Add rate limiting** to prevent abuse of session control endpoints
3. **Sanitize log content** at write time to prevent potential XSS vectors
4. **Add audit logging** for session drain operations (who drained which session when)
