# Security Review — TASK_2026_040

## Overall Score: 7/10

## Assessment

The dependency graph implementation is generally sound from a security standpoint. No credentials are hardcoded, React's JSX rendering prevents XSS in SVG text nodes, and the static file server has correct path traversal protection. The most significant risk is a potential DoS via `Math.max(...spread)` in `graphLayout.ts` that can exhaust the call stack on dense graphs. The API endpoints are unauthenticated and accessible to any local process, which is consistent with the rest of the dashboard and acceptable for a localhost dev tool — but should be explicitly documented as a threat-model assumption. No injection vectors, no secret exposure.

---

## Findings

### [serious] graphLayout.ts:92 — Call stack exhaustion via large spread in `computeCriticalPath`

`Math.max(...nexts.map((n) => longestFrom(n, visiting)))` spreads an array of recursively computed values into `Math.max`. JavaScript engines impose a maximum argument count on spread calls (typically 65,535 to ~125,000 depending on engine). A task graph node with hundreds of outgoing edges — or a deeply connected graph where each recursive call itself spreads — can produce a `RangeError: Maximum call stack size exceeded` at the spread site. Since this function is called for every node on every graph render, a malformed or unusually large graph in the registry is sufficient to crash the client-side render loop.

The function is in the frontend bundle and runs in the browser, so the crash surfaces as a blank dependency graph view with an unhandled error. In an Electron or Node.js server-side context it would terminate the process.

Fix: Replace `Math.max(...nexts.map(...))` with a `reduce` that accumulates the maximum without spreading: `nexts.reduce((max, n) => Math.max(max, longestFrom(n, visiting)), 0)`.

---

### [moderate] graphLayout.ts:37-44 — Cycle guard fires after depth update in `assignCol`, allowing redundant recursion

In `assignCol`, the depth is updated unconditionally (`if (depth > current) col.set(id, depth)`) before the visited-set check (`if (visited.has(id)) return`). This means that on a graph with cycles, a node can be re-entered at increasing depths before the guard fires, producing redundant recursive calls. While not an infinite loop (the visited set does fire), each re-entry spawns additional stack frames. On a registry with many cyclic edges, this compounds the stack depth, worsening the risk described above.

Fix: Check `visited.has(id)` before the depth update, or switch to a topological-sort-based iterative column assignment that is inherently cycle-safe.

---

### [moderate] http.ts:88-89 — Task ID reflected in JSON error body without format validation

The `:id` route parameter from `GET /api/tasks/:id` is reflected verbatim into the JSON error body: `Task ${params.id} not found`. The ID is JSON-encoded via `JSON.stringify` so there is no XSS risk. However, there is no validation that `params.id` matches the expected `TASK_YYYY_NNN` format before it reaches the store or the error message. A caller can supply arbitrarily long strings as the task ID (e.g., a 10,000-character string), causing those strings to be allocated in memory, passed through Map lookups, and echoed back. In practice the impact is negligible for a localhost tool, but the absence of format validation is a gap.

Fix: Add a format guard — `if (!/^TASK_\d{4}_\d{3}$/.test(params.id)) { sendJson(res, req, { error: 'Invalid task ID format' }, 400); return; }` — before any store access on ID-parameterized routes.

---

### [moderate] store.ts:248-252 — O(n * d) linear scan per `getGraph()` call with no memoization

Inside `getGraph()`, for each task's dependency list, `this.registry.find((r) => r.id === depId)` performs a full linear scan of the registry to check whether a dependency is COMPLETE. For n tasks with d average dependencies each, this is O(n * d) scans per `getGraph()` invocation. The endpoint is polled on every WebSocket `task:state_changed` event and on every `lastUpdated` change in the React store. On a registry with 100+ tasks and 5+ deps each, repeated invocations can produce measurable CPU spikes that degrade dashboard responsiveness.

Fix: Build a `Map<string, TaskRecord>` from `this.registry` once at the start of `getGraph()` and use it for all dependency lookups: `const recordById = new Map(this.registry.map((r) => [r.id, r]))`.

---

### [minor] http.ts:110-112 — `/api/graph` is unauthenticated and has no rate limiting

The `/api/graph` endpoint returns all task nodes and edges with no authentication check, no rate limit, and no request-size constraint. Any process with network access to the service port can read the full orchestration graph. This is consistent with all other endpoints in the server. For a localhost-only development tool this is an explicit threat-model decision, but it is not documented as such in the code or a threat model doc.

Note: The CORS allowlist (`ALLOWED_ORIGINS`) at line 21 restricts browser cross-origin reads but does not restrict curl, scripts, or any non-browser client.

Fix: Document the threat model assumption (localhost-only, dev use) in a code comment or `SECURITY.md`. If the service is ever exposed beyond localhost, add a shared secret or token check.

---

### [minor] store.ts:208 — Dependency regex extracts only the first task ID per dependency string

`TASK_ID_RE = /TASK_\d{4}_\d{3}/` (no `g` flag). `dep.match(TASK_ID_RE)` returns only the first match. If a dependency string contains multiple task IDs (e.g., `"TASK_2026_019 and TASK_2026_020"`), only the first is extracted and the edge to the second is silently dropped. This is a correctness gap that can produce an incomplete graph: tasks appear to have fewer dependencies than they actually do, and the critical path calculation may select the wrong path.

Fix: Use `dep.matchAll(/TASK_\d{4}_\d{3}/g)` to extract all IDs from each dependency string, or enforce a single-ID-per-entry contract in the dependency list.

---

### [info] GraphSvg.tsx:141 — SVG transform attribute constructed from numeric state — confirmed safe

`translate(${pan.x}, ${pan.y}) scale(${scale})` uses pan values set from mouse-event deltas (numbers) and a scale value clamped to `[0.2, 3]`. React escapes SVG attribute values, and the values are numeric. No injection risk.

---

### [info] DependencyGraph.tsx:134 — Error message rendered from caught `Error.message` — confirmed safe

`{error}` is a React state string set from `e instanceof Error ? e.message : 'Failed to load graph'` and rendered as a React text node inside a `<div>`. React escapes text content. No XSS risk.

---

### [info] GraphSvg.tsx:210-217 — SVG text nodes with API data — confirmed safe

`n.id`, `n.title`, `n.type` from the graph API are rendered as React JSX children of `<text>` elements. React escapes all text node content. `dangerouslySetInnerHTML` is not used anywhere in the file. No XSS risk.
