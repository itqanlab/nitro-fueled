# Development Tasks - TASK_2026_341

## Batch 1: Angular WebSocket Service — COMPLETE

**Developer**: nitro-frontend-developer

### Task 1.1: Update apps/dashboard/src/app/services/websocket.service.ts

**File**: apps/dashboard/src/app/services/websocket.service.ts
**Status**: COMPLETE

The file already existed with `events$` and `cortexEvents$` observables. Added:
- `ConnectionStatus` exported type: `'connected' | 'disconnected' | 'reconnecting'`
- `connectionStatus$` BehaviorSubject-backed observable for UI indicators
- socket.io reconnection options: `reconnectionDelay` (1s base), `reconnectionDelayMax` (30s), `reconnectionAttempts` (10), `randomizationFactor` (0.5) — provides exponential backoff
- Lifecycle listeners: `connect`, `disconnect`, `reconnect_attempt` to drive `connectionStatus$`
- `connectionStatusSubject.complete()` on destroyRef cleanup
