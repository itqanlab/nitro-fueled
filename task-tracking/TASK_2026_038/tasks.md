# Development Tasks - TASK_2026_038
# Dashboard Session Support — Multi-Session View and History

**Total Tasks**: 13 | **Batches**: 3 | **Status**: 2/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `state.md` session files use identical format to `orchestrator-state.md`: Verified — plan confirms `StateParser.parse()` works, only `canParse()` is name-gated
- Full-tree watcher in `watchTaskTracking()` already covers `sessions/` subtree: Verified — `index.ts` walks entire `task-tracking/` tree
- `payload` on `DashboardEvent` is already `Record<string, unknown>`: Verified — no interface change needed to add `sessionId`
- Existing `addRoute` / `sendJson` pattern in `http.ts` supports the 3 new endpoints: Verified
- `fetchJson` pattern in `api/client.ts` supports 3 new session methods: Verified

### Risks Identified

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Route ordering: `/api/sessions/active` must be registered before `/api/sessions/:id` or "active" is captured as a param | HIGH | Task 1.4 explicitly documents registration order |
| Session ID regex must handle both forward-slash and backslash path separators (Windows compat) | MED | Task 1.2 uses `[\\/]` in all path regex patterns |
| `SessionLog` view currently renders 2-column table; `log.md` has 3 columns — mismatch if not updated | MED | Task 3.5 explicitly updates `SessionLog` to render Source column |

---

## Batch 1: Backend Infrastructure - COMPLETE

**Developer**: backend-developer
**Tasks**: 4 (Tasks 1.1 through 1.4) | **Dependencies**: None

### Task 1.1: Extend event-types.ts with session interfaces and event types - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/events/event-types.ts`
**Action**: MODIFY — add three new exported interfaces and two new event type union members

**What to add**:

1. Export `ActiveSessionRecord` interface:
   - `sessionId: string` — e.g. `SESSION_2026-03-27_10-20-12`
   - `source: string` — e.g. `"auto-pilot"`
   - `started: string` — raw table value
   - `tasks: string` — raw table value (could be `"14"`)
   - `path: string` — relative path to session dir
   All fields `readonly`.

2. Export `SessionSummary` interface:
   - `sessionId: string`, `isActive: boolean`, `source: string`, `started: string`, `path: string`
   - `taskCount: number`, `loopStatus: string` (from state.md — "RUNNING" | "STOPPED" | "UNKNOWN"), `lastUpdated: string`
   All fields `readonly`.

3. Export `SessionData` interface:
   - `summary: SessionSummary`
   - `state: OrchestratorState | null`
   - `log: ReadonlyArray<{ timestamp: string; source: string; event: string }>`
   All fields `readonly`.

4. Add two members to the `DashboardEventType` union:
   - `'session:updated'` — fired when a session's `state.md` or `log.md` changes
   - `'sessions:changed'` — fired when `active-sessions.md` changes

**Pattern to follow**: `event-types.ts:187-205` — existing interface and union patterns.

**Status**: PENDING

---

### Task 1.2: Create SessionStore and three parsers - COMPLETE

**Files**:
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/state/session-id.ts` (CREATE — shared helper)
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/state/session-store.ts` (CREATE)
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/parsers/session-state.parser.ts` (CREATE)
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/parsers/session-log.parser.ts` (CREATE)
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/parsers/active-sessions.parser.ts` (CREATE)

**Action**: CREATE all five files

**`session-id.ts`** — export a single helper:
```typescript
export function extractSessionId(filePath: string): string | null {
  return filePath.match(/SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)?.[0] ?? null;
}
```
This is used in both `FileRouter` and `SessionStore`. Centralise here to avoid duplication.

**`session-store.ts`** — `SessionStore` class:
- Private `Map<string, SessionData>` for session data
- Private `Set<string>` for `activeSessionIds`
- Public API:
  - `getSessions(): ReadonlyArray<SessionSummary>` — derives `isActive` from active set; sorts by `sessionId` descending (ISO timestamp format sorts lexicographically)
  - `getSession(id: string): SessionData | null`
  - `getActiveSessions(): ReadonlyArray<SessionSummary>` — filters `getSessions()` by `isActive`
  - `setSessionState(id: string, state: OrchestratorState): void` — upserts into the map; derive summary fields from state where possible; set `loopStatus` from `state.loopStatus ?? 'UNKNOWN'`
  - `setSessionLog(id: string, log: ReadonlyArray<{timestamp, source, event}>): void` — upserts log into existing session data
  - `setActiveSessionIds(ids: ReadonlyArray<string>): void` — replaces the active set
  - `removeSession(id: string): void` — deletes from the map
- Pattern to follow: `packages/dashboard-service/src/state/store.ts:14-201`

**`session-state.parser.ts`** — implements `FileParser<OrchestratorState>`:
- `canParse(filePath)`: return `true` if path matches `/sessions[\\/]SESSION_[^/\\]+[\\/]state\.md$/`
- `parse(content, filePath)`: delegate entirely to `new StateParser().parse(content, filePath)` — the format is IDENTICAL to `orchestrator-state.md`; do NOT duplicate the 184-line parsing logic
- Pattern to follow: `packages/dashboard-service/src/parsers/state.parser.ts:4-25` for `FileParser<T>` interface

**`session-log.parser.ts`** — implements `FileParser<ReadonlyArray<{timestamp, source, event}>>`:
- `canParse(filePath)`: return `true` if path matches `/sessions[\\/]SESSION_[^/\\]+[\\/]log\.md$/`
- `parse(content, _filePath)`: parse the 3-column markdown table `| Timestamp | Source | Event |`; skip header row and separator row (`| --- |`); return array of `{timestamp, source, event}` objects
- Note: `log.md` has 3 columns; this is NOT the same as `OrchestratorState.sessionLog` which only has 2 columns

**`active-sessions.parser.ts`** — implements `FileParser<ReadonlyArray<ActiveSessionRecord>>`:
- `canParse(filePath)`: return `true` if `filePath.endsWith('active-sessions.md')`
- `parse(content, _filePath)`: parse the 5-column markdown table `| Session | Source | Started | Tasks | Path |`; skip header and separator rows; map columns to `{sessionId, source, started, tasks, path}`
- Pattern to follow: `packages/dashboard-service/src/parsers/registry.parser.ts` for table-parsing pattern

**Status**: PENDING

---

### Task 1.3: Wire parsers and SessionStore into FileRouter and DashboardService - COMPLETE

**Files**:
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/parsers/file-router.ts` (MODIFY)
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/index.ts` (MODIFY)

**Action**: MODIFY both files

**`file-router.ts`** changes:
1. Inject `SessionStore` as a constructor parameter alongside `StateStore`
2. Add three new parser instances as private fields: `SessionStateParser`, `SessionLogParser`, `ActiveSessionsParser`
3. In `loadFile()`, add three new branches AFTER the existing `stateParser` branch (order matters — state.md check must come after the session state check to avoid false matches):

   Branch 1 — active sessions:
   ```typescript
   if (this.activeSessionsParser.canParse(filePath)) {
     const records = this.activeSessionsParser.parse(content, filePath);
     const ids = records.map(r => r.sessionId);
     this.sessionStore.setActiveSessionIds(ids);
     this.emitEvents([{ type: 'sessions:changed', timestamp: new Date().toISOString(), payload: { activeCount: ids.length } }]);
     return;
   }
   ```

   Branch 2 — session state:
   ```typescript
   if (this.sessionStateParser.canParse(filePath)) {
     const sessionId = extractSessionId(filePath);
     if (sessionId) {
       const state = this.sessionStateParser.parse(content, filePath);
       this.sessionStore.setSessionState(sessionId, state);
       this.emitEvents([{ type: 'session:updated', timestamp: new Date().toISOString(), payload: { sessionId } }]);
     }
     return;
   }
   ```

   Branch 3 — session log:
   ```typescript
   if (this.sessionLogParser.canParse(filePath)) {
     const sessionId = extractSessionId(filePath);
     if (sessionId) {
       const log = this.sessionLogParser.parse(content, filePath);
       this.sessionStore.setSessionLog(sessionId, log);
       this.emitEvents([{ type: 'session:updated', timestamp: new Date().toISOString(), payload: { sessionId } }]);
     }
     return;
   }
   ```

4. In `handleRemoval()`, add a branch: if path matches `sessions/SESSION_*/state.md`, call `extractSessionId(filePath)` and `this.sessionStore.removeSession(id)`

**`index.ts`** changes:
1. Construct `SessionStore` in `DashboardService` constructor
2. Pass `SessionStore` to `FileRouter` constructor
3. Pass `SessionStore` to `createHttpServer` call
4. Add `getSessionStore(): SessionStore` accessor method (mirrors existing `getStore()` at `index.ts:83`)
5. No new watcher needed — existing full-tree watcher in `watchTaskTracking()` already covers `sessions/`

**Pattern to follow**: `file-router.ts:16-186`; `index.ts:34-39` for constructor injection pattern

**Status**: PENDING

---

### Task 1.4: Add three HTTP session endpoints - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/server/http.ts`
**Action**: MODIFY

**Changes**:
1. Add `sessionStore: SessionStore` as a parameter to `createHttpServer`
2. Register three routes using the existing `addRoute` / `sendJson` pattern (see `http.ts:44-56` and `http.ts:66-107`):

   CRITICAL — route registration order matters. The router matches in registration order. Register the literal route BEFORE the param route:

   ```
   // Register this FIRST:
   GET /api/sessions/active  → sessionStore.getActiveSessions()

   // Register this SECOND (otherwise "active" is captured as :id):
   GET /api/sessions/:id     → sessionStore.getSession(id); 404 if null

   // Register this anywhere:
   GET /api/sessions         → sessionStore.getSessions()
   ```

3. For the `:id` endpoint: parse the session ID from the request URL (e.g. last path segment), call `getSession(id)`, return `sendJson(res, 404, { error: 'Not found' })` if null

**Pattern to follow**: `http.ts:41-107` — all existing routes follow the exact `addRoute` / `sendJson` pattern

**Status**: PENDING

---

**Batch 1 Verification**:
- All 8 files exist at stated paths (5 new + 3 modified)
- Session ID regex handles both `/` and `\` separators
- Route order: `/api/sessions/active` registered before `/api/sessions/:id`
- `SessionStateParser.parse()` delegates to `StateParser` — no duplicated parsing logic
- code-logic-reviewer approved

---

## Batch 2: Frontend Infrastructure - COMPLETE

**Developer**: frontend-developer
**Tasks**: 2 (Tasks 2.1 and 2.2) | **Dependencies**: Batch 1 must be COMPLETE (types defined in event-types.ts)

### Task 2.1: Add sessions slice to Zustand store - COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/store/index.ts`
**Action**: MODIFY

**Changes**:
1. Import `SessionSummary` and `SessionData` from the shared types (wherever the dashboard-web package imports from dashboard-service types)
2. Add to `DashboardState` interface:
   ```typescript
   sessions: readonly SessionSummary[];
   selectedSessionId: string | null;
   sessionData: Map<string, SessionData>;
   setSessions: (sessions: readonly SessionSummary[]) => void;
   setSelectedSession: (id: string | null) => void;
   setSessionData: (id: string, data: SessionData) => void;
   ```
3. Add to initial state:
   - `sessions: []`
   - `selectedSessionId: null`
   - `sessionData: new Map()`
4. Implement the three setters in the Zustand `create` call:
   - `setSessions`: replaces sessions array
   - `setSelectedSession`: sets selectedSessionId
   - `setSessionData`: merges new entry into map — create a new Map to maintain immutability: `new Map(state.sessionData).set(id, data)`

**IMPORTANT**: Do NOT modify any existing fields (`registry`, `plan`, `state`, etc.). Global views (TaskBoard, Roadmap, Queue) continue reading those unchanged.

**Pattern to follow**: `packages/dashboard-web/src/store/index.ts:11-96` — existing Zustand `create` slice pattern

**Status**: PENDING

---

### Task 2.2: Add session API methods, update hooks, add useSessionData - COMPLETE

**Files**:
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/api/client.ts` (MODIFY)
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/hooks/index.ts` (MODIFY)

**Action**: MODIFY both files

**`client.ts`** changes — add three methods using the same `fetchJson` pattern (see `client.ts:22-28`):
```typescript
getSessions(): Promise<readonly SessionSummary[]>   // GET /api/sessions
getActiveSessions(): Promise<readonly SessionSummary[]>  // GET /api/sessions/active
getSession(id: string): Promise<SessionData>         // GET /api/sessions/:id
```

**`hooks/index.ts`** changes:

1. Update `useInitialData` — after loading registry/plan/state, also load sessions:
   ```typescript
   const sessions = await api.getSessions();
   setSessions(sessions);
   // Auto-select: prefer most recent active, fall back to most recent overall
   const activeOnes = sessions.filter(s => s.isActive);
   const defaultSession = activeOnes[0] ?? sessions[0] ?? null;
   if (defaultSession) {
     setSelectedSession(defaultSession.sessionId);
     const data = await api.getSession(defaultSession.sessionId);
     setSessionData(defaultSession.sessionId, data);
   }
   ```

2. Update `useWebSocket` — handle two new event types:
   ```typescript
   case 'sessions:changed':
     void api.getSessions().then(setSessions).catch(console.error);
     break;
   case 'session:updated': {
     const sessionId = event.payload.sessionId as string;
     // Only re-fetch the selected session — avoids loading all sessions on every file write
     if (sessionId === selectedSessionId) {
       void api.getSession(sessionId).then(d => setSessionData(sessionId, d)).catch(console.error);
     }
     break;
   }
   ```

3. Add `useSessionData` hook:
   ```typescript
   export function useSessionData(): SessionData | null {
     return useDashboardStore(s => {
       const id = s.selectedSessionId;
       return id ? (s.sessionData.get(id) ?? null) : null;
     });
   }
   ```

**Pattern to follow**: `hooks/index.ts:9-135`

**Status**: PENDING

---

**Batch 2 Verification**:
- All 3 files modified at stated paths
- `setSessionData` creates a new Map (immutability preserved)
- `useSessionData` exported and callable from views
- Auto-select logic in `useInitialData` handles empty sessions array gracefully
- code-logic-reviewer approved

---

## Batch 3: Frontend UI - PENDING

**Developer**: frontend-developer
**Tasks**: 7 (Tasks 3.1 through 3.7) | **Dependencies**: Batch 2 must be COMPLETE (store slice and hooks available)

### Task 3.1: Create SessionPicker component - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/components/SessionPicker.tsx`
**Action**: CREATE

**What to build**:
- A `<select>` dropdown rendered in the Sidebar below the nav list
- Reads `sessions`, `selectedSessionId`, `sessionData`, `setSelectedSession`, `setSessionData` from `useDashboardStore`
- On selection change (`onSelect`):
  ```typescript
  const onSelect = (id: string) => {
    setSelectedSession(id);
    if (!sessionData.has(id)) {
      void api.getSession(id).then(d => setSessionData(id, d)).catch(console.error);
    }
  };
  ```
- Active sessions shown with a green indicator (e.g. green dot or "(active)" label in the option text)
- If 2 or more sessions are active, show a badge in the component title with the active count
- If `sessions` is empty, render nothing (return null)

**Status**: PENDING

---

### Task 3.2: Create Sessions view - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/views/Sessions.tsx`
**Action**: CREATE

**What to build**:
- Renders a card grid — one card per session — using `useDashboardStore(s => s.sessions)`
- Session list is already sorted newest first (handled server-side by `SessionStore.getSessions()`)
- Active session cards: show live `loopStatus`, worker count (from `sessionData.get(id)?.state?.activeWorkers?.length`), elapsed time calculated from `summary.started`
- Historical session cards: show final `loopStatus`, task count from `summary.taskCount`, `summary.started`
- If `sessions` is empty, show an empty state message: "No sessions recorded yet."
- No pagination needed

**Status**: PENDING

---

### Task 3.3: Add Sessions nav item and render SessionPicker in Sidebar - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/components/Sidebar.tsx`
**Action**: MODIFY

**Changes**:
1. Add a Sessions entry to the `NAV_ITEMS` array (see `Sidebar.tsx:11-21` for pattern): `{ path: '/sessions', label: 'Sessions', icon: '...' }` — choose an appropriate icon
2. Import and render `<SessionPicker />` below the nav list

**Status**: PENDING

---

### Task 3.4: Update Workers view to read session-scoped state - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/views/Workers.tsx`
**Action**: MODIFY

**Change**:
Replace the direct `useDashboardStore` state read with `useSessionData`:

```typescript
// Before:
const state = useDashboardStore((s) => s.state);
const workers = state?.activeWorkers ?? [];

// After:
const sessionData = useSessionData();
const workers = sessionData?.state?.activeWorkers ?? [];
```

Apply the same pattern to any other fields read from `state` in this file.

**Status**: PENDING

---

### Task 3.5: Update SessionLog view to read session-scoped log with Source column - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/views/SessionLog.tsx`
**Action**: MODIFY

**Changes**:
1. Replace `useDashboardStore(s => s.state)` with `useSessionData()` hook
2. Read log entries from `sessionData?.log ?? []` — these are `{timestamp, source, event}` objects (3 fields)
3. Update the table render to show the Source column: `| Timestamp | Source | Event |`
   - The existing render likely only shows 2 columns (timestamp + event); add the middle Source column

**Status**: PENDING

---

### Task 3.6: Update CostDashboard view to read session-scoped state - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/views/CostDashboard.tsx`
**Action**: MODIFY

**Change**:
Replace `useDashboardStore(s => s.state)` with `useSessionData()` and read cost data from `sessionData?.state` scoped to the selected session. Apply the same pattern as Tasks 3.4 and 3.5.

**Status**: PENDING

---

### Task 3.7: Add /sessions route to App.tsx - PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-web/src/App.tsx`
**Action**: MODIFY

**Change**:
Import `Sessions` view and add route (see `App.tsx:83-96` for the existing route pattern):
```typescript
<Route path="/sessions" element={wrap('Sessions', <Sessions />)} />
```

**Status**: PENDING

---

**Batch 3 Verification**:
- All 7 files exist at stated paths (2 new + 5 modified)
- `SessionPicker` handles empty sessions array (returns null)
- `SessionLog` renders 3-column table including Source column
- `Workers`, `SessionLog`, `CostDashboard` all use `useSessionData()` — not raw `state`
- `/sessions` route registered in `App.tsx`
- code-logic-reviewer approved
