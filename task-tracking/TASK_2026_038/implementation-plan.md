# Implementation Plan — TASK_2026_038
# Dashboard Session Support — Multi-Session View and History

## Codebase Investigation Summary

### Key Files Verified

- `packages/dashboard-service/src/events/event-types.ts` — all shared types; `DashboardEvent` carries `type`, `timestamp`, `payload`; no `sessionId` field today
- `packages/dashboard-service/src/state/store.ts` — `StateStore` holds a single `OrchestratorState`; session concept absent
- `packages/dashboard-service/src/parsers/state.parser.ts` — `canParse` checks `filePath.endsWith('orchestrator-state.md')`; session state files are named `state.md`, so they are silently skipped today
- `packages/dashboard-service/src/parsers/file-router.ts` — routes changes to typed parsers; straightforward to add a session-aware branch
- `packages/dashboard-service/src/server/http.ts` — small hand-rolled router with `addRoute(method, path, handler)`; adding REST routes is a one-liner per endpoint
- `packages/dashboard-service/src/index.ts` — `DashboardService.watchTaskTracking()` walks the whole `task-tracking/` tree; sessions/ is already inside that tree, so file changes are already observed — but the router does nothing with them
- `packages/dashboard-web/src/store/index.ts` — Zustand store, single `state: OrchestratorState | null`; needs a `sessions` slice added
- `packages/dashboard-web/src/hooks/index.ts` — `useInitialData` loads registry/plan/state; needs session loading added; `useWebSocket` dispatches events by type
- `packages/dashboard-web/src/api/client.ts` — thin `ApiClient`; new session methods follow the same `fetchJson` pattern
- `packages/dashboard-web/src/App.tsx` — React Router routes; add `/sessions` route
- `packages/dashboard-web/src/components/Sidebar.tsx` — flat NAV_ITEMS array; add Sessions entry and session picker

### Actual Session File Format (Empirically Verified)

```
task-tracking/sessions/SESSION_YYYY-MM-DD_HH-MM-SS/
  state.md        — same markdown format as orchestrator-state.md; existing StateParser.parse() works, only canParse() is wrong
  log.md          — "| Timestamp | Source | Event |" table (3 columns, not 2)
task-tracking/active-sessions.md — "| Session | Source | Started | Tasks | Path |" table
```

Note: `state.md` has the same internal format as `orchestrator-state.md`. The only issue is `canParse` is name-gated.

---

## Architecture Design

### Design Philosophy

Add session awareness with the minimum surface area: a `SessionStore` alongside `StateStore`, two new parsers, three new HTTP endpoints, and one new Zustand slice. No caching layers, no state machines, no session-scoped watchers — the existing full-tree watcher already sees everything.

---

## Component Specifications

### TASK 1 — Types: extend `event-types.ts`

**File**: `packages/dashboard-service/src/events/event-types.ts` (MODIFY)

Add three new exported interfaces and extend `DashboardEventType`.

```typescript
// Parsed from active-sessions.md
export interface ActiveSessionRecord {
  readonly sessionId: string;    // e.g. SESSION_2026-03-27_10-20-12
  readonly source: string;       // e.g. "auto-pilot"
  readonly started: string;      // raw value from table
  readonly tasks: string;        // raw value (could be "14")
  readonly path: string;         // relative path to session dir
}

// Per-session summary used by list endpoints and the session overview UI
export interface SessionSummary {
  readonly sessionId: string;
  readonly isActive: boolean;
  readonly source: string;
  readonly started: string;
  readonly path: string;
  readonly taskCount: number;
  readonly loopStatus: string;   // from state.md — "RUNNING" | "STOPPED" | "UNKNOWN"
  readonly lastUpdated: string;
}

// Full session payload: summary + state + log
export interface SessionData {
  readonly summary: SessionSummary;
  readonly state: OrchestratorState | null;
  readonly log: ReadonlyArray<{ timestamp: string; source: string; event: string }>;
}
```

Also add to `DashboardEventType`:
```typescript
| 'session:updated'    // fired when a session's state.md or log.md changes
| 'sessions:changed'   // fired when active-sessions.md changes (sessions added/removed)
```

Add `sessionId?: string` to `DashboardEvent.payload` — no interface change needed; `payload` is already `Record<string, unknown>`.

**Evidence**: `event-types.ts:187-205` — existing pattern for union type and interface extension.

---

### TASK 2 — Backend: `SessionStore` and two new parsers

**Files**:
- `packages/dashboard-service/src/state/session-store.ts` (CREATE)
- `packages/dashboard-service/src/parsers/session-state.parser.ts` (CREATE)
- `packages/dashboard-service/src/parsers/session-log.parser.ts` (CREATE)
- `packages/dashboard-service/src/parsers/active-sessions.parser.ts` (CREATE)

#### `SessionStore`

Holds a `Map<sessionId, SessionData>` and a separate `activeSessionIds: Set<string>`.

Public API (mirrors `StateStore` patterns from `state/store.ts:14-201`):
```typescript
export class SessionStore {
  getSessions(): ReadonlyArray<SessionSummary>          // sorted newest first
  getSession(id: string): SessionData | null
  getActiveSessions(): ReadonlyArray<SessionSummary>
  setSessionState(id: string, state: OrchestratorState): void
  setSessionLog(id: string, log: ReadonlyArray<...>): void
  setActiveSessionIds(ids: ReadonlyArray<string>): void
  removeSession(id: string): void
}
```

Session ID is extracted from the file path: `path.match(/SESSION_[\d_-]+/)`.

#### `SessionStateParser`

Implements `FileParser<OrchestratorState>` (same interface as `parser.interface.ts`).

```typescript
canParse(filePath: string): boolean {
  // Match: .../sessions/SESSION_*/state.md
  return /sessions[\\/]SESSION_[^/\\]+[\\/]state\.md$/.test(filePath);
}
parse(content, filePath): OrchestratorState {
  // Delegate to the existing StateParser.parse() — format is identical
  return new StateParser().parse(content, filePath);
}
```

This avoids duplicating the 184-line parsing logic in `state.parser.ts`.

#### `SessionLogParser`

Implements `FileParser<ReadonlyArray<{timestamp, source, event}>>`.

```typescript
canParse(filePath: string): boolean {
  return /sessions[\\/]SESSION_[^/\\]+[\\/]log\.md$/.test(filePath);
}
parse(content, _filePath): ReadonlyArray<...> {
  // Parse the 3-column table: | Timestamp | Source | Event |
  // Skip header and separator rows
}
```

Log.md has 3 columns (`Timestamp | Source | Event`) vs. state's `sessionLog` which only has 2 (`timestamp | event`). The `SessionData.log` interface captures all 3 columns.

#### `ActiveSessionsParser`

Implements `FileParser<ReadonlyArray<ActiveSessionRecord>>`.

```typescript
canParse(filePath: string): boolean {
  return filePath.endsWith('active-sessions.md');
}
parse(content, _filePath): ReadonlyArray<ActiveSessionRecord> {
  // Parse the 5-column table: | Session | Source | Started | Tasks | Path |
}
```

**Evidence**: `parser.interface.ts:1-4`; `state.parser.ts:4-25` for `FileParser<T>` pattern; `registry.parser.ts` for table-parsing pattern.

---

### TASK 3 — Backend: wire parsers into `FileRouter` and `DashboardService`

**Files**:
- `packages/dashboard-service/src/parsers/file-router.ts` (MODIFY)
- `packages/dashboard-service/src/index.ts` (MODIFY)

#### FileRouter changes

Inject `SessionStore` alongside `StateStore`. Add the three new parsers as private fields. In `loadFile()`, add three new branches after the existing `stateParser` branch:

```typescript
if (this.activeSessionsParser.canParse(filePath)) {
  const records = this.activeSessionsParser.parse(content, filePath);
  const ids = records.map(r => r.sessionId);
  this.sessionStore.setActiveSessionIds(ids);
  this.emitEvents([{ type: 'sessions:changed', timestamp: ..., payload: { activeCount: ids.length } }]);
  return;
}

if (this.sessionStateParser.canParse(filePath)) {
  const sessionId = extractSessionId(filePath); // utility: path.match(/SESSION_[\d_-]+/)?.[0]
  if (sessionId) {
    const state = this.sessionStateParser.parse(content, filePath);
    this.sessionStore.setSessionState(sessionId, state);
    this.emitEvents([{ type: 'session:updated', timestamp: ..., payload: { sessionId } }]);
  }
  return;
}

if (this.sessionLogParser.canParse(filePath)) {
  const sessionId = extractSessionId(filePath);
  if (sessionId) {
    const log = this.sessionLogParser.parse(content, filePath);
    this.sessionStore.setSessionLog(sessionId, log);
    this.emitEvents([{ type: 'session:updated', timestamp: ..., payload: { sessionId } }]);
  }
  return;
}
```

In `handleRemoval()`, add a branch for `sessions/SESSION_*/state.md` to call `sessionStore.removeSession(id)`.

#### DashboardService changes

- Construct `SessionStore`, pass it to `FileRouter`.
- Expose `getSessionStore()` accessor (mirrors existing `getStore()` at `index.ts:83`).
- Initial load in `watchTaskTracking()` already walks the full tree — sessions/ files are picked up automatically. No additional watcher needed.

**Evidence**: `file-router.ts:16-186`; `index.ts:34-39` for constructor injection pattern.

---

### TASK 4 — Backend: three new HTTP endpoints

**File**: `packages/dashboard-service/src/server/http.ts` (MODIFY)

Add `sessionStore: SessionStore` parameter to `createHttpServer`. Add three routes using the existing `addRoute` / `sendJson` pattern (verified at `http.ts:44-56` and `http.ts:66-107`):

```
GET /api/sessions
  → sessionStore.getSessions() — array of SessionSummary, sorted newest first

GET /api/sessions/active
  → sessionStore.getActiveSessions()

GET /api/sessions/:id
  → sessionStore.getSession(id) — full SessionData (summary + state + log)
  → 404 if not found
```

Route ordering matters: register `/api/sessions/active` before `/api/sessions/:id` so the literal "active" is not captured as a param. The existing router checks routes in registration order (verified at `http.ts:119-130`).

**Evidence**: `http.ts:41-107` — all existing routes follow this exact pattern.

---

### TASK 5 — Frontend: Zustand store session slice

**File**: `packages/dashboard-web/src/store/index.ts` (MODIFY)

Add to `DashboardState`:
```typescript
sessions: readonly SessionSummary[];
selectedSessionId: string | null;
sessionData: Map<string, SessionData>;

setSessions: (sessions: readonly SessionSummary[]) => void;
setSelectedSession: (id: string | null) => void;
setSessionData: (id: string, data: SessionData) => void;
```

Initial state: `sessions: []`, `selectedSessionId: null`, `sessionData: new Map()`.

`setSelectedSession` is the trigger for session rehydration — views read `sessionData.get(selectedSessionId)` to get session-scoped state/log/workers.

**No changes to existing store fields.** Global views (TaskBoard, Roadmap, Queue) continue reading `registry`, `plan`, `state` unchanged.

**Evidence**: `store/index.ts:11-96` — Zustand `create` slice pattern.

---

### TASK 6 — Frontend: API client + hooks + WebSocket handler

**Files**:
- `packages/dashboard-web/src/api/client.ts` (MODIFY)
- `packages/dashboard-web/src/hooks/index.ts` (MODIFY)

#### ApiClient additions

```typescript
getSessions(): Promise<readonly SessionSummary[]>
getActiveSessions(): Promise<readonly SessionSummary[]>
getSession(id: string): Promise<SessionData>
```

Same `fetchJson` pattern as all existing methods (`client.ts:22-28`).

#### `useInitialData` changes

After loading registry/plan/state, also load `api.getSessions()` and call `setSessions`. Auto-select the most recent active session, or most recent overall if none active:

```typescript
const sessions = await api.getSessions();
setSessions(sessions);
const activeOnes = sessions.filter(s => s.isActive);
const defaultSession = activeOnes[0] ?? sessions[0] ?? null;
if (defaultSession) setSelectedSession(defaultSession.sessionId);
```

Then load that session's full data: `api.getSession(id)` -> `setSessionData(id, data)`.

#### `useWebSocket` additions

Handle the two new event types:

```typescript
case 'sessions:changed':
  void api.getSessions().then(setSessions).catch(console.error);
  break;
case 'session:updated': {
  const sessionId = event.payload.sessionId as string;
  // Only re-fetch if it's the selected session (avoids loading all sessions on every file write)
  if (sessionId === selectedSessionId) {
    void api.getSession(sessionId).then(d => setSessionData(sessionId, d)).catch(console.error);
  }
  break;
}
```

Add a `useSessionData` hook that returns the currently selected session's `SessionData | null` by reading `sessionData.get(selectedSessionId ?? '')`.

**Evidence**: `hooks/index.ts:9-135` — all existing hooks follow this exact pattern.

---

### TASK 7 — Frontend: UI components and views

**Files**:
- `packages/dashboard-web/src/components/SessionPicker.tsx` (CREATE)
- `packages/dashboard-web/src/views/Sessions.tsx` (CREATE)
- `packages/dashboard-web/src/components/Sidebar.tsx` (MODIFY)
- `packages/dashboard-web/src/views/Workers.tsx` (MODIFY)
- `packages/dashboard-web/src/views/SessionLog.tsx` (MODIFY)
- `packages/dashboard-web/src/views/CostDashboard.tsx` (MODIFY)
- `packages/dashboard-web/src/App.tsx` (MODIFY)

#### `SessionPicker` component

A `<select>` dropdown (or equivalent) rendered in the Sidebar below the nav. Uses `useDashboardStore` to read `sessions` and `selectedSessionId`. Calls `setSelectedSession` on change and fetches the new session's data if not already cached:

```typescript
const onSelect = (id: string) => {
  setSelectedSession(id);
  if (!sessionData.has(id)) {
    void api.getSession(id).then(d => setSessionData(id, d)).catch(console.error);
  }
};
```

Active sessions shown with a green indicator. Badge in sidebar title shows count when 2+ sessions are active.

#### `Sessions` view (`/sessions`)

Renders a card grid — one card per session. Active cards show live status, worker count, elapsed time. Historical cards show final stats from `SessionData.state`. Sorted newest first (already handled server-side by `SessionStore.getSessions()`). No pagination needed — internal tool.

#### Sidebar modification

Add Sessions nav item: `{ path: '/sessions', label: 'Sessions', icon: '...' }`.

Render `<SessionPicker />` below the nav list.

#### Session-scoped view modifications

`Workers`, `SessionLog`, `CostDashboard` each call `useSessionData()` instead of `useDashboardStore(s => s.state)` directly:

```typescript
// Before:
const state = useDashboardStore((s) => s.state);
const workers = state?.activeWorkers ?? [];

// After:
const sessionData = useSessionData();
const workers = sessionData?.state?.activeWorkers ?? [];
```

`SessionLog` similarly reads `sessionData?.log ?? []` (note: 3-column log entries with `source` field, update the table render to show the Source column).

`CostDashboard` reads cost data from `sessionData?.state` scoped to the selected session.

#### App.tsx modification

Add route: `<Route path="/sessions" element={wrap('Sessions', <Sessions />)} />`

**Evidence**: `App.tsx:83-96`; `Sidebar.tsx:11-21`; `Workers.tsx:8` and `SessionLog.tsx:9` for the `useDashboardStore` pattern being replaced.

---

## What NOT to Build (YAGNI)

- No session-scoped file watchers — the existing full-tree watcher covers everything
- No caching TTL or cache invalidation layer — `SessionStore` is an in-memory map; re-parsed on file change
- No WebSocket session subscription filtering on the server — client filters by `selectedSessionId`
- No session deletion or archival endpoints — read-only
- No pagination on session list — internal tool with bounded session count
- No complex state machine for session lifecycle — `isActive` is derived from `active-sessions.md` membership

---

## Files Affected Summary

**CREATE**:
- `packages/dashboard-service/src/state/session-store.ts`
- `packages/dashboard-service/src/parsers/session-state.parser.ts`
- `packages/dashboard-service/src/parsers/session-log.parser.ts`
- `packages/dashboard-service/src/parsers/active-sessions.parser.ts`
- `packages/dashboard-web/src/components/SessionPicker.tsx`
- `packages/dashboard-web/src/views/Sessions.tsx`

**MODIFY**:
- `packages/dashboard-service/src/events/event-types.ts` — new types + event union members
- `packages/dashboard-service/src/parsers/file-router.ts` — inject SessionStore, add 3 parser branches
- `packages/dashboard-service/src/server/http.ts` — add 3 routes
- `packages/dashboard-service/src/index.ts` — construct SessionStore, wire to FileRouter + HTTP
- `packages/dashboard-web/src/store/index.ts` — add sessions slice
- `packages/dashboard-web/src/api/client.ts` — add 3 session methods
- `packages/dashboard-web/src/hooks/index.ts` — load sessions on init, handle new WS events, add `useSessionData`
- `packages/dashboard-web/src/components/Sidebar.tsx` — add Sessions nav item, render SessionPicker
- `packages/dashboard-web/src/views/Workers.tsx` — read from session-scoped state
- `packages/dashboard-web/src/views/SessionLog.tsx` — read from session log, show Source column
- `packages/dashboard-web/src/views/CostDashboard.tsx` — read from session-scoped state
- `packages/dashboard-web/src/App.tsx` — add /sessions route

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: both (backend-developer for Tasks 1-4, frontend-developer for Tasks 5-7)
Tasks 1-4 are pure Node.js/TypeScript with no React; Tasks 5-7 are pure React/Zustand. They can run in parallel after Task 1 (types) is done.

### Parallelism

- Wave 1: Task 1 (types) — everything depends on these interfaces
- Wave 2 (parallel): Task 2 (backend parsers/store) AND Task 5 (frontend Zustand slice)
- Wave 3 (parallel): Task 3 (wire FileRouter) AND Task 6 (API client + hooks)
- Wave 4: Task 4 (HTTP endpoints) — needs SessionStore wired
- Wave 5: Task 7 (UI components) — needs hooks and store slice

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 8-12 hours total (4-6 backend, 4-6 frontend)

### Key Implementation Notes for Developer

1. `SessionStateParser.parse()` should delegate to `new StateParser().parse()` — the state.md format is identical to orchestrator-state.md. Do not duplicate the parsing logic.

2. The session ID extraction utility (`path.match(/SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)?.[0]`) will be needed in both `FileRouter` and `SessionStore`. Extract it as a small helper function in a shared location (e.g., `state/session-id.ts`).

3. Route registration order in `http.ts`: register `/api/sessions/active` before `/api/sessions/:id`.

4. `SessionStore.getSessions()` should derive `isActive` by checking if the session ID is in the active set, and sort by `sessionId` descending (ISO timestamp format sorts lexicographically).

5. The `log.md` entries have a `Source` column that `OrchestratorState.sessionLog` does not have (only 2 columns). The new `SessionData.log` type adds the `source` field. The `SessionLog` view needs updating to render this extra column.
