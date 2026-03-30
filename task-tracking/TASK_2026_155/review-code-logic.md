# Code Logic Review — TASK_2026_155

## Review Summary

| Metric              | Value                                      |
| ------------------- | ------------------------------------------ |
| Overall Score       | 6/10                                       |
| Assessment          | NEEDS_REVISION                             |
| Critical Issues     | 2                                          |
| Serious Issues      | 3                                          |
| Moderate Issues     | 3                                          |
| Failure Modes Found | 6                                          |
| Verdict             | FAIL                                       |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`onStartAutoPilot()` sets `isAutoPilotRunning` to `true` with no way to set it back to `false`. If the real implementation (TASK_2026_156) fails to wire a stop handler, the button permanently shows "Auto-Pilot Running" after the first click. The component has no reset path, no error path, and no stop handler whatsoever. The signal is a one-way latch.

`onTaskClick()` calls `void this.router.navigate(...)` — the `void` discards the Promise. If navigation fails (route not registered, guard rejects, Angular router throws), there is zero indication to the user or developer. The navigation silently does nothing.

### 2. What user action causes unexpected behavior?

A user clicking "Start Auto-Pilot" a second time is blocked visually (button shows running state) but the click handler still fires because there is no `[disabled]` or guard. `this.isAutoPilotRunning.set(true)` is called again — harmless now, but when real logic replaces the placeholder, double-invocation will trigger two concurrent operations with no guard.

A user who applies a status filter and then switches to Kanban view will see correctly filtered columns (because `kanbanColumns` derives from `filteredTasks`). However, a `CANCELLED` task can appear in the list view when the "All" filter is active, but the Kanban view has no CANCELLED column. If such a task exists in data, it vanishes silently in Kanban with no explanation to the user. The 12 mock tasks happen not to have a CANCELLED task — this gap is invisible in current test data.

### 3. What data makes this produce wrong results?

Any task with `status === 'CANCELLED'` in real data will:
- Render correctly in list view (status badge, row styling) because `statusClassMap` and `statusLabelMap` both include `CANCELLED`.
- Silently disappear from Kanban view because `KANBAN_COLUMNS` excludes `'CANCELLED'` — and no "hidden tasks" indicator exists.
- Still be counted in header stats only if it matches a filter. The `runningCount` is unaffected, but a user expecting to see all tasks in Kanban will see fewer than in list view without explanation.

A task where `sessionId` is an empty string `""` (not `null`) would pass the `task.sessionId` truthy check, render `task.sessionId.slice(-16)`, display a zero-length or garbage string, and make the row appear clickable (since `task.sessionId` is truthy). Clicking would call `router.navigate(['/session', ''])`. The `QueueTask` interface types `sessionId` as `string | null` but does not exclude empty string at the type level.

### 4. What happens when dependencies fail?

`onTaskClick` navigates to `/session/:sessionId` — this route does not exist yet (acknowledged in handoff). If navigation is attempted (user clicks an IN_PROGRESS task), Angular Router emits a NavigationError. The component has no error handler, no `NavigationError` subscription, and no user feedback. The URL in the browser address bar may flicker to the target and snap back, with the user confused about what happened.

The component imports `MOCK_QUEUE_TASKS` at module initialization time. There is no dynamic data loading so there are no async failures — but this also means there is no path to introduce error handling later without architectural changes. Switching to real API calls will require a full refactor of the state model.

### 5. What's missing that the requirements didn't mention?

The requirement says "Clicking a non-running task shows task details" (acceptance criterion item 5 in task.md). This is NOT implemented. `onTaskClick()` only navigates for `IN_PROGRESS` tasks with a sessionId — for all other tasks, the handler returns without any action. No detail panel, no navigation, no stub, no comment. This is a missing requirement, not a deferred one.

The "Start Auto-Pilot" button has no stop action. The button transitions to a "running" visual state but there is no way for the user to stop Auto-Pilot from this view. The task spec does not mention a stop action, but any user who starts auto-pilot will immediately ask "how do I stop it?" This is a missing implicit requirement that the spec failed to surface.

There is no navigation link from the sidebar or any existing view to `/project`. The route is registered, but if no nav item exists, users cannot reach this page through normal navigation.

---

## Failure Mode Analysis

### Failure Mode 1: One-Way Auto-Pilot Latch

- **Trigger**: User clicks "Start Auto-Pilot"
- **Symptoms**: Button permanently shows "Auto-Pilot Running" for the lifetime of the component instance. Navigating away and back resets it (component is re-created), which creates inconsistency.
- **Impact**: When TASK_2026_156 wires real logic, the button will show running state even if the start call fails. No stop path exists.
- **Current Handling**: `isAutoPilotRunning.set(true)` only, no false path anywhere in the component.
- **Recommendation**: Add a `disabled` attribute or guard before TASK_2026_156 integration. At minimum, comment the stop path explicitly.

### Failure Mode 2: Silent Navigation Failure on Non-Existent Route

- **Trigger**: User clicks any IN_PROGRESS task row
- **Symptoms**: Nothing happens visibly; URL may briefly change and revert; no error message shown
- **Impact**: Users assume the click did nothing or the feature is broken
- **Current Handling**: `void this.router.navigate(...)` discards the result Promise entirely
- **Recommendation**: Catch the navigation Promise and display a toast or console.warn at minimum; or disable click interaction until the session route exists

### Failure Mode 3: CANCELLED Tasks Silently Drop from Kanban

- **Trigger**: Any task with `status === 'CANCELLED'` exists in the data
- **Symptoms**: Task visible in list view, invisible in Kanban with no indicator
- **Impact**: Users believe the Kanban shows all tasks when it shows fewer; silent data display gap
- **Current Handling**: `KANBAN_COLUMNS` intentionally excludes CANCELLED (per handoff decision), but no "N tasks hidden" indicator exists
- **Recommendation**: Add a footer count to the Kanban view like "1 cancelled task not shown" when CANCELLED tasks exist and the current filter would include them

### Failure Mode 4: Missing Non-Running Task Click Behavior

- **Trigger**: User clicks any task that is not IN_PROGRESS
- **Symptoms**: Nothing happens — no detail panel, no navigation, no visual feedback
- **Impact**: Violates the stated acceptance criterion: "Clicking a non-running task shows task details"
- **Current Handling**: `onTaskClick` silently returns without any action for non-IN_PROGRESS tasks
- **Recommendation**: This is an unmet acceptance criterion and must be addressed before marking COMPLETE

### Failure Mode 5: Empty String SessionId Bypasses Null Guard

- **Trigger**: `sessionId: ""` in real API data
- **Symptoms**: Row renders as clickable, navigate is called with empty ID, session route receives empty param
- **Impact**: Incorrect navigation, potential backend 404 or crash
- **Current Handling**: Guard is `task.sessionId` (truthy) — empty string is falsy in JS, so this specific case actually IS guarded; however `task.sessionId.slice(-16)` in the template renders an empty string visually, which may confuse users (session ID column shows blank for a "running" task that has an empty sessionId). Real concern is defensive display.
- **Recommendation**: Normalize empty string to null at the data boundary when real API integration happens.

### Failure Mode 6: Auto-Pilot Button Allows Repeated Clicks

- **Trigger**: User clicks Start Auto-Pilot rapidly before visual state updates
- **Symptoms**: Multiple invocations of `onStartAutoPilot()` before `isAutoPilotRunning` signal propagates
- **Impact**: With current mock code this is harmless; with real async logic in TASK_2026_156, this will trigger duplicate operations
- **Current Handling**: No `[disabled]` binding, no debounce, no guard flag
- **Recommendation**: Add `[disabled]="isAutoPilotRunning()"` to the button now, before TASK_2026_156 wires real logic

---

## Critical Issues

### Issue 1: Unmet Acceptance Criterion — Non-Running Task Click

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:134-138`
- **Scenario**: User clicks any task that is CREATED, IMPLEMENTED, IN_REVIEW, COMPLETE, FAILED, BLOCKED, or CANCELLED
- **Impact**: The acceptance criterion explicitly requires "Clicking a non-running task shows task details." This is not implemented. The handler returns silently with zero user feedback.
- **Evidence**: `onTaskClick` only branches on `task.status === 'IN_PROGRESS' && task.sessionId`. All other tasks hit no code path.
- **Fix**: Either implement stub navigation to a task detail route (even a 404 is better than silence), or document this as explicitly out of scope and remove it from the acceptance criteria.

### Issue 2: `void` Discards Router Navigation Result

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:136`
- **Scenario**: Navigation to `/session/:id` fails (route does not exist, router guard rejects, any Angular Router error)
- **Impact**: Silent failure — user gets no feedback, developer gets no error surfaced to any observable handler
- **Evidence**: `void this.router.navigate(['/session', task.sessionId]);` — the boolean Promise is explicitly discarded
- **Fix**: Replace with `.catch()` or a `.then(success => { if (!success) { /* feedback */ } })` at minimum

---

## Serious Issues

### Issue 3: Auto-Pilot Button Has No Stop Path and No Disabled Guard

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:140-143` and `project.component.html:15-29`
- **Scenario**: User clicks Start Auto-Pilot; button enters "running" state; user clicks again
- **Impact**: Double-invocation risk when real logic is wired in TASK_2026_156. No stop action exists anywhere in the component.
- **Fix**: Add `[disabled]="isAutoPilotRunning()"` to the button before TASK_2026_156 integration. Create a `onStopAutoPilot()` stub even if unimplemented.

### Issue 4: CANCELLED Tasks Silently Drop in Kanban Without Indication

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:21-29` (`KANBAN_COLUMNS`)
- **Scenario**: Real data contains tasks with `status === 'CANCELLED'`
- **Impact**: Users cannot reconcile list view count vs Kanban card count. Silent data loss in the board view.
- **Fix**: Add a "N tasks not shown (Cancelled)" footer to the Kanban board when `filteredTasks().some(t => t.status === 'CANCELLED')` is true.

### Issue 5: Template HTML (219 lines) Violates Component Size Guidelines

- **File**: `apps/dashboard/src/app/views/project/project.component.html`
- **Scenario**: Every Angular change detection cycle
- **Impact**: The project guidelines specify max 150 lines for components (CLAUDE.md review-general.md). At 219 lines, this template is 46% over the limit. The list view and kanban view are independent concerns that could be split into `project-list.component.html` and `project-kanban.component.html`. This will become a larger violation when real data rows and interaction states are added in follow-on tasks.
- **Fix**: Extract list view and kanban view into child component templates. The parent template becomes a ~30-line view-mode switcher.

---

## Moderate Issues

### Issue 6: `priorityClassMap` Uses `Record<string, string>` Instead of Typed Key

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:101`
- **Scenario**: A task with a priority value not in the map (typo, new value) produces `undefined` from the map lookup, and `[ngClass]="undefined"` silently applies no class — the priority badge renders with no color
- **Impact**: Invisible rendering degradation; no TypeScript error because the key is `string`
- **Evidence**: `public readonly priorityClassMap: Record<string, string>` vs `Record<QueueTaskPriority, string>` which would enforce exhaustiveness
- **Fix**: Change to `Record<QueueTaskPriority, string>` to enforce compile-time exhaustiveness

### Issue 7: `onSearchInput` Uses `as HTMLInputElement` Type Assertion

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:130-132`
- **Scenario**: Non-standard browser environments or future refactor passes a non-HTMLInputElement event target
- **Impact**: Runtime crash on `.value` access; TypeScript cannot catch this
- **Evidence**: `const target = event.target as HTMLInputElement` — anti-pattern per review-general.md ("No `as` type assertions")
- **Fix**: Use a type guard: `if (!(event.target instanceof HTMLInputElement)) return;`

### Issue 8: SCSS File at 365 Lines Violates 300-Line Anti-Pattern

- **File**: `apps/dashboard/src/app/views/project/project.component.scss`
- **Scenario**: Follow-on tasks add responsive breakpoints or state variants
- **Impact**: Already at 365 lines — 22% over the 300-line guidance. Two distinct concerns (list view styles + kanban board styles) are conflated in one file. The handoff acknowledges this but frames it as "necessary" rather than as a violation requiring a plan.
- **Fix**: Extract kanban-specific rules to `project-kanban.component.scss` when the kanban view is extracted to its own child component.

---

## Data Flow Analysis

```
User Action (click / input / button)
  |
  v
Angular Event Binding in project.component.html
  |
  v
Component Method (onTaskClick / onSearchInput / setStatusFilter / onStartAutoPilot)
  |-- onTaskClick --------------------------------------------------> void router.navigate(['/session', id])
  |     |                                                                  |
  |     |-- non-IN_PROGRESS task: SILENT RETURN (GAP 1)                   v
  |     |                                                          Angular Router
  |     |-- IN_PROGRESS, no sessionId: SILENT RETURN                      |
  |                                                                 Route not found -> NavigationError
  |                                                                 (GAP 2: not handled)
  |-- onSearchInput -> searchQuery.set(value)
  |-- setStatusFilter -> statusFilter.set(value)
  |-- onStartAutoPilot -> isAutoPilotRunning.set(true) [no stop path]
                                                         (GAP 3)
  v
Computed signals (filteredTasks, kanbanColumns, runningCount)
  |
  v
Template rendered via Angular change detection
  |
  v
User sees updated list/kanban

Gap Points Identified:
1. Non-running task clicks produce zero effect (unmet acceptance criterion)
2. Navigation failures are silently discarded
3. isAutoPilotRunning has no false path (one-way latch)
4. CANCELLED tasks silently missing from Kanban with no indicator
```

---

## Requirements Fulfillment

| Requirement                                              | Status  | Concern                                                   |
|----------------------------------------------------------|---------|-----------------------------------------------------------|
| Project page displays all tasks with status badges       | COMPLETE | All 8 statuses rendered with correct badge classes       |
| Running tasks have prominent live indicators             | COMPLETE | Pulsing dot animation, highlighted row class applied     |
| Task list supports filtering by status                   | COMPLETE | All 8 statuses + ALL filter chip rendered and wired      |
| Each task row shows ID, title, status, phase, session, activity | COMPLETE | All fields present in both list and kanban views  |
| Clicking a running task navigates to /session/:id        | PARTIAL  | Navigation fires but route does not exist; void discards error |
| "Start Auto-Pilot" button renders at top                 | PARTIAL  | Renders, but no stop path, no disabled guard             |
| Clicking a non-running task shows task details           | MISSING  | Handler silently returns for all non-IN_PROGRESS tasks   |

### Implicit Requirements NOT Addressed:
1. Stop Auto-Pilot action — any user who starts will immediately want to stop
2. CANCELLED task visibility gap in Kanban — user expects board to match list count
3. Navigation link to /project from the sidebar/nav — route is registered but unreachable through normal navigation
4. Error feedback when session navigation fails (route 404)

---

## Edge Case Analysis

| Edge Case                           | Handled | How                                        | Concern                                        |
|-------------------------------------|---------|--------------------------------------------|------------------------------------------------|
| Empty task list                     | YES     | `@if (filteredTasks().length === 0)` empty state shown | None                               |
| All tasks filtered out              | YES     | Same empty state shown                     | None                                           |
| CANCELLED task in data              | PARTIAL | List view renders it; Kanban silently omits | No count indicator on Kanban                  |
| IN_PROGRESS task with null sessionId | YES    | Guard `task.sessionId` prevents navigation | Row correctly non-clickable                   |
| Empty string sessionId              | PARTIAL | Empty string is falsy so nav guard holds, but badge renders blank session ID | Defensive display gap |
| Non-running task click              | NO      | Handler silently returns                   | Unmet acceptance criterion                     |
| Rapid Auto-Pilot button clicks      | NO      | No disabled binding, no guard              | Double-invocation risk in TASK_2026_156        |
| Search input with special regex chars | YES   | `.includes()` used, not regex — no crash   | None                                           |
| Very long task title                | NO SCSS CHECK | Template renders it; no truncation in list row | May overflow layout on narrow screens  |

---

## Integration Risk Assessment

| Integration                      | Failure Probability | Impact     | Mitigation                              |
|----------------------------------|---------------------|------------|-----------------------------------------|
| router.navigate -> /session/:id  | HIGH (route missing) | Silent UX failure | Catch Promise, add user feedback |
| TASK_2026_156 wiring Auto-Pilot  | MEDIUM               | Double invocation | Add [disabled] now before wiring      |
| Real API replacing MOCK_QUEUE_TASKS | HIGH (full refactor needed) | State architecture break | Signal model will need async wrapper |
| Kanban CANCELLED gap with real data | MEDIUM            | Silent display mismatch | Add hidden-task indicator            |

---

## What Robust Implementation Would Include

- `router.navigate(...)` result `.then()` with navigation failure handling (toast or console.warn)
- `[disabled]="isAutoPilotRunning()"` on the Start button today, before TASK_2026_156 wires async logic
- `onStopAutoPilot()` stub — even as a comment — so TASK_2026_156 has a clear extension point
- `Record<QueueTaskPriority, string>` instead of `Record<string, string>` for compile-time exhaustiveness
- `instanceof HTMLInputElement` guard instead of `as` assertion in `onSearchInput`
- A Kanban footer showing "N tasks hidden (Cancelled)" when applicable
- Child component extraction for list and kanban views to respect 150-line component limit
- Either implementation of non-running task click (detail panel or explicit navigation) or explicit removal from acceptance criteria
