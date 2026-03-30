# Code Logic Review Report — TASK_2026_088

## Summary

| Status | FAILED |
|--------|--------|
| Reviewer | nitro-code-logic-reviewer |
| Date | 2026-03-28 |
| Files Reviewed | 2 |

## Critical Issues

### L1: Protocol Incompatibility — Event Channeling Mismatch

**Location**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:57-61, 134`

**Issue**: The Socket.IO implementation wraps all messages in a `'dashboard-event'` event name, but the original `ws` implementation sends raw JSON messages without any event channel wrapper.

**Original behavior**:
```typescript
// ws implementation sends raw JSON
ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
```

**New behavior**:
```typescript
// Socket.IO implementation wraps in event name
client.emit('dashboard-event', { type: 'connected', timestamp: ..., payload: {} });
this.server.emit('dashboard-event', event);
```

**Impact**: Clients expecting the original `ws` protocol will not receive messages. Socket.IO clients must listen for `'dashboard-event'` specifically. This is a **breaking protocol change**.

---

### L2: Protocol Incompatibility — Connection Event Payload Mismatch

**Location**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:57-61`

**Issue**: The connection event includes a `payload: {}` field that does not exist in the original implementation.

**Original**: `{ type: 'connected', timestamp: '...' }`

**New**: `{ type: 'connected', timestamp: '...', payload: {} }`

**Impact**: Clients expecting the exact original payload structure will receive an unexpected field. While some clients may ignore unknown fields, strict parsers will fail.

---

### L3: Type Definition Mismatch — Event Types Not Declared

**Location**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:103, 116` vs `dashboard.types.ts:238-250`

**Issue**: The gateway emits events with types `'sessions:changed'` and `'state:refreshed'`, but these types are not included in the `DashboardEventType` union.

`DashboardEventType` includes:
- `task:created`, `task:updated`, `task:deleted`, `task:state_changed`
- `worker:spawned`, `worker:progress`, `worker:completed`, `worker:failed`
- `review:written`, `plan:updated`
- `pipeline:*` types

But NOT: `'connected'`, `'sessions:changed'`, `'state:refreshed'`

**Impact**: Type system does not reflect actual runtime behavior. TypeScript will not catch misuse of these event types.

---

## Acceptance Criteria Analysis

| Criteria | Status | Notes |
|----------|--------|-------|
| DashboardGateway created and registered | PASS | ✓ |
| Same event names and payload shapes | **FAIL** | See L1, L2 |
| Services injected | PASS | ✓ |
| `nx build dashboard-api` succeeds | PASS | ✓ |
| Client can connect without protocol changes | **FAIL** | See L1 - protocol changed |

---

## Additional Observations

### O1: Unused Async Keyword
**Location**: `dashboard.gateway.ts:88`

The watcher subscription handler is marked `async` but the `_path` and `_event` parameters are unused (prefixed with underscore). The async is unnecessary since `broadcastChanges()` is called without awaiting its result.

```typescript
async (_path: string, _event: FileChangeEvent): Promise<void> => {
  await this.broadcastChanges();  // await is here, but handler returns void
},
```

The `await` here doesn't provide value since errors are caught inside `broadcastChanges()`.

### O2: Defensive Server Check is Redundant
**Location**: `dashboard.gateway.ts:130-133`

The check `if (!this.server)` is defensive but unlikely to be triggered since `afterInit()` runs before any clients connect and before the watcher subscription is set up.

---

## Out-of-Scope Issue (Document Only)

### OOS1: Socket.IO vs WS Wire Protocol

The migration from `ws` (raw WebSocket) to Socket.IO introduces a fundamentally different wire protocol. Socket.IO uses its own transport layer with additional features (reconnection, rooms, etc.). Even if the event names and payloads matched exactly, clients using the native `WebSocket` API would need to be updated to use the Socket.IO client library.

This is an architectural decision that affects clients outside the scope of this task but should be noted.

---

## Recommendations

1. **CRITICAL**: Address the protocol incompatibility before deploying. Options:
   - Keep the Socket.IO wrapper but document that clients must migrate to Socket.IO client library
   - Emit events directly without the `'dashboard-event'` wrapper (if Socket.IO supports this pattern)
   - Maintain both protocols during a transition period

2. **CRITICAL**: Update `DashboardEventType` to include `'connected'`, `'sessions:changed'`, `'state:refreshed'`

3. **CRITICAL**: Remove `payload: {}` from connection event to match original protocol

4. **OPTIONAL**: Remove `async` keyword from watcher subscription handler or explain why it's needed
