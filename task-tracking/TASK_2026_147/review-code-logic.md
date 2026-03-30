# Code Logic Review — TASK_2026_147

## Review Summary

| Metric              | Value                                   |
| ------------------- | --------------------------------------- |
| Overall Score       | 6/10                                    |
| Assessment          | NEEDS_REVISION                          |
| Critical Issues     | 2                                       |
| Serious Issues      | 3                                       |
| Moderate Issues     | 2                                       |
| Failure Modes Found | 5                                       |
| Verdict             | FAIL                                    |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `[class]="getSessionStatusClass(session.status)"` binding on line 84 of the template **silently
destroys the static `class="session-status-indicator"` attribute** on the same element. Angular's
`[class]` binding replaces the entire class list, not merges it. The indicator dot will render
with no positioning/sizing styles and disappear visually. The template compiles and runs without
a single error or warning. This is a known anti-pattern in the review-lessons file (T83) and was
still introduced.

The service method `mockData.getCommandCenterData()` is a plain synchronous non-signal call wrapped
in `computed()`. Angular's `computed()` only re-executes when its reactive dependencies change. A
non-signal service call has zero reactive dependencies, so `computed()` captures the value once on
first access and never updates. If the service becomes async or reactive later, the computed wrapper
will silently serve stale data forever.

### 2. What user action causes unexpected behavior?

The task-priority badge class is generated in the template via string interpolation:
`priority-{{ task.priority.toLowerCase() }}`. With priorities like `P1-High` this produces the
class `priority-p1-high`. The SCSS defines `.priority-p1-high`, so it works for the current mock
data. However, any data value that deviates (e.g., `p1-HIGH`, `High`, `P1`, blank string) silently
produces an unmatched class and renders the badge with no color. There is no type guard or
exhaustive mapping in the component class — the string is bound raw.

The task requirement says the section header shows `"X Running"` via `activeSessionCount()`, but
this count reflects only the sessions with `status: 'running'` conceptually — yet in practice
`activeSessionCount()` is `activeSessions().length`, which counts ALL sessions including `paused`
ones. The current mock data has 2 `running` + 1 `paused` = 3 total. The badge reads "3 Running"
when only 2 are actually running. This misleads the user at a glance, which contradicts the
"one glance tells you the state" requirement.

### 3. What data makes this produce wrong results?

**`MOCK_TASK_STATUS_BREAKDOWN.total` is a manually hardcoded literal `78`** (8+5+12+3+47+2+1 = 78 —
correct for now). When mock data is updated (e.g., add a status count), the `total` field will
silently drift if the developer forgets to update it. The interface does not derive `total`
computationally from the individual fields, so there is no compile-time guarantee of correctness.

The token display logic uses `(tokens / 1000).toFixed(0)` for the K-range. For a value of `1499`
this renders `"1K"` instead of `"1.5K"` — precision is silently dropped with no comment or spec
justification. The handoff acknowledges this under "Known Risks" but it is still a user-visible
wrong result.

`recentSessions` sums are not reconciled against `totalTokens` / `totalCost`. The five recent
sessions sum to `675,000 tokens` and `$235.00`. The mock `totalTokens` is `2,400,000` and
`totalCost` is `$847.32`. The UI never shows this breakdown so it does not cause a visible
contradiction, but if a future developer adds a "sessions account for X% of total" widget the
data will look wrong.

### 4. What happens when dependencies fail?

The entire component depends on `MockDataService.getCommandCenterData()` returning a valid
`CommandCenterData` object. The method has no guard: it directly returns `MOCK_COMMAND_CENTER_DATA`.
If that constant were `undefined` (e.g., a bad export, circular-import issue at module init time)
the `computed()` chain would throw at the first `commandCenterData().taskBreakdown` access and
crash Angular change detection for the entire route, rendering a blank page with no error boundary.

Because all data is mock and synchronous there are no async dependency failure modes. This is a
non-issue for the current scope, but there is no error boundary in the component or route
definition if the service grows to be async.

### 5. What's missing that the requirements didn't mention?

**`CANCELLED` is a documented task state** (from `CLAUDE.md`: "Task states: CREATED | IN_PROGRESS |
IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED") but it is absent from
`TaskStatusKey`, `TaskStatusBreakdown`, and the stat-card grid. Any future task in CANCELLED state
will be invisible on the command center dashboard.

The requirements say "Active Sessions — count of currently running sessions." The badge reads
"X Running" but `activeSessionCount()` returns `activeSessions().length` which includes paused
sessions. The spec and the implementation disagree on what "running" means.

The `ActiveTask` interface hard-codes `status: 'IN_PROGRESS'` as a literal string union with a
single member. This means no BLOCKED or IMPLEMENTED task can appear in the active tasks list
even if the operator considers them "active." The interface is inflexible for future use.

---

## Failure Mode Analysis

### Failure Mode 1: `[class]` Replaces All Static Classes on Session Status Indicator

- **Trigger**: Angular renders the `session-status-indicator` div in the Active Sessions list.
- **Symptoms**: The status dot element has no class at all except the one `[class]` produces
  (`status-running` or `status-paused`). The `session-status-indicator` base class that provides
  `width: 8px; height: 8px; border-radius: 50%` is stripped. The dot is invisible — it has a color
  but no dimensions.
- **Impact**: The entire session status visual disappears. Users cannot distinguish running vs
  paused sessions at a glance.
- **Current Handling**: None. The binding compiles cleanly.
- **Recommendation**: Change `[class]="getSessionStatusClass(session.status)"` to
  `[ngClass]="getSessionStatusClass(session.status)"`, which merges classes instead of replacing.
  `NgClass` is already imported in `StatCardComponent`; `DashboardComponent` should import it too.

### Failure Mode 2: "X Running" Badge Counts Paused Sessions

- **Trigger**: `activeSessionCount()` returns `activeSessions().length`, which is the total of all
  sessions regardless of `status`.
- **Symptoms**: With the current mock data (2 running + 1 paused), the badge reads "3 Running"
  when the count should be 2.
- **Impact**: Core "one-glance" promise is broken. The most prominent number in the Active Sessions
  header is wrong.
- **Current Handling**: None.
- **Recommendation**: Either filter in `activeSessionCount()` to count only `status === 'running'`
  items, or change the badge label to "Active" to match the inclusive count.

### Failure Mode 3: `CANCELLED` Status Absent from Model and UI

- **Trigger**: A task enters the CANCELLED state (documented in `CLAUDE.md` as a valid state).
- **Symptoms**: The `TaskStatusKey` type does not include `'CANCELLED'`, so `TaskStatusBreakdown`
  has no `CANCELLED` field. No stat card is rendered for it. CANCELLED tasks are invisible.
- **Impact**: Dashboard silently under-counts tasks. Operators cannot see cancelled tasks at a
  glance.
- **Current Handling**: Not handled.
- **Recommendation**: Add `'CANCELLED'` to `TaskStatusKey`, add a `CANCELLED: number` field to
  `TaskStatusBreakdown`, add it to the mock constant (value 0 for now), and add a stat card for it
  in the template and a `status-cancelled` CSS class.

### Failure Mode 4: Hardcoded `total` in `TaskStatusBreakdown` Can Silently Drift

- **Trigger**: A developer updates one of the individual count fields (e.g., increments `COMPLETE`
  from 47 to 48) and forgets to update `total`.
- **Symptoms**: The "X Total" badge shows a value that no longer equals the sum of all status
  counts. The discrepancy is invisible at runtime — no assertion checks it.
- **Impact**: Operators make decisions based on a wrong total task count.
- **Current Handling**: None.
- **Recommendation**: Remove `total` from the `TaskStatusBreakdown` interface. Derive it in the
  component: `public readonly totalTasks = computed(() => { const b = this.taskBreakdown(); return
  b.CREATED + b.IN_PROGRESS + b.IMPLEMENTED + b.IN_REVIEW + b.COMPLETE + b.FAILED + b.BLOCKED; })`.

### Failure Mode 5: Per-Item Method Calls in `@for` Loop

- **Trigger**: Angular runs change detection on the Active Sessions or Active Tasks section.
- **Symptoms**: `getSessionStatusClass(session.status)` and `getStatusValueClass('CREATED')` are
  plain arrow-function properties (not `computed()` signals). Called from within `@for` loops or
  directly in the template, they execute on every change detection cycle.
- **Impact**: For stat cards, the method is called with a literal string argument so it is cheap
  and deterministic. For sessions the impact is minor at mock scale. This is a correctness/
  performance anti-pattern that violates the project's template-method rule and will matter when
  the list grows.
- **Current Handling**: None.
- **Recommendation**: Precompute a mapped array in a `computed()` signal instead of calling a
  method per item in the template. Or at minimum document why the per-item call is acceptable.

---

## Critical Issues

### Issue 1: `[class]` Binding Destroys Base CSS Class on Session Status Indicator

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.html:84`
- **Scenario**: Every render of the Active Sessions list.
- **Impact**: The status dot (the only visual signal for running vs paused) is invisible because
  its sizing/shape class is wiped.
- **Evidence**:
  ```html
  <div class="session-status-indicator" [class]="getSessionStatusClass(session.status)"></div>
  ```
  Angular's `[class]` binding replaces the entire `class` attribute. The static
  `class="session-status-indicator"` is thrown away. This is documented as a known anti-pattern in
  `.claude/review-lessons/frontend.md` (T83).
- **Fix**: Replace `[class]="..."` with `[ngClass]="..."` and import `NgClass` in the component.

### Issue 2: `CANCELLED` Task State Missing from Model, Mock Data, and UI

- **File**: `apps/dashboard/src/app/models/dashboard.model.ts:7-14`
- **Scenario**: Any task transitions to CANCELLED (a documented valid state per `CLAUDE.md`).
- **Impact**: The command center silently under-reports total task counts and hides an entire
  lifecycle state. The `total` badge will also be incorrect.
- **Evidence**: `CLAUDE.md` documents states as "CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW |
  COMPLETE | FAILED | BLOCKED | CANCELLED". `TaskStatusKey` omits `CANCELLED`. The stat grid has
  no CANCELLED card.
- **Fix**: Add `CANCELLED` to the type, interface, mock constant, template grid, and SCSS.

---

## Serious Issues

### Issue 3: "X Running" Badge Counts All Sessions Including Paused

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:43`
- **Scenario**: Any session has `status: 'paused'`. Current mock data has exactly this.
- **Impact**: Primary KPI on the Active Sessions header is wrong on the first load.
- **Evidence**: `activeSessionCount = computed(() => this.activeSessions().length)` — counts all.
  Badge template: `{{ activeSessionCount() }} Running`. With 2 running + 1 paused = "3 Running".
- **Fix**: Either filter `activeSessions().filter(s => s.status === 'running').length` for the
  count, or change the badge copy to "Active" to be truthful about what it counts.

### Issue 4: Hardcoded `total` in Mock Constant Will Silently Drift

- **File**: `apps/dashboard/src/app/services/mock-data.constants.ts` (MOCK_TASK_STATUS_BREAKDOWN)
- **Scenario**: Any developer edits individual status counts without updating `total`.
- **Impact**: The most prominent number on the dashboard ("X Total") can silently be wrong.
- **Evidence**:
  ```typescript
  export const MOCK_TASK_STATUS_BREAKDOWN: TaskStatusBreakdown = {
    CREATED: 8, IN_PROGRESS: 5, IMPLEMENTED: 12, IN_REVIEW: 3,
    COMPLETE: 47, FAILED: 2, BLOCKED: 1,
    total: 78,  // manual literal — not derived
  };
  ```
- **Fix**: Remove `total` from `TaskStatusBreakdown` and compute it in the component.

### Issue 5: `computed()` Wrapping a Non-Reactive Service Call Provides No Reactivity

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:21-23`
- **Scenario**: The service method is later changed to be stateful or async.
- **Impact**: `computed()` has zero reactive dependencies, so it evaluates exactly once and caches
  forever. Any future state update in `MockDataService` will be invisible to the component without
  the developer understanding why.
- **Evidence**:
  ```typescript
  private readonly commandCenterData = computed<CommandCenterData>(() =>
    this.mockData.getCommandCenterData(),  // plain method, not a signal read
  );
  ```
- **Fix**: For current mock usage, a plain `private readonly commandCenterData = this.mockData.getCommandCenterData()`
  is equally correct and does not create a false impression of reactivity. If reactivity is needed
  in the future, the service must expose a `Signal<CommandCenterData>`.

---

## Moderate Issues

### Issue 6: Per-Item Template Method Calls in `@for` Loops

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.html:84`
- **Description**: `getSessionStatusClass(session.status)` is an arrow-function property called
  per loop iteration inside `@for`. Per project rules (frontend.md, TASK_2026_079), per-item
  method calls should be replaced with precomputed mapped arrays in `computed()` signals.
- **Recommendation**: Precompute `sessionsWithClass = computed(() => this.activeSessions().map(s => ({ ...s, statusClass: this.getSessionStatusClass(s.status) })))` and reference `session.statusClass` in the template.

### Issue 7: Hardcoded Project Name and Client in Template

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.html:6-7`
- **Description**: The header shows `<span class="project-name">nitro-fueled</span>` and
  `<span class="project-client">local</span>` as literal text nodes — not bound to any signal,
  model, or configuration. There is no mock data constant for this, no model field, and no
  acceptance criterion requiring it. This is a cosmetic stub that gives a false impression of
  live project context.
- **Recommendation**: Either bind to a `ProjectContext` signal/service or replace with a neutral
  placeholder label that does not imply dynamic data.

---

## Data Flow Analysis

```
MockDataService.getCommandCenterData()
  └── returns MOCK_COMMAND_CENTER_DATA (constant)
        |
        v
DashboardComponent.commandCenterData (computed — non-reactive wrapping)
        |
        +── taskBreakdown (computed) ──> template stat-card grid
        |      └── total (manual literal, can drift)       [GAP: CANCELLED missing]
        |
        +── tokenCost (computed)
        |      ├── totalTokens ──> tokensDisplay (computed) ──> "2.4M" display
        |      ├── totalCost   ──> "$847.32" display
        |      └── recentSessions ──> @for session rows
        |
        +── activeSessions (computed)
        |      └── activeSessionCount = .length            [GAP: counts paused too]
        |            └── "X Running" badge                 [WRONG: should be running-only]
        |      └── @for session card
        |            └── [class] binding                   [BUG: destroys base class]
        |
        └── activeTasks (computed)
               └── activeTaskCount = .length ──> "X In Progress" badge [OK]
               └── @for task card
                     └── priority-{{ p.toLowerCase() }}   [FRAGILE: raw string interpolation]
```

### Gap Points Identified

1. `[class]` vs `[ngClass]` on session status indicator — base CSS class wiped every render.
2. `activeSessionCount` counts all sessions, badge says "Running" — metric is wrong.
3. `CANCELLED` state missing from entire data layer — invisible on the dashboard.

---

## Requirements Fulfillment

| Requirement                                                                 | Status   | Concern                                             |
| --------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| Stat cards with task counts per status (all 7 states)                       | PARTIAL  | CANCELLED state missing; 7 of 8 states shown        |
| Total task count displayed prominently                                      | COMPLETE | But `total` is a hardcoded literal, can drift       |
| Token usage summary card with total tokens and total cost                   | COMPLETE | None                                                |
| Active sessions section: count + compact list (session ID + assigned task)  | PARTIAL  | Count includes paused sessions; badge says "Running"|
| Active tasks section: count + compact list (task ID, title, status)         | COMPLETE | None                                                |
| All data from mock data constants (no real API calls)                       | COMPLETE | None                                                |
| Existing shared stat-card component reused or extended                      | COMPLETE | None                                                |
| Page responsive at common breakpoints                                       | COMPLETE | None (mobile breakpoints present)                   |

### Implicit Requirements NOT Addressed

1. `CANCELLED` is a valid project task state per `CLAUDE.md` but is entirely missing from
   the stat breakdown. Any real-world dashboard data will have cancelled tasks that disappear.
2. "Active sessions" semantically means sessions that are currently doing work. Paused sessions
   should be excluded from the "Running" count or the badge label must change.

---

## Edge Case Analysis

| Edge Case                                    | Handled | How                                           | Concern                                             |
| -------------------------------------------- | ------- | --------------------------------------------- | --------------------------------------------------- |
| `activeSessions` is empty array              | YES     | `@if (activeSessions().length === 0)` guard   | None                                                |
| `activeTasks` is empty array                 | YES     | `@if (activeTasks().length === 0)` guard       | None                                                |
| `recentSessions` is empty array              | NO      | `@for` silently renders nothing, no empty msg | Minor: "Recent Sessions" header with no rows        |
| `total` field inconsistent with sum          | NO      | No assertion or derived computation           | Silent wrong metric                                 |
| Task priority outside P0-P3 range            | NO      | Raw `toLowerCase()` interpolation             | Badge renders unstyled silently                     |
| Session status outside `running`/`paused`    | NO      | `getSessionStatusClass` returns empty string  | No visible indicator, and `[class]` bug makes dot invisible anyway |
| Token count 0                                | YES     | Fallback to `tokens.toString()`               | Correct                                             |
| Token count >= 1 billion                     | NO      | Handoff acknowledges, no fix                  | Shows "1000.0M" instead of "1.0B"                  |

---

## Integration Risk Assessment

| Integration                                | Failure Probability | Impact  | Mitigation                                |
| ------------------------------------------ | ------------------- | ------- | ----------------------------------------- |
| MockDataService -> DashboardComponent      | LOW (sync/const)    | HIGH    | If constant undefined, computed throws     |
| computed() wrapping non-signal service     | LOW (works now)     | MEDIUM  | Becomes stale when service turns reactive |
| CSS class binding `[class]` vs `[ngClass]` | CERTAIN (renders)   | HIGH    | Status indicator visually broken          |
| Session status count vs badge label        | CERTAIN (mock data) | MEDIUM  | Wrong number shown on first load           |

---

## What Robust Implementation Would Include

- `NgClass` instead of `[class]` for all conditional class bindings that coexist with static classes.
- `CANCELLED` added as the 8th status across model, mock, template, and SCSS.
- `total` derived computationally in the component, removed from the interface.
- `activeSessionCount` filtered to `status === 'running'` only, or badge renamed to "Active".
- All per-item class derivations precomputed as mapped `computed()` signals, not template method
  calls per iteration.
- Project name/client bound to a model field (even mock), not a hardcoded string literal.
- Empty state for `recentSessions` (matching the pattern used for sessions and tasks lists).
