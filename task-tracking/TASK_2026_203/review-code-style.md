# Code Style Review - TASK_2026_203

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 5/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Blocking Issues | 4                                    |
| Serious Issues  | 5                                    |
| Minor Issues    | 4                                    |
| Files Reviewed  | 11                                   |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `heartbeatStatusMap` computed signal recreates a `Map` on every invocation
(`apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:70`).
Because the signal is read twice in the template (once in `@for` for active sessions,
once would be needed for recent), any future addition of a second iteration loop will
call it twice per change-detection cycle, building two identical Maps per tick. The
existing `truncatedActivities` computed has the same problem at line 98. These are
O(n) allocations on every 30-second `now` tick.

The `closeStaleSession` method in `cortex.service.ts` opens the DB in write mode but
never uses a transaction. At line 226-232, the method iterates `staleSessions` and
calls `updateStmt.run()` in a loop. A crash mid-loop leaves some sessions stopped and
others still marked `running`, creating the exact inconsistency the task is trying to
prevent.

### 2. What would confuse a new team member?

`api.service.ts` declares two private fields `base` and `cortexBase` that resolve to
the same value (`${environment.apiUrl}/api`) at lines 94-95. A new developer seeing
`cortexBase` will wonder if it points to a different service. It does not — it is dead
naming that signals a future split that may never arrive.

`sessions-panel.component.ts` calls `this.loadSessions()` and
`this.subscribeToSessionUpdates()` inside the constructor (lines 51-52), yet also
starts two `interval()` pipes in the same constructor. The Angular convention is that
side effects belong in `ngOnInit`. The constructor-based subscription pattern diverges
from every other component in this codebase.

The `closeStaleSession` method name in `cortex.service.ts` is singular but it closes
multiple sessions — the return type confirms this with `closed_sessions: number`. The
controller exposes the same singular name. The task spec names the tool
`close_stale_sessions` (plural). This naming inconsistency will cause confusion when
searching for the implementation.

### 3. What's the hidden complexity cost?

`heartbeatStatusMap` and `truncatedActivities` both spread two signal arrays and
iterate the combined result on every `now` tick (every 30 seconds). With 50 sessions
these are cheap; with 500 they are not. More importantly, since `now` ticks even when
the panel is not visible (no route guard stops the interval), the Maps are rebuilt
while the component is off-screen.

`sessions-panel.component.ts:60-63` fires `closeStaleSession` every 5 minutes without
surfacing errors (the `catchError(() => EMPTY)` is correct but there is no logging).
If the backend is intermittently unreliable, these silent failures accumulate — and
since `close_stale_sessions` is the only cleanup mechanism, ghost sessions persist
indefinitely without anyone knowing the endpoint is failing.

### 4. What pattern inconsistencies exist?

The `api.types.ts` file declares all `Cortex*` interfaces without `readonly`
modifiers on their fields (lines 410–552), while every other domain interface in the
same file (`TaskRecord`, `TaskDefinition`, `PlanPhase`, etc.) uses `readonly` on all
fields. This is not stylistic — the project standard is explicit `readonly` on all
API-response types to prevent accidental mutation. These 13 interfaces break that
invariant.

`sessions-panel.model.ts` marks `lastHeartbeat` as `readonly lastHeartbeat?: string | null`
— optional AND nullable. Every other field in the file is `readonly field: T` (never
optional). The double-optional (`? | null`) is unusual; `string | null` alone would be
sufficient since undefined-vs-null is not a meaningful distinction here.

`sessions-panel.component.ts:98` declares `public truncatedActivities = computed(...)` without
`readonly`. All other `computed()` signals on the class (e.g. `heartbeatStatusMap` at
line 70) are declared `public readonly`. One is inconsistent.

`dashboard.controller.ts:245` names the method `closeStaleSession` (singular) while
the route summary says "Close stale sessions" (plural) and the service method uses the
same singular name. The MCP tool and the task spec both use plural. The singular name
leaks through the entire stack.

### 5. What would I do differently?

- Combine `heartbeatStatusMap` and `truncatedActivities` into a single `computed()`
  called `sessionDisplayData` that returns a `Map<string, { heartbeat, activity }>` —
  one O(n) pass instead of two.
- Move the constructor body (loading + subscriptions + intervals) to `ngOnInit` to
  match every other component in the project.
- Fix `closeStaleSession` → `closeStaleSessions` throughout the stack for consistency
  with the MCP tool name.
- Add `readonly` to all `Cortex*` interface fields in `api.types.ts`.
- Wrap the stale-session update loop in `db.transaction()` in `cortex.service.ts`.

---

## Blocking Issues

### Issue 1: Missing `readonly` on all Cortex* interfaces in api.types.ts

- **File**: `apps/dashboard/src/app/models/api.types.ts:410–552`
- **Problem**: All 13 `Cortex*` interfaces (`CortexTask`, `CortexSession`,
  `CortexWorker`, etc.) declare their fields without `readonly`. Every other API
  response interface in the same file uses `readonly` uniformly (`TaskRecord`,
  `SessionSummary`, `GraphNode`, etc.).
- **Impact**: The inconsistency violates the project's own convention established
  across 30+ interfaces in this file. Any component can accidentally mutate these
  objects. Future code that patches a `CortexSession` field locally (e.g. to show an
  optimistic update) will not get a type error.
- **Fix**: Add `readonly` to every field in every `Cortex*` interface. The backend
  `cortex.types.ts` already uses non-readonly fields (it is a DB layer type) — the
  frontend copy should add `readonly` since it is always a read-only API response.

### Issue 2: `truncatedActivities` missing `readonly` modifier

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:98`
- **Problem**: `public truncatedActivities = computed(...)` lacks `readonly`. Every
  other `computed()` and `signal()` on the class is `public readonly`. This is not
  just a style issue — without `readonly`, the signal reference itself can be
  reassigned, silently breaking the template binding.
- **Impact**: A developer could write `this.truncatedActivities = someOtherComputed()`
  and Angular's change detection would not track the replacement. The template would
  silently stale.
- **Fix**: Change to `public readonly truncatedActivities = computed(...)`.

### Issue 3: `closeStaleSession` opens DB without a transaction for multi-row update

- **File**: `apps/dashboard-api/src/dashboard/cortex.service.ts:215–242`
- **Problem**: The method opens the DB in non-readonly mode but wraps the for-loop in
  no transaction. If the process crashes or the DB is locked after updating 2 of 5
  stale sessions, the remaining 3 stay `running`. The backend review lesson explicitly
  states: "Multi-step DB writes must be in a transaction — partial state is
  unrecoverable."
- **Impact**: Ghost sessions persist after a crash mid-cleanup, defeating the entire
  purpose of the heartbeat lifecycle task.
- **Fix**: Wrap the for-loop in `db.transaction(() => { for (...) { ... } })()`.

### Issue 4: Hardcoded fallback color values in SCSS

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.scss:252–261`
- **Problem**: The `.session-heartbeat` block and its modifier classes use hardcoded
  hex fallbacks inline with CSS variables:
  ```scss
  color: var(--text-muted, #8b949e);
  // ...
  color: var(--color-warning, #d29922);
  // ...
  color: var(--color-danger, #f85149);
  ```
  The project anti-pattern rule states: "Never use hardcoded hex/rgba colors — use CSS
  variable tokens." The fallback values `#8b949e`, `#d29922`, and `#f85149` are
  hardcoded hex. All other classes in this file use pure `var(--token)` without
  fallbacks.
- **Impact**: If the theme changes these tokens, the heartbeat indicator will show the
  wrong color because the fallback is baked into the component rather than the theme
  file.
- **Fix**: Remove the fallback hex values. Use `var(--text-muted)`, `var(--warning)`,
  and `var(--error)` which already exist in the design token system (as proven by their
  usage at lines 110–128 of the same file).

---

## Serious Issues

### Issue 1: `base` and `cortexBase` are identical — dead naming

- **File**: `apps/dashboard/src/app/services/api.service.ts:94–95`
- **Problem**: Both `this.base` and `this.cortexBase` resolve to `${environment.apiUrl}/api`.
  They are never different values. The name `cortexBase` implies a distinct service
  origin, but there is none.
- **Tradeoff**: Every cortex method uses `this.cortexBase` which is a deceptive name
  that will confuse any future developer who sees it and wonders why the endpoints are
  split.
- **Recommendation**: Remove `cortexBase` and replace all its usages with `this.base`.
  If a real split ever happens, it can be introduced at that point.

### Issue 2: `HealthResponse` interface defined inside `api.service.ts`

- **File**: `apps/dashboard/src/app/services/api.service.ts:6–10`
- **Problem**: `interface HealthResponse { ... }` is declared at the top of the service
  file, not in a `*.model.ts` or `api.types.ts` file. The project anti-pattern rule
  states: "Interfaces and types must be defined at module scope in `*.model.ts` files —
  never inside component or function bodies." A service file is not a model file.
- **Tradeoff**: Small thing today; if `HealthResponse` ever grows (e.g. adds a
  `version` field), it will need to move and any import site must be updated.
- **Recommendation**: Move `HealthResponse` to `api.types.ts` and import it.

### Issue 3: Constructor-based subscription diverges from project convention

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:50–63`
- **Problem**: `loadSessions()`, `subscribeToSessionUpdates()`, and two `interval()`
  pipes are all started in the constructor body. Every other component in the project
  (`project.component.ts`, etc.) keeps the constructor minimal and moves side effects
  to `ngOnInit`. Placing subscriptions in the constructor means they fire before
  Angular's DI tree is fully resolved for inputs/outputs, and it complicates testing.
- **Tradeoff**: Works for this component since it has no `@Input()` signals; but
  establishes a divergent pattern for future components that copy this file.
- **Recommendation**: Move the body of the constructor (excluding field declarations)
  to `ngOnInit`. The component already imports `OnInit` indirectly via Angular; add
  `implements OnInit` explicitly.

### Issue 4: `heartbeatStatusMap` rebuilds a Map on every `now()` tick for ALL sessions (including non-running)

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:70–96`
- **Problem**: The computed loops over `[...this.sessions(), ...this.recentSessions()]`
  but immediately `continue`s for non-running sessions. The spread array is built on
  every tick anyway. More critically, `recentSessions` are never `running` by
  construction (lines 120-121 split them), so iterating `recentSessions` in
  `heartbeatStatusMap` is wasted work every 30 seconds.
- **Recommendation**: Only iterate `this.sessions()` in `heartbeatStatusMap`, since
  only running sessions (which live in `sessions()`) ever display heartbeat UI.

### Issue 5: `closeStaleSession` / `closeStaleSessions` naming inconsistency across the stack

- **File**: `cortex.service.ts:215`, `dashboard.controller.ts:245`, `api.service.ts:169`
- **Problem**: Method is named `closeStaleSession` (singular) in all three layers, but
  the return type is `{ closed_sessions: number }` and the operation closes N sessions.
  The MCP tool it mirrors is named `close_stale_sessions` (plural). The controller
  summary uses plural: "Close stale sessions." The return payload key uses plural:
  `closed_sessions`.
- **Recommendation**: Rename to `closeStaleSessions` (plural) in service, controller,
  and API service for consistency with the underlying tool name and the payload shape.

---

## Minor Issues

1. **`sessions-panel.model.ts:13`**: `lastHeartbeat?: string | null` uses double-optional.
   `string | null` (without `?`) is sufficient since `undefined` has no separate
   semantic meaning here. The optional `?` makes consumers write `session.lastHeartbeat
   !== undefined && session.lastHeartbeat !== null` guards unnecessarily.

2. **`sessions-panel.component.scss:252`**: Gap and font-size use raw pixel values (`gap:
   4px; font-size: 11px`) while all other rules in the file use `rem` units. Mixed
   units create inconsistency in scaling behavior.

3. **`cortex-queries-task.ts:102`**: String concatenation for SQL conditions
   (`' WHERE ' + conditions.join(' AND ')`) is correct but inconsistent with the rest of
   the file's template literal style. Minor — no functional impact.

4. **`api.service.ts:302`**: `startAutoPilot(req: StartAutoPilotRequest = {})` uses
   `{}` as a default. `StartAutoPilotRequest` has no required fields, so this works,
   but the type explicitly marks `taskIds` and `options` as optional — a default of `{}`
   is redundant given the optional fields. Minor readability noise.

---

## File-by-File Analysis

### session-lifecycle.md

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: The document is well-structured. The new steps (3a zombie flush, ZOMBIE
FLUSH log row) integrate cleanly with the existing startup sequence numbering. The
best-effort semantics (continue on failure) are correctly specified.

**Specific Concerns**:
1. Step 3 and Step 3a both carry the number "3" in the startup sequence table — the
   lettered suffix is non-standard. Downstream tooling that parses steps by number
   might get confused.

---

### cortex.types.ts

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean type definitions. `last_heartbeat: string | null` correctly models
the nullable DB column. The file is well-organized with section headers.

**Specific Concerns**:
1. `CortexSession.source` and `CortexSession.loop_status` are bare `string`, not typed
   string unions. These fields have known valid values (`auto-pilot`, `running`,
   `stopped`, etc.). While adding unions here would be a broader refactor, it is a type
   precision gap that future reviewers will note.

---

### cortex-queries-task.ts

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Clean mapper functions. `mapSession` correctly passes `last_heartbeat`
through. The `SESSION_COLS` constant at line 24 correctly includes `last_heartbeat`.

**Specific Concerns**:
1. Line 102: `' WHERE ' + conditions.join(' AND ')` vs template literals used elsewhere.
   Minor inconsistency.

---

### cortex.service.ts

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

**Analysis**: The new `closeStaleSession` method introduces a multi-row update without
a transaction (Blocking Issue 3). Method name is singular vs the plural nature of the
operation (Serious Issue 5). The existing methods are well-structured — explicit null
handling, logger.error on failures, finally blocks closing the DB.

**Specific Concerns**:
1. Line 219: Opens DB without `readonly: true`, which is correct for a write operation
   — but unlike all other methods in this service which use `openDb()` (readonly mode),
   `closeStaleSession` bypasses `openDb()` and creates a write connection directly. This
   asymmetry means the logging path in `openDb()` is bypassed. Worth a comment
   explaining why.
2. Line 222: `cutoffTime` is an ISO string. SQLite stores `last_heartbeat` as text.
   The comparison `last_heartbeat < ?` relies on ISO string lexicographic ordering,
   which only works if the format is consistent. If any heartbeat was stored as a
   non-ISO format, the comparison silently fails. Worth a comment or assertion.

---

### dashboard.controller.ts

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: The `closeStaleSession` endpoint is correctly decorated with `@Post`,
`@HttpCode(HttpStatus.OK)`, and Swagger annotations. The TTL validation at line 249
(clamp to 1440, reject NaN) is solid defensive programming.

**Specific Concerns**:
1. Line 245: Method name `closeStaleSession` should be `closeStaleSessions` (Serious
   Issue 5).
2. Line 262: `getSessionDetail` has an inline return type annotation that is 120+
   characters on one line. This was pre-existing; documenting here because the new
   `closeStaleSession` method adds visual bulk to an already long file (527 lines —
   approaching the 500-line warning threshold for service files).

---

### api.types.ts

**Score**: 4/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The addition of `last_heartbeat: string | null` to `CortexSession` is
correct and consistent with the backend type. However, the entire `Cortex*` section
(lines 410–552) lacks `readonly` on all fields, violating the project's own convention
established by every other interface in the same file (Blocking Issue 1). The `Logs
types` and `Task creation API types` sections also lack `readonly` — these were likely
pre-existing, but the current task touched this file and provides an opportunity to
normalize.

**Specific Concerns**:
1. Lines 410–552: 13 interfaces without `readonly` modifiers.
2. Lines 556–616 (Logs + Task creation types): same issue — pre-existing but in scope
   since this file was modified.

---

### api.service.ts

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: The new `closeStaleSession` method is correctly implemented — uses
`HttpParams`, passes `null` as body for the POST (correct for no-body endpoints),
handles optional TTL. The import ordering is mostly correct. The `HealthResponse`
interface inside the service file is a pre-existing violation now codified.

**Specific Concerns**:
1. Lines 94–95: Dead `cortexBase` alias (Serious Issue 1).
2. Lines 6–10: `HealthResponse` defined in service (Serious Issue 2).
3. Line 169: Method name `closeStaleSession` should be `closeStaleSessions` (Serious
   Issue 5, shared root cause).

---

### sessions-panel.model.ts

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Minimal and focused. The addition of `lastHeartbeat` is correctly typed
as nullable. The `SessionPhase` and `SessionStatus` types are proper string unions.

**Specific Concerns**:
1. Line 13: `lastHeartbeat?: string | null` — double-optional (Minor Issue 1).

---

### sessions-panel.component.ts

**Score**: 5/10
**Issues Found**: 2 blocking, 2 serious, 1 minor

**Analysis**: The heartbeat logic is structurally sound — `computed()` signals react to
`now()` correctly, threshold logic at 2/10 minutes matches the spec. However, the
`readonly` omission on `truncatedActivities` (Blocking Issue 2), inefficient Map
building over non-running sessions (Serious Issue 4), constructor-based subscriptions
(Serious Issue 3), and the SCSS hardcoded hex values (Blocking Issue 4, in the paired
SCSS file) collectively bring the score down.

**Specific Concerns**:
1. Line 98: `truncatedActivities` missing `readonly` (Blocking Issue 2).
2. Lines 50–63: All side effects in constructor (Serious Issue 3).
3. Lines 70–96: `heartbeatStatusMap` spreads `recentSessions` unnecessarily (Serious
   Issue 4).
4. Line 83: The `ageMs < 0` case (clock skew — future heartbeat timestamp) sets the
   label to `'just now'` with empty cssClass. This is reasonable but there is no guard
   to prevent the computed from producing negative `ageMinutes` which would render
   labels like `-1m ago` if the `ageMs < 0` check is ever removed.

---

### sessions-panel.component.html

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Correct use of `@if`/`@for` block syntax throughout. Accessibility
attributes (`role`, `tabindex`, `aria-label`) are present. The `@if (heartbeatStatusMap().get(...); as hbStatus)` pattern at line 43 is correct Angular 17+ idiom for inline variable binding.

**Specific Concerns**:
1. Line 37: `session.startedAt.slice(11, 16)` is a method call in the template. Per
   project anti-pattern: "Template expressions must not call methods — use `computed()`
   signals or precomputed properties." `.slice()` is a String method call and fires on
   every change detection cycle. Precompute the start-time display string in the
   `truncatedActivities` computed or a separate `sessionDisplayMap` computed.

---

### sessions-panel.component.scss

**Score**: 5/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The majority of the file is well-structured — pure CSS variable tokens,
consistent `rem` units, BEM-adjacent class naming. The heartbeat section at lines
248–266 is the outlier, introducing three hardcoded hex fallbacks (Blocking Issue 4)
and mixing `px` units (Minor Issue 2).

---

## Pattern Compliance

| Pattern                    | Status | Concern                                                             |
| -------------------------- | ------ | ------------------------------------------------------------------- |
| Signal-based state         | PASS   | Correct use of `signal()` and `computed()`                         |
| `readonly` on signals      | FAIL   | `truncatedActivities` missing `readonly`                            |
| `readonly` on API types    | FAIL   | All 13 `Cortex*` interfaces in `api.types.ts` lack `readonly`      |
| CSS variable tokens only   | FAIL   | Three hardcoded hex fallbacks in `.session-heartbeat` SCSS          |
| No method calls in template| FAIL   | `session.startedAt.slice(11, 16)` fires every change detection cycle |
| `OnPush` change detection  | PASS   | Present on the component                                            |
| `inject()` for DI          | PASS   | Used throughout                                                     |
| `@if`/`@for` block syntax  | PASS   | No `*ngIf`/`*ngFor` used                                           |
| DB writes in transactions  | FAIL   | `closeStaleSession` multi-row update has no transaction              |
| Import ordering            | PASS   | Angular core → RxJS → local — correct                              |
| Explicit access modifiers  | PASS   | All class members have explicit modifiers                           |

---

## Technical Debt Assessment

**Introduced**:
- `cortexBase` alias that duplicates `base` in `api.service.ts` — small but sticky
  (will persist until someone hits the confusion and cleans it up).
- Mixed `readonly`/non-`readonly` convention in `api.types.ts` — every future
  `Cortex*` type added by new developers will follow the wrong pattern.
- Non-transactional multi-row update in `cortex.service.ts` — operational risk that
  compounds if the close-stale endpoint is called frequently under load.

**Mitigated**:
- Heartbeat display uses `computed()` correctly, preventing the method-call-in-template
  anti-pattern for most of the new UI.
- `takeUntilDestroyed` is used correctly on all subscriptions — no subscription leaks.

**Net Impact**: Slight increase. The `readonly` gap and SCSS fallbacks are violations
of rules that already exist and will need a follow-up cleanup pass.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: Four blocking issues across three files (missing `readonly` on computed
signal, missing `readonly` on 13 API interfaces, non-transactional multi-row DB write,
hardcoded hex color fallbacks) must be fixed before merge. None are architectural; all
are one-line fixes.

## What Excellence Would Look Like

A 9/10 implementation would:
- Add `readonly` to all 13 `Cortex*` interfaces on the first touch of `api.types.ts`
  (the rule was already documented in the anti-patterns file).
- Use `rem` units consistently in the heartbeat SCSS block.
- Consolidate `heartbeatStatusMap` and `truncatedActivities` into a single
  `sessionDisplayData` computed that makes one pass over `sessions()` only (not the
  combined active+recent array).
- Extract the `startedAt.slice(11, 16)` display computation into the combined
  `sessionDisplayData` computed.
- Rename the method to `closeStaleSessions` (plural) from the start.
- Wrap the multi-row DB update in a transaction.
