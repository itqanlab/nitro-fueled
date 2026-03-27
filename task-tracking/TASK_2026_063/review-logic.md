# Logic Review — TASK_2026_063

## Verdict
APPROVED

## Score
7/10

## Summary

The move is structurally correct. Files are in the right place, tsconfig.json is
correct, `npm run build --workspace=packages/session-orchestrator` compiles without
errors, and the MCP config at `~/.claude/mcp_config.json` was updated to point at
`packages/session-orchestrator/dist/index.js`. The acceptance criteria are met on
every mechanical dimension.

However the move also preserved several pre-existing logic issues that are now formally
inside the monorepo and visible to the review process for the first time. They are not
regressions introduced by this task, but they are now in scope for future work.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`get_pending_events` returns compact JSON for the empty case
(`JSON.stringify({ events: [] })`) and pretty-printed JSON for the non-empty case
(`JSON.stringify({ events }, null, 2)`). A consumer doing string-based log diffing or
snapshot testing sees different wire formats for the same semantic result. This is a
pre-existing issue captured in review-lessons `backend.md` under "Use consistent JSON
formatting across all response paths in a tool."

The `kill_worker` and `get_worker_stats` not-found responses return
`{ content: [{ type: 'text', text: 'Worker X not found.' }] }` without `isError: true`.
A supervisor that calls `kill_worker` with a stale ID will receive a success-shaped
response and may log "KILLED" while the worker continues running. Again pre-existing,
documented in review-lessons.

### 2. What user action causes unexpected behavior?

`closeAll()` in `file-watcher.ts` iterates `[...this.subscriptions.keys()]` but
spreads the result of the iterator rather than the Map entries:

```typescript
for (const [id] of [...this.subscriptions.keys()]) {
```

`this.subscriptions.keys()` is an iterator of strings (`string`), not an iterator of
`[string, ...]` tuples. Destructuring `[id]` from a string yields the first character
of the worker ID, not the worker ID. `cleanup(id)` is therefore called with a single
character, finds nothing in the Map, and all watchers are leaked on shutdown.

This is a bug that was present in the source repo and has been copied into the
monorepo unchanged.

### 3. What data makes this produce wrong results?

`readNewLines` in `jsonl-watcher.ts` uses `readFileSync` on the JSONL file inside a
polling loop that fires every 3 seconds. This is called from `pollAll()` which runs on
the Node.js event loop timer. A very large JSONL file (e.g., a multi-hour Opus task)
blocks the event loop — and therefore all MCP request handling — for the duration of
the synchronous read. For modestly sized sessions this is acceptable, but it is a
latent scalability risk.

`hydrateFromDisk` in `worker-registry.ts` loads persisted workers but does NOT merge
them with factory defaults. A registry.json file written before a new required field
was added to `Worker` will produce incomplete records that cause `undefined` access
downstream. This is a pre-existing issue documented in review-lessons under "Hydrated
records must be merged with factory defaults."

### 4. What happens when dependencies fail?

The `tools/list-workers.ts` and `tools/get-worker-stats.ts` files use the factory
pattern (`export function listWorkersTool(registry)`) but are **never imported or
called from `index.ts`**. The `list_workers` and `get_worker_stats` tools in `index.ts`
are implemented inline with different logic. The factory files are dead code that was
copied over with the rest of `src/`. A future contributor who reads
`src/tools/list-workers.ts` will reasonably assume it is the authoritative
implementation, modify it, and see no effect at runtime. This directly matches the
"Pick one tool export pattern" rule in review-lessons under "MCP Tool Registration."

### 5. What's missing that the requirements didn't mention?

The task required updating `~/.claude/settings.json` for the MCP path. In practice
the MCP config lives at `~/.claude/mcp_config.json`, not `settings.json`. The build
worker correctly updated `mcp_config.json`, but the task spec references the wrong
file. The correct file was updated so the functional requirement is met, but the task
spec reference is stale and will mislead future maintainers.

---

## Failure Mode Analysis

### Failure Mode 1: `closeAll()` leaks all file watchers on shutdown

- **Trigger**: MCP server receives SIGINT or SIGTERM; `closeAll()` is called.
- **Symptoms**: Chokidar watchers are not closed. File descriptors accumulate until
  the OS kills the process for EMFILE or the process exits via the OS anyway. No
  visible error to the operator.
- **Impact**: Low severity in practice because the process exits immediately after
  `closeAll()` — the OS reclaims FDs. But if `closeAll()` is ever called during
  runtime (not shutdown) the bug would leak watchers permanently.
- **Current Handling**: The bug silently does nothing useful.
- **Root cause**: `for (const [id] of [...this.subscriptions.keys()])` destructures a
  string, not a tuple. Should be `for (const id of this.subscriptions.keys())`.

### Failure Mode 2: Dead `tools/list-workers.ts` and `tools/get-worker-stats.ts` factory implementations

- **Trigger**: A developer modifies `src/tools/list-workers.ts` expecting to change
  the `list_workers` MCP tool behaviour.
- **Symptoms**: No change in tool behaviour. The inline implementation in `index.ts`
  continues to run unchanged.
- **Impact**: Developer time lost debugging; potential for silent divergence if someone
  only audits the tool files and not `index.ts`.
- **Current Handling**: None. The dead files look authoritative.
- **Recommendation**: Delete `src/tools/list-workers.ts`, `src/tools/get-worker-stats.ts`,
  `src/tools/get-worker-activity.ts`, `src/tools/kill-worker.ts` (any tool file whose
  factory function is not imported by `index.ts`), or import and use them exclusively.

### Failure Mode 3: Missing factory-default merge on registry hydration

- **Trigger**: A future task adds a required field to the `Worker` interface and the
  registry.json on disk predates that change.
- **Symptoms**: `worker.newField` is `undefined` at runtime; `.toFixed()` or property
  access on it throws or produces `NaN` in formatted output.
- **Impact**: MCP server crash or silent wrong data for all hydrated workers.
- **Current Handling**: The hydration loop does `this.workers.set(id, worker)` without
  merging factory defaults.
- **Recommendation**: Change the hydration loop to
  `this.workers.set(id, { ...defaultWorker(), ...worker })` where `defaultWorker()`
  returns the zero-value object.

---

## Critical Issues

### Issue 1: `closeAll()` destructures string keys as tuples

- **File**: `packages/session-orchestrator/src/core/file-watcher.ts:114`
- **Scenario**: SIGINT handler calls `fileWatcher.closeAll()` on shutdown.
- **Impact**: Every active chokidar watcher is leaked. FD cleanup relies entirely on
  process exit rather than explicit close.
- **Evidence**:
  ```typescript
  for (const [id] of [...this.subscriptions.keys()]) {
    this.cleanup(id); // id = first char of the UUID, not the UUID
  }
  ```
- **Fix**: `for (const id of this.subscriptions.keys()) { this.cleanup(id); }`

---

## Serious Issues

### Issue 2: Dead tool factory files coexist with inline implementations

- **Files**: `packages/session-orchestrator/src/tools/list-workers.ts`,
  `packages/session-orchestrator/src/tools/get-worker-stats.ts`,
  `packages/session-orchestrator/src/tools/get-worker-activity.ts`,
  `packages/session-orchestrator/src/tools/kill-worker.ts`
- **Scenario**: Developer reads the tool file to understand or modify tool behaviour.
- **Impact**: Silent no-op changes; maintenance confusion.
- **Fix**: Delete unused factory files or refactor `index.ts` to import them. Pick
  one pattern as documented in review-lessons.

### Issue 3: `get_pending_events` uses inconsistent JSON formatting

- **File**: `packages/session-orchestrator/src/tools/get-pending-events.ts:12-25`
- **Scenario**: Supervisor polls the empty queue, then polls a non-empty queue.
- **Impact**: Consumer log-diffing or snapshot tests see different wire formats.
- **Fix**: Use `JSON.stringify({ events }, null, 2)` for both branches (or compact for
  both).

### Issue 4: `kill_worker` / `get_worker_stats` not-found responses missing `isError: true`

- **Files**: `packages/session-orchestrator/src/index.ts:86`, `171`
- **Scenario**: Supervisor calls `kill_worker` with a stale worker ID.
- **Impact**: Supervisor receives a success-shaped response and incorrectly concludes
  the worker was killed.
- **Fix**: Add `isError: true` to all not-found response objects.

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| `packages/session-orchestrator/` exists with `src/`, `package.json`, `tsconfig.json` | COMPLETE | All present |
| `npm run build --workspace=packages/session-orchestrator` succeeds | COMPLETE | Zero TypeScript errors |
| `tsconfig.json` has correct `outDir` / `rootDir` | COMPLETE | `outDir: dist`, `rootDir: src` |
| `package.json` is correct for a workspace package | COMPLETE | No scope prefix needed for internal use; workspaces field in root is `packages/*` |
| MCP config updated to new path | COMPLETE | Updated in `~/.claude/mcp_config.json` (not `settings.json` as the spec said) |
| No stubs or placeholders introduced | COMPLETE | All functions are fully implemented |

---

## Requirements Gap

The task spec says to update `~/.claude/settings.json`. The actual MCP config file
used by this installation is `~/.claude/mcp_config.json`. The build worker found the
correct file and updated it. The spec reference is wrong but the outcome is correct.
Future task specs referencing the MCP config file should say `mcp_config.json`.

---

## What Would Make This Bulletproof

1. Fix the `closeAll()` destructuring bug (one-line fix).
2. Delete the four dead factory tool files or unify the registration pattern.
3. Add `isError: true` to not-found MCP responses.
4. Unify JSON formatting in `get-pending-events`.
5. Merge factory defaults in `hydrateFromDisk` to survive schema evolution.
