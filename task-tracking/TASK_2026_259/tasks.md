# Development Tasks — TASK_2026_259

## Batch 1: Session Controls Implementation — COMPLETE

**Developer**: nitro-frontend-developer

### Task 1.1: Add session-detail lifecycle controls

**File**: apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts
**Status**: COMPLETE

Added:
- `WebSocketService` injection for real-time updates
- `liveStatus` signal to hold live `SessionStatusResponse`
- `actionInFlight` and `actionError` signals for UI state
- `isActiveSession`, `canPause`, `canResume`, `canStop`, `canDrain` computed properties
- WebSocket subscription (`session:updated`, `sessions:changed`, `session:update`) to refresh live status
- `pause()`, `resume()`, `stop()`, `drain()` action methods with in-flight guard
- `runAction()` helper with error handling and post-action refresh

### Task 1.2: Add session-detail controls HTML

**File**: apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html
**Status**: COMPLETE

Added controls card visible when `isActiveSession()`:
- Conditional Pause button (when canPause)
- Conditional Resume button (when canResume)
- Stop button (when canStop) with danger styling
- Drain button (when canDrain)
- Error banner when actionError is set
- Live status row showing loopStatus, active workers, task counts, drain badge

### Task 1.3: Add session-detail controls styles

**File**: apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.scss
**Status**: COMPLETE

Added: `.controls-card`, `.controls-row`, `.controls-error`, `.live-status-row`, `.live-status-item`

### Task 1.4: Add sessions-list quick Stop action

**File**: apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts
**Status**: COMPLETE

Added:
- `stoppingIds` signal (ReadonlySet<string>) for per-row loading tracking
- `isStopping(id)` method
- `stopSession(id, event)` method with event.stopPropagation()

### Task 1.5: Add sessions-list Actions column

**File**: apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html
**Status**: COMPLETE

Added "Actions" column with Stop button visible for `statusLabel === 'running'` sessions.

### Task 1.6: Add sessions-list actions styles

**File**: apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.scss
**Status**: COMPLETE

Added `.actions-cell` style.
