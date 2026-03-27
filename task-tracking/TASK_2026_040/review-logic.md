# Logic Review — TASK_2026_040

## Overall Score: 5/10

## Assessment

The happy path works: the DAG layout renders, nodes are colored by status, the
critical path is highlighted, and the chain-select interaction follows the
specified click-once-to-select / click-again-to-navigate pattern. However, every
layer of the feature contains a meaningful logic defect that either produces wrong
visual output or silently fails under real data. The column-assignment algorithm
has a recursion bug that produces incorrect layouts and will stack-overflow on
graphs with back-edges. The critical-path tracer produces false positives
(highlights tasks that are not on the longest path) when multiple sink nodes
exist. Edge highlighting in a selected chain is over-inclusive, painting edges
between two separately-highlighted nodes as "chain" even when no chain edge
connects them. The tooltip position formula is wrong whenever the browser viewport
has been scrolled or the container is not at the top-left of the page. The
`isUnblocked` computation in `getGraph()` treats every task with zero resolved
dependencies (including tasks with external/unknown dependencies) as ready,
producing false READY badges. The dependency-string regex is too narrow and would
silently drop valid task references. None of these are cosmetic — each one
produces incorrect output or silent data loss against real task data.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **Edge deduplication arrives too late.** `edges.push()` inside the per-record
  loop runs before deduplication. `depsOf` is built from `resolvedDeps` which
  comes from the pre-dedup array. So `isUnblocked` is computed from duplicated
  edges (a bug in correctness would not occur here, but the intermediate `edges`
  array is already bloated when `depsOf` is populated).  More importantly: if a
  task definition lists the same dependency twice, the edge appears twice in
  `edges`, and `depsOf` will also contain duplicate entries — making the
  `isUnblocked` check call `registry.find()` twice for the same dep. No crash, but
  wasted work and potential future bugs.

- **`assignCol` visits nodes that already have a `col` set without updating their
  downstream columns.** The `visited` guard (line 40 of `graphLayout.ts`) fires
  AFTER the column update but BEFORE recursing into children. This means a node
  visited earlier via a shorter path gets its column updated correctly, but its
  children are never re-visited with the new (longer) depth. The layout
  silently places downstream nodes in wrong columns.

- **`longestFrom` in `computeCriticalPath` shares a single `visiting` Set across
  all recursive calls but passes it by reference.** The `visiting.delete(id)` on
  line 93 removes `id` from the shared set after recursion, so cycle detection
  works per call. However, the memo is populated with the result of a call that
  had a partially-mutated `visiting` set. Because the outer `for` loop on line 98
  calls `longestFrom(n.id, new Set())` with a fresh set for each root, this is
  safe at the entry point level — but recursive calls share the caller's `visiting`
  set. The result is correct for pure DAGs but produces wrong path lengths for
  graphs with convergent paths because `visiting` prevents re-entering a node that
  legitimately has two incoming paths in the same DFS traversal.

### 2. What user action causes unexpected behavior?

- **Rapid single-click on a node navigates immediately instead of showing the
  chain.** The first click sets `selectedId`. If the user clicks again quickly
  and the React state hasn't re-rendered yet (stale closure), `selectedId` is
  still `null` inside `handleNodeClick`'s closure — so the second click is treated
  as a first click rather than a navigation trigger. This is a React stale-closure
  race on a synchronous state update; in practice it only manifests with very fast
  double-clicks, but it is a documented pattern.

- **Clicking on a `<g>` element inside the SVG (e.g., a node group) bubbles to the
  outer `onClick` handler** that fires `setSelectedId(null)` (line 172,
  `DependencyGraph.tsx`). The outer handler checks `tag === 'svg' || tag === 'g'`,
  but node groups ARE `<g>` elements. The `onClick` on the node `<g>` calls
  `onNodeClick` AND the event bubbles up to clear the selection. Node clicks
  therefore always end with `selectedId` being cleared. This is a critical
  interaction bug: selecting a node is immediately undone by the parent handler.

- **Fit-to-view recomputes on every layout change** (via `useEffect` that depends on
  `layoutNodes.length`). If a WebSocket update changes a task's status (which
  doesn't change the number of nodes), `layoutNodes.length` stays the same and
  fit-to-view does NOT re-fire. But if a filter is toggled (changing node count),
  fit-to-view fires and resets the user's manual pan/zoom. Users who have zoomed
  into a specific area and then toggle a filter will find their viewport reset.

### 3. What data makes this produce wrong results?

- **Dependency string regex `TASK_\d{4}_\d{3}` uses a non-anchored match.**
  A string like `"TASK_20260_023 — some task"` (5-digit year) would match
  `TASK_2026_023` as a substring and create a phantom edge to an unrelated task.
  The regex should be anchored or use a word-boundary: `/\bTASK_\d{4}_\d{3}\b/`.

- **`taskIdSet` membership check happens AFTER regex extraction.** A malformed
  string like `"TASK_9999_999 — placeholder"` where `TASK_9999_999` does not exist
  in the registry is correctly filtered out. But a string with no TASK ID at all
  (e.g., a free-text dependency note) silently drops the dependency without any
  indication that the task has an unresolved external dependency — making
  `isUnblocked` incorrect for tasks with external-only dependencies. A task that
  says `"depends on manual QA sign-off"` has zero resolved deps and is therefore
  marked as `isUnblocked = true`, showing a green READY badge falsely.

- **Graph with a single node and no edges.** `computeCriticalPath` returns
  `new Set()` when `maxLen === 0` (line 101). A lone node with no dependencies and
  no dependents correctly has path length 0, so it is excluded from the critical
  path highlight. This is semantically correct (a lone node is its own critical
  path only if you count it), but it is surprising UX — a task that blocks nothing
  and is blocked by nothing appears as not critical even if it is the only task.
  Minor, but worth noting.

- **Multiple disconnected components.** The layout algorithm assigns each root node
  column 0, but nodes in separate components share the same row indices if they
  happen to land in the same column. Two disconnected subgraphs will stack their
  nodes on top of each other (same x, same y). The algorithm has no vertical
  offset between components.

### 4. What happens when dependencies fail?

- **`api.getGraph()` failure sets `error` state and renders an error panel, but
  `loading` is set to `false` before `error` is checked.** On first load, if the
  fetch fails, `loading = false` and `error = "…"`. On subsequent renders (e.g.,
  `lastUpdated` ticks), `fetchGraph` is called again but `setLoading(false)` fires
  in `finally`, which never sets `loading = true` before the new fetch. The user
  always sees the error panel from the first failure without any loading indicator
  on retry — they cannot tell whether a retry is in progress.

- **`lastUpdated` triggers a full re-fetch every time a WebSocket event arrives.**
  If the WebSocket fires rapidly (e.g., bulk task updates), the component fires
  multiple concurrent `api.getGraph()` calls. Responses can arrive out of order,
  and the last response to resolve wins — which may not be the most recent server
  state. There is no cancellation (no `AbortController`) and no in-flight guard.

- **If `svgContainerRef.current` is null when `fitToView` fires,** the function
  returns early without setting scale/pan. The `useEffect` hook that fires
  `fitToView` on `layoutNodes.length` change has `fitToView` in its dependencies
  via `useCallback`, which in turn depends on `layoutNodes`. If the component is
  unmounted mid-render, this fires on a null ref silently. No crash (guard at line
  69), but the view is not fitted.

### 5. What's missing that the requirements didn't mention?

- **Real-time updates (AC: "Nodes update in real-time via WebSocket") depend on
  `lastUpdated` from the store, but there is no guarantee that `lastUpdated`
  changes on every task state change.** If the store update is de-bounced or
  batched, some `task:state_changed` events may not trigger a re-fetch. The
  implementation assumes `lastUpdated` is a reliable signal — this is an
  integration assumption not verified in this code.

- **No loading state on re-fetch.** After initial load, subsequent re-fetches
  (triggered by `lastUpdated`) run silently. If the service is slow or temporarily
  unavailable, the graph shows stale data with no visual indication.

- **No retry on fetch failure.** The error state is terminal: the user must reload
  the page to try again.

- **Performance for 30+ nodes (acceptance criterion).** The `computeChain`
  function uses an O(n * e) BFS where for each dequeued node it iterates all edges
  to find neighbors. For 30 nodes with typical dependency density this is
  acceptable, but the edge iteration inside the BFS loop should use an adjacency
  map for correctness at scale. `computeCriticalPath` has a similar O(n * e)
  pattern. Neither is blocked, but the AC specifically calls out 30+ tasks.

---

## Failure Mode Analysis

### Failure Mode 1: Node click is always cleared by the parent `onClick` handler

- **Trigger**: User clicks any task node in the SVG.
- **Symptoms**: The chain highlight flashes briefly (or not at all), then
  disappears. Clicking a node never maintains a selection; clicking again never
  navigates.
- **Impact**: Critical. The core interaction of the feature (select chain, click
  again to navigate) does not function.
- **Current Handling**: The outer `div` at `DependencyGraph.tsx:170` has an
  `onClick` that clears `selectedId` when `tag === 'svg' || tag === 'g'`. Node
  groups are `<g>` elements, so every node click eventually bubbles to this
  handler and clears the selection that was just set.
- **Recommendation**: Stop propagation in `onNodeClick`, or change the outer
  handler to compare the target against `svgRef.current` / `svgContainerRef.current`
  rather than checking tag names.

### Failure Mode 2: `assignCol` produces wrong column positions for nodes with multiple incoming paths

- **Trigger**: Any task that has two or more upstream dependencies (diamond shape
  in the DAG, e.g., A->C, B->C).
- **Symptoms**: The downstream node `C` is placed in the column assigned by
  whichever parent was processed first, not the maximum column of all parents + 1.
  Edges can appear to go "backwards" (right to left) in the rendered graph.
- **Impact**: Serious. The DAG layout is a core feature and will produce
  visually incorrect results for the standard dependency pattern in this project
  (tasks that depend on multiple predecessors).
- **Current Handling**: `assignCol` updates `col.get(id)` if `depth > current`
  (line 39), which correctly updates the node's column. BUT it marks the node
  `visited` before recursing (line 41), so if the same node is reached again with
  a deeper depth, the update fires but children are not recursed with the new
  depth (line 42 is guarded by the `visited` check already having been triggered).
  Wait — re-reading carefully: the `visited` check returns early on line 40 AFTER
  the `if (depth > current) col.set(id, depth)` update. So the current node's
  column is updated, but its children are not re-recursed with the new column
  value. A node whose column is later corrected will not propagate the correction
  to its downstream nodes.
- **Recommendation**: Decouple column assignment from the cycle-guard `visited`
  set. Use a proper topological sort (Kahn's algorithm) for column assignment
  instead of the DFS approach.

### Failure Mode 3: Critical path highlights wrong nodes when multiple sources exist

- **Trigger**: Graph has multiple root nodes (zero in-degree) with different
  longest-path lengths, which is the normal case for a real project.
- **Symptoms**: The critical path trace starts from ALL nodes whose memo value
  equals `maxLen` (line 110-112), then follows the `memo.get(next) === memo.get(id) - 1`
  rule. If two separate chains both happen to have length N, every node in both
  chains is marked critical even if only one is the true bottleneck. This is
  arguably correct by the definition "longest path," but the visual result is
  surprising: half the graph lights up as "critical."
- **Impact**: Moderate. The visual signal is diluted and may mislead users.
- **Current Handling**: By design, but the behavior is not documented and exceeds
  user expectation for "highlight the bottleneck."
- **Recommendation**: When multiple chains tie for max length, either highlight only
  the first found chain, or expose a count in the UI ("2 critical paths found").

### Failure Mode 4: Tooltip position is wrong when the page is scrolled or the container is not at viewport origin

- **Trigger**: Any deployment where the dashboard is not at the very top of a
  non-scrolled viewport.
- **Symptoms**: Tooltips appear offset from the hovered node — sometimes far off
  screen.
- **Impact**: Serious. The tooltip is the hover-info acceptance criterion.
- **Current Handling**: `svgContainerRect` is computed at line 122 of
  `DependencyGraph.tsx` via `svgContainerRef.current?.getBoundingClientRect()`.
  `getBoundingClientRect()` returns viewport-relative coordinates, which is correct
  for `position: fixed`. However, this call is made at render time (not inside a
  `useCallback` or `useMemo`), so it captures the rect at the last render and does
  not update when the user scrolls or resizes the window. As the user pans/zooms,
  the container rect does not change (the div is fixed in the layout), but if the
  page is scrolled between renders, `svgOffset` is stale. The tooltip also does not
  account for the container's CSS transform or any ancestor transforms.
- **Recommendation**: Compute `svgContainerRect` inside the `onMouseEnter` handler
  rather than at render time, or use a `ResizeObserver`.

### Failure Mode 5: `isUnblocked` is false-positive for tasks with unresolvable or non-task dependencies

- **Trigger**: Any task whose `dependencies` array contains a string that has no
  `TASK_\d{4}_\d{3}` match (e.g., free-text notes, external system dependencies).
- **Symptoms**: `resolvedDeps` for that task is empty (the unresolvable dep is
  silently dropped). `isUnblocked = deps.length === 0` evaluates to `true`.
  The task shows a green READY badge even though it has an unmet dependency.
- **Impact**: Serious. Misleads the team into starting work on a task that is
  actually blocked.
- **Current Handling**: No fallback — unresolvable deps are silently discarded at
  `getGraph():224-228`.
- **Recommendation**: If `rawDeps.length > resolvedDeps.length`, treat the task as
  potentially blocked (`isUnblocked = false`) rather than as having no deps.

---

## Critical Issues

### Issue 1: Node click immediately clears its own selection via bubbling

- **File**: `packages/dashboard-web/src/views/DependencyGraph.tsx:170-173`
- **Scenario**: User clicks any task node. The `onClick` on the node `<g>` sets
  `selectedId`, then the event bubbles to the outer `div` which checks
  `tag === 'g'` and calls `setSelectedId(null)`.
- **Impact**: The select-chain and click-to-navigate interactions both fail. The
  primary interactive feature of the view does not work.
- **Evidence**: Line 172: `if (tag === 'svg' || tag === 'g') setSelectedId(null)`.
  Node groups rendered in `GraphSvg.tsx:186` are `<g>` elements. Every node click
  matches this condition.
- **Fix**: Call `e.stopPropagation()` inside the node `onClick` in `GraphSvg.tsx`,
  or rewrite the outer handler to check `e.target === svgContainerRef.current` or
  `e.target === svgRef.current` instead of checking tag names.

### Issue 2: `assignCol` does not propagate column corrections to downstream nodes

- **File**: `packages/dashboard-web/src/components/graphLayout.ts:37-45`
- **Scenario**: Task C depends on both A (root) and B (root). A is processed first,
  setting `col[C] = 1`. B is processed next; `col[C]` is already 1, the depth
  passed for C's slot is also 1 (since B is also at col 0), so no update fires.
  Worse: if B had already been visited when reached through A's subtree,
  `visited.has(B)` returns early. Correct col assignment for a diamond requires
  that C's column = max(col[A], col[B]) + 1.
- **Impact**: Nodes with multiple predecessors are placed in wrong columns. Edges
  can render pointing left (backwards) in the graph.
- **Evidence**: Lines 39-44. The `visited` guard on line 40 returns before recursing
  children even when a node's column was just corrected to a larger value.
- **Fix**: Replace the DFS `assignCol` with Kahn's topological sort. Process nodes
  in topological order; each node's column = max(col[predecessor] + 1) over all
  predecessors.

---

## Serious Issues

### Issue 3: Edge chain-highlight is over-inclusive — paints edges between any two highlighted nodes

- **File**: `packages/dashboard-web/src/components/GraphSvg.tsx:154-155`
- **Scenario**: Node A -> Node C and Node B -> Node C. User selects C. Chain
  contains A, B, and C. Any edge whose `from` and `to` are both in the chain set
  is colored as a chain edge. If there happens to be an edge A -> B, it is
  also colored cyan even though it is not part of the selected chain (A -> B -> C
  is a different chain than A -> C).
- **Impact**: Misleading visual highlight when the selected task's ancestors have
  inter-dependencies.
- **Fix**: An edge should be colored as chain only if it is a direct path segment
  in the upstream or downstream BFS traversal, not merely if both endpoints are in
  the chain set.

### Issue 4: Tooltip screen position is computed at render time, not on hover

- **File**: `packages/dashboard-web/src/views/DependencyGraph.tsx:122-123`
- **Scenario**: User loads the page, scrolls or resizes, then hovers a node.
- **Impact**: Tooltip appears at a position offset by the scroll delta. Severe in
  any dashboard that has content above the graph.
- **Fix**: Call `getBoundingClientRect()` inside the `onMouseEnter` handler or use
  a `useLayoutEffect` + `ResizeObserver`.

### Issue 5: No `AbortController` on concurrent `getGraph()` fetches

- **File**: `packages/dashboard-web/src/views/DependencyGraph.tsx:37-47`
- **Scenario**: `lastUpdated` changes rapidly (multiple WebSocket events). Multiple
  `fetchGraph()` calls are in-flight simultaneously.
- **Impact**: Out-of-order responses silently overwrite more recent data with older
  data. The graph can show stale state with no indication.
- **Fix**: Cancel the previous fetch with `AbortController` before starting a new
  one, or gate with a ref-based in-flight guard.

### Issue 6: `isUnblocked` is a false positive for tasks with non-parseable dependencies

- **File**: `packages/dashboard-service/src/state/store.ts:247-252`
- **Scenario**: Task has `dependencies: ["Manual QA sign-off required"]`.
  `resolvedDeps` is empty. `deps.length === 0` is true. `isUnblocked = true`.
  Green READY badge renders.
- **Impact**: Team starts a task that should be blocked, leading to rework.
- **Fix**: When `rawDeps.length > resolvedDeps.length`, set `isUnblocked = false`.

---

## Moderate Issues

### Issue 7: Dependency regex is not word-boundary anchored

- **File**: `packages/dashboard-service/src/state/store.ts:208`
- **Scenario**: A dependency string contains a task ID as a substring of a longer
  token (e.g., `"TASK_20260_023 notes"`). The non-anchored regex
  `/TASK_\d{4}_\d{3}/` matches `TASK_2026_023` inside `TASK_20260_023`.
- **Impact**: Phantom edges in the graph pointing to unrelated tasks.
- **Fix**: Use `/\bTASK_\d{4}_\d{3}\b/`.

### Issue 8: Disconnected graph components stack on top of each other

- **File**: `packages/dashboard-web/src/components/graphLayout.ts:54-72`
- **Scenario**: Two independent task chains exist with no connecting edges. Both
  chains have tasks at column 0. Those tasks share the same (x=0) and overlap in y
  because each group's row indices start at 0.
- **Impact**: Nodes overlap and are unreadable.
- **Fix**: After grouping by column, sort columns and assign y-offsets that account
  for the height used by all nodes in the same column from previous components.

### Issue 9: `computeCriticalPath` highlights all max-length chains, not just the primary bottleneck

- **File**: `packages/dashboard-web/src/components/graphLayout.ts:110-112`
- **Scenario**: Two independent chains of the same length exist. Both are
  highlighted as "critical path."
- **Impact**: When many chains tie, a large fraction of the graph is highlighted,
  making the critical path signal meaningless.
- **Fix**: Either document this as intentional multi-path highlighting, or pick the
  single chain with the most BLOCKED / IN_PROGRESS tasks as the primary path.

### Issue 10: `loading` is not reset to `true` on subsequent fetches

- **File**: `packages/dashboard-web/src/views/DependencyGraph.tsx:37-47`
- **Scenario**: After initial load, `lastUpdated` changes, triggering `fetchGraph`.
  There is no `setLoading(true)` at the start of `fetchGraph`, so the graph
  continues showing stale data without any loading indicator during the re-fetch.
  If the re-fetch fails, the error panel appears suddenly without a transition.
- **Impact**: UX degradation; users cannot tell a refresh is in progress.
- **Fix**: Set `loading = true` at the start of every `fetchGraph` invocation, or
  use a separate `refreshing` flag to avoid hiding the graph during background
  refreshes.

---

## Data Flow Analysis

```
lastUpdated (WebSocket store) → fetchGraph() → api.getGraph()
                                   ↓ (no abort, no in-flight guard)
                            dashboard-service getGraph()
                                   ↓
                    registry.forEach → taskDefinitions.get()
                                   ↓
                    dep string → TASK_ID_RE.match() [Issue 7: no word boundary]
                                   ↓
                    taskIdSet membership check
                    [Issue 6: unresolvable deps silently dropped → false isUnblocked]
                                   ↓
                    edges[] push → deduplicate (dedup AFTER depsOf built: OK)
                                   ↓
                    { nodes, edges: dedupedEdges } → GraphData
                                   ↓ (no out-of-order guard, Issue 5)
                    setGraphData() → useMemo recomputes
                                   ↓
              computeLayout() [Issue 2: wrong columns for diamond deps]
              computeCriticalPath() [Issue 9: all tied chains lit]
              computeChain() [correct BFS, but Issue 3: edge over-inclusion]
                                   ↓
                    GraphSvg renders
                    [Issue 1: node click bubbles to outer handler → clears selection]
                                   ↓
                    GraphTooltip renders
                    [Issue 4: svgOffset stale at render time]
```

Gap points:
1. No cancellation between concurrent fetches — stale response can overwrite fresh data.
2. `depsOf` is built from pre-dedup `edges` (duplicate entries possible if same dep listed twice).
3. Unresolvable dep strings are dropped silently — `isUnblocked` is false-positive.
4. `assignCol` corrections do not propagate to children — layout is wrong for diamond deps.
5. Event bubbling erases the selection set by node `onClick`.

---

## Acceptance Criteria Coverage

| Criterion | Status | Notes |
|-----------|--------|-------|
| Dependency graph renders all tasks as nodes with directed edges | ⚠️ | Renders, but node positions are wrong for diamond dependencies (Issue 2). |
| Nodes colored by task status | ✅ | `statusColor()` maps correctly via `tokens.stateColors`. |
| Click node opens Task Detail | ❌ | Broken by event bubbling — selection is immediately cleared (Issue 1). First click never navigates because `selectedId` is always cleared before second click. |
| Hover shows task summary tooltip | ⚠️ | Tooltip renders but position formula uses stale `getBoundingClientRect` (Issue 4). May be off-screen on real deployments. |
| Critical path highlighted | ⚠️ | Highlighted, but over-highlights when multiple chains tie for max length (Issue 9). |
| Nodes update in real-time via WebSocket | ⚠️ | Depends on `lastUpdated` signal; concurrent fetches can produce stale data (Issue 5). |
| Zoom, pan, and fit-to-view controls | ✅ | Wheel zoom, drag pan, and Fit View button all work correctly. |
| Filter by status and type | ✅ | `hiddenStatuses` and `hiddenTypes` sets filter correctly in `useMemo`. |
| Select a task highlights its full dependency chain | ❌ | Selection immediately cleared by outer `onClick` handler (Issue 1). |
| Unblocked tasks visually distinguished | ⚠️ | Green circle renders correctly, but `isUnblocked` has false positives for tasks with non-task-ID dependencies (Issue 6). |
| Handles 30+ tasks without performance issues | ⚠️ | No obvious blocking operations, but `computeChain` and `computeCriticalPath` use O(n*e) patterns. Layout overlap for disconnected components will cause visual unreadability before performance degrades. |

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Graph with zero nodes | YES | Early returns in layout and critical-path | No concern |
| Graph with single node | YES | Critical path returns empty set (no edges) | Semantically questionable but not wrong |
| Disconnected components | NO | Nodes overlap at same (x, y) | Issue 8 |
| Diamond dependency (A->C, B->C) | NO | `assignCol` places C in wrong column | Issue 2 |
| Dependency string with no TASK ID | NO | Dep silently dropped; task shown as unblocked | Issue 6 |
| Same dep listed twice in task.md | PARTIAL | Edge deduped, but `depsOf` may have duplicates | Low impact |
| Non-anchored TASK ID in dep string | NO | Substring match on longer token | Issue 7 |
| Rapid WebSocket updates | NO | Concurrent fetches with no abort | Issue 5 |
| Node click (bubbling) | NO | Parent `onClick` always clears selection | Issue 1 |
| Tooltip after window scroll | NO | `svgOffset` is stale | Issue 4 |
| Filter toggle resets viewport | YES/NO | `layoutNodes.length` change triggers fit-to-view | Surprising UX |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| `api.getGraph()` network failure | MED | Error panel shown, no retry | No retry; user must reload |
| Concurrent fetches (rapid WebSocket) | HIGH | Stale data rendered silently | No AbortController |
| `taskDefinitions.get(record.id)` miss | HIGH | `def` is undefined; falls back to `record.description` for title and `'P2-Medium'` for priority | Acceptable fallback, but priority is always wrong for undiscovered tasks |
| `tokens.stateColors[status]` miss | LOW | Falls back to `textDim` color | Acceptable |
| `tokens.typeColors[t]` miss in FilterBar | MED | Falls back to `tokens.colors.border` | Acceptable |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Issue 1 (event bubbling breaks all node interaction). The single most
important interactive feature — select-chain and click-to-navigate — does not
function due to the outer `onClick` handler clearing selection on every `<g>` tag.
This makes the acceptance criteria for "Click node opens Task Detail" and "Select a
task highlights its full dependency chain" both unmet.

## What Robust Implementation Would Include

- Event propagation controlled at the node level (`stopPropagation` in node handlers).
- Kahn's topological-sort based column assignment instead of DFS `assignCol`.
- `getBoundingClientRect()` called on hover, not at render time, for tooltip positioning.
- `AbortController` in `fetchGraph` to cancel stale in-flight requests.
- Word-boundary anchored regex for dependency string parsing.
- `isUnblocked = false` fallback when raw dep count exceeds resolved dep count.
- Vertical component offset in layout to prevent overlap of disconnected subgraphs.
- `e.stopPropagation()` or a more precise background-click detection (compare target to SVG element reference, not tag name).
