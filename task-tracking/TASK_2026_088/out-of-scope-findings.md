# Out of Scope Findings

The following issues were found by reviewers but are outside the task's File scope and cannot be fixed by this review worker:

 They require manual intervention or architectural changes:

## Finding 1: Protocol Incompatibility (ws to Socket.IO)
- **Issue**: Migration from `ws` to Socket.IO changes the wire protocol fundamentally. Socket.IO uses its own framing, reconnection, rooms, etc. Clients must migrate from `ws` to `socket.io-client`.
- **Recommendation**: Document the migration requirement or update clients to listen for `'dashboard-event'` events.
- **Severity**: Critical

## Finding 2: Type Definition Mismatch
- **Issue**: Gateway emits `'sessions:changed'` and `'state:refreshed'` but DashboardEventType needs to include these types
- **Location**: dashboard.types.ts (out of scope)
- **Fix**: None - out of scope
- **Recommendation**: Add types to DashboardEventType union in `dashboard.types.ts`

## Finding 3: Missing Authentication
- **Issue**: No authentication or authorization checks in handleConnection
- **Severity**: Critical
- **Impact**: Unauthorized users can access all dashboard data
- **Fix**: Requires architectural change (auth guards, middleware) - out of scope
- **Recommendation**: Document as out-of-scope finding for implement authentication before deployinging to production

 This finding requires discussion with the product owner.

## Finding 4: Hardcoded CORS Origins
- **Issue**: CORS configured only for localhost only
- **Severity**: High
    - **Impact**: Dashboard will not work in production without code changes
    **Fix**: Requires environment variables (existing pattern in codebase)
    - **Recommendation**: Follow existing codebase patterns for environment config

