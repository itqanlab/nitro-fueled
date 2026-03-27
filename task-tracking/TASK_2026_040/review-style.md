# Code Style Review — TASK_2026_040

## Overall Score: 5/10

## Assessment

The implementation is functional and the graph rendering logic is competent, but it accumulated several style debt items that will compound quickly as the codebase grows. The most damaging pattern is the massive `DependencyGraph.tsx` view at 377 lines — nearly 2.5x the 150-line component limit — with five sub-components defined in the same file, none of which belong there. The file-size rule is the single most-violated rule in this project and this implementation breaks it hard again. Beyond size, there are two status-union mismatches between the frontend and backend (`FIXING` exists in the web type but not the service type; `FIXING` appears in `STATUS_OPTIONS` but the service never emits it), multiple hardcoded color values in component files, weak types on `GraphNode.type` and `GraphNode.priority` (bare `string` when typed unions already exist), a non-memoized `nodeMap` rebuilt every render in `GraphSvg`, and a recursive `assignCol` in `graphLayout.ts` that can stack-overflow on a deep real-world dependency chain. The backend `getGraph()` method is clean and fits its file. The `event-types.ts` additions are well-structured. The frontend components are where the debt lives.

---

## Findings

### [serious] DependencyGraph.tsx:1 File exceeds component size limit by 151%

The file is 377 lines. The project limit is 150 lines for a component file. Five sub-components (`Header`, `BtnGhost`, `FilterBar`, `FilterLabel`, `Legend`) are defined inside the view file. The rule states one component per file; none of these sub-components are trivial stubs — `FilterBar` alone is 70 lines. Each belongs in its own file under `components/`. As written, any developer who needs to modify `FilterBar` must navigate a 377-line file to find it, and any future component that wants to reuse `BtnGhost` or `FilterLabel` has no clean import path.

**Recommendation**: Extract each sub-component to its own file. `BtnGhost` and `FilterLabel` are generic enough for `components/ui/`. `Header`, `FilterBar`, and `Legend` belong in `components/graph/`.

---

### [serious] DependencyGraph.tsx:10-14 `STATUS_OPTIONS` includes `FIXING` which does not exist in `event-types.ts`

The frontend `TaskStatus` union (in `types/index.ts`) includes `'FIXING'` as a member. The backend `TaskStatus` union (in `dashboard-service/src/events/event-types.ts`) does NOT include `'FIXING'`. `STATUS_OPTIONS` on line 10 of the view hardcodes `'FIXING'` in the filter chip row. The service never emits this status. This means the filter chip renders permanently with no tasks ever matching it — dead UI state that confuses users and signals a canonical source-of-truth problem. Either the service type is missing a status, or the frontend type has a phantom one; either way the two packages disagree on the valid set.

**Recommendation**: Align the two `TaskStatus` unions to the same canonical list. Identify which package is authoritative (likely `event-types.ts`) and make the other import from it or mirror it exactly.

---

### [serious] GraphSvg.tsx:120 `nodeMap` rebuilt on every render, not memoized

`GraphSvg` is a plain function component with no `useMemo`. Line 120 constructs `new Map(layoutNodes.map(...))` on every render call. `GraphSvg` re-renders whenever any hovered or selected node changes (both `hoveredId` and `selectedId` are props). With 30+ nodes (the stated acceptance criterion), this is a Map construction on every mouse-move event. The parent already does heavy `useMemo` work to produce `layoutNodes` — that effort is partially wasted if the consumer rebuilds derived structures each time.

**Recommendation**: Either wrap `GraphSvg` in `React.memo` and move `nodeMap` into a `useMemo` keyed on `layoutNodes`, or construct the map in the parent's existing `useMemo` and pass it as a prop.

---

### [serious] GraphSvg.tsx:14 and :46 Hardcoded color values in component file

Line 14: `'rgba(100,100,100,0.15)'` as a fallback dim color.
Line 46: `'0 4px 24px rgba(0,0,0,0.4)'` as a box-shadow.

The project rule is explicit: all colors via CSS variables (`tokens.*`). Hardcoded hex and rgba values are only permitted in theme definition files. The token system (`tokens.colors.*`) already provides semantic slots. The fallback dim on line 14 should either be a token (`tokens.colors.textDimBg` or similar) or the token lookup should throw/warn if a status is unknown so the gap is visible. The box shadow is purely presentational and should live in a token.

**Recommendation**: Add any missing tokens to the theme file and replace the two raw rgba values with token references. If no matching token exists, add one there — not here.

---

### [moderate] GraphNode.type and GraphNode.priority typed as bare `string`

`event-types.ts:216-217` and `types/index.ts:215-217`:
```
readonly type: string;
readonly priority: string;
```

`TaskType` and `TaskPriority` union types are already defined in both files. `GraphNode` should use them. As written, `GraphNode.type` accepts any string (including garbage values), and the filter chips in `DependencyGraph.tsx` use `hiddenTypes.has(n.type)` against a `Set<string>` where types were inserted from the hardcoded `TYPE_OPTIONS` array — meaning a `GraphNode` with an unexpected type value will silently never match a filter. The typed union would make this a compile-time guarantee rather than a runtime assumption.

**Recommendation**: Change `GraphNode.type` to `TaskType` and `GraphNode.priority` to `TaskPriority` in both `event-types.ts` and `types/index.ts`. The service's `getGraph()` already constrains these values in practice; the type should say so.

---

### [moderate] DashboardStats shape diverges between service and web types

`event-types.ts` (service): `DashboardStats` has `byModel: Record<string, number>` as a required field (line 178).
`types/index.ts` (web): `DashboardStats` does NOT have `byModel` — it has `byStatus`, `byType`, `completionRate`, and then `totalCost?`, `totalTokens?`, `costByModel?`, `tokensByModel?` as optional fields.

The two packages define different shapes for the same interface. This is a pre-existing divergence but the TASK_2026_040 additions (`GraphNode`, `GraphEdge`, `GraphData`) were added to both files, creating a pattern of duplication. If the same type is defined in two packages and they drift (as `DashboardStats` already has), there is no compile-time protection.

**Recommendation**: This is a structural issue beyond this task's scope, but it should be documented. The correct long-term fix is a shared `@nitro-fueled/types` package that both `dashboard-service` and `dashboard-web` import from, eliminating the duplication entirely.

---

### [moderate] graphLayout.ts:37 Recursive `assignCol` risks stack overflow on deep graphs

`assignCol` is a recursive depth-first function. For a dependency chain of depth N, it recurses N frames deep. JavaScript default stack depth is roughly 10,000–15,000 frames, which sounds large, but in a project that may have 100+ tasks with deep chains, and where the function recurses once per edge (not per node — it can revisit nodes through different paths before the `visited` guard fires), the effective call depth can exceed expectations. More importantly, the `visited` guard fires after the depth update, meaning nodes can be entered multiple times before being marked visited, producing more frames than the node count.

**Recommendation**: Rewrite `assignCol` as an iterative BFS/topological sort using a queue. This is also more correct for longest-path assignment (Kahn's algorithm naturally gives it). The recursive version also has a logical issue: it adds to `visited` before processing children, so a node that is reachable via two paths will only be processed along the first path — which can undercount the column for nodes on the second path.

---

### [moderate] DependencyGraph.tsx:56 Type assertion `n.status as TaskStatus`

Line 56: `if (hiddenStatuses.has(n.status as TaskStatus)) return false;`

`n` here is typed as `GraphNode`, which has `status: TaskStatus`. There should be no need for an `as TaskStatus` cast — the type is already `TaskStatus`. The presence of the cast suggests the original `GraphNode.status` field may have been `string` at some point during development, and the cast was added to make it compile. Now that `GraphNode.status` is typed correctly, the cast is dead weight. Per project rules, `as` assertions are banned unless the type system fights you. Here the type system is not fighting — the cast is just noise.

**Recommendation**: Remove the `as TaskStatus` cast. If it was needed to silence a compiler error, the root cause is a type mismatch that should be fixed at the interface level, not papered over with an assertion.

---

### [moderate] DependencyGraph.tsx:116-120 `toggleStatus` and `toggleType` are non-memoized inline functions

`toggleStatus` (line 116) and `toggleType` (line 119) are defined as plain `const` arrow functions inside the component body, not wrapped in `useCallback`. They are passed as props to `FilterBar`. Because they are recreated on every render, `FilterBar` will re-render every time ANY state in `DependencyGraph` changes (pan, scale, hoveredId, etc.), not just when filter state changes. Given `FilterBar` renders 9 status chips + 7 type chips + a checkbox, this is 16+ button re-renders on every mouse-move during pan.

**Recommendation**: Wrap both in `useCallback` with `[]` dependencies (the state setter from `useState` is stable). Alternatively, split filter state into a context or a child component that owns its own state.

---

### [minor] graphLayout.ts:5-6 Module-private constants use lowercase camelCase

`COL_GAP` and `ROW_GAP` (lines 5-6) are module-level constants. The project naming convention specifies `SCREAMING_SNAKE_CASE` for const domain objects. These are already in SCREAMING_SNAKE_CASE and are consistent — this is compliant. However, `NODE_W` and `NODE_H` are exported constants and are also SCREAMING_SNAKE_CASE. This is consistent. No action needed; noting for completeness.

---

### [minor] DependencyGraph.tsx:81 Tag-name string matching for pan exclusion is fragile

Line 81: `if (tag === 'rect' || tag === 'text' || tag === 'circle') return;`

This is a magic-string comparison against SVG element tag names. It works today but will silently break if new SVG element types are added to `GraphSvg` (e.g., a `<path>` that should also block pan, or an `<image>` element). The same pattern appears at line 171-172. A more robust approach is to attach a `data-interactive="true"` attribute to interactive elements and check for that, or use `closest('[data-interactive]')`.

---

### [minor] GraphSvg.tsx:102 `svgRef` prop is passed in but never used inside `GraphSvg`

`GraphSvgProps` declares `readonly svgRef: React.RefObject<SVGSVGElement>` (line 101), and the parent passes it. Inside `GraphSvg`, the ref is attached to the `<svg>` element (line 128). However, the parent component (`DependencyGraph`) also holds `svgRef` but never reads it — `fitToView` only uses `svgContainerRef`, not `svgRef`. The `svgRef` prop is threading a ref through two layers for no observable purpose. If it is genuinely unused, this is dead prop surface that confuses future maintainers.

**Recommendation**: Remove `svgRef` from `GraphSvgProps` and from the parent's state if it has no current consumer, or document what future use it reserves.

---

### [minor] event-types.ts:212-229 New interfaces added at end of file, not grouped with related types

`GraphNode`, `GraphEdge`, and `GraphData` were added at lines 212-229, after `SessionData` and before `DashboardEventType`. The file has an implicit grouping by domain (task types, worker types, review types, session types). The graph types were inserted between session types and event types rather than co-located near `DashboardStats` or task types where they conceptually belong. This is a minor organization issue but it makes the file harder to scan.

---

### [info] DependencyGraph.tsx:177 Emoji in empty-state render

Line 177: `<div style={{ fontSize: '48px' }}>🕸️</div>`

Project and agent instructions specify: "Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked." The spider-web emoji in the empty state was not specified in the task acceptance criteria. It is harmless but inconsistent with the stated convention.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `STATUS_OPTIONS` array in `DependencyGraph.tsx:10-13` hardcodes status values that must stay in sync with the backend enum. When a new status is added to `event-types.ts`, someone will update the backend union and forget the frontend array — the filter chip for the new status will silently never appear. The recursive `assignCol` in `graphLayout.ts` will become a latent stack-overflow risk as the task count grows and dependency chains deepen past real-world project use.

### 2. What would confuse a new team member?

The `FIXING` status chip renders in the filter bar with no tasks ever matching it (the backend does not know this status). A new developer will see the chip, wonder what it does, query the backend, and find no record. They will then face the question of whether to add `FIXING` to the service or remove it from the frontend — a decision that should have been made at authoring time. The `svgRef` prop that threads through two layers but appears unused is another source of confusion — is it load-bearing for something not immediately visible?

### 3. What's the hidden complexity cost?

`DependencyGraph.tsx` is already the largest file in the component tree at 377 lines and it will only grow. Every new filter type, new legend entry, or button variant goes into this file because the sub-components are already here rather than in dedicated files. The file will reach 500+ lines within one or two feature additions with no natural forcing function to split it. The non-memoized `nodeMap` and `toggleStatus`/`toggleType` handlers mean performance issues will appear first as jank during pan/hover before anyone thinks to profile — and tracing it back to prop-recreation in a 377-line file is slow.

### 4. What pattern inconsistencies exist?

The parent component (`DependencyGraph`) correctly wraps all event handlers in `useCallback`. The two toggle functions break this pattern. The backend `event-types.ts` uses `TaskType` as the type for `TaskDefinition.type`, but `GraphNode.type` in the same file is `string`. The frontend mirrors this inconsistency. `GraphSvgProps` uses `ReadonlyArray<GraphEdge>` for `edges` but `LayoutNode[]` (mutable) for `layoutNodes` — the mutability convention is inconsistent within the same interface.

### 5. What would I do differently?

Extract each sub-component to its own file immediately. Align the two `TaskStatus` unions by creating a shared types package or at minimum a codegen step that derives the frontend union from the backend's authoritative source. Replace the recursive `assignCol` with iterative topological sort (Kahn's algorithm) — it is the same complexity, more stack-safe, and produces a correct longest-path result. Type `GraphNode.type` and `GraphNode.priority` with their existing union types. Add a `tokens.shadows.tooltip` entry and use it instead of the inline rgba box-shadow.
