# Backend Review Lessons

Rules for Electron main process, Node.js services, SQLite/LanceDB, IPC handlers, migrations.
Auto-updated after each task's review cycle. Append new findings — do not remove existing ones.

## Database / Repositories

- **Cascade deletes must cover ALL child tables** — audit schema FKs before writing delete logic. T04 missed 8 child tables. (T04, T09)
- **All queries must filter `deleted_at IS NULL`** — including `findById`. (T09)
- **Updates must reject soft-deleted records** — add `deleted_at IS NULL` to WHERE. (T09)
- **Multi-step DB writes must be in a transaction** — especially seeds. Partial state is unrecoverable. (T04, T10)
- **Version increments use atomic SQL** — `SET version = version + 1`. Add UNIQUE constraint on (entity_id, version). (T04)
- **Counter updates use atomic SQL** — `SET count = count + ?`, never read-modify-write. (T04, T77)
- **Upsert with UNIQUE constraint** — `INSERT...ON CONFLICT DO UPDATE`. Never check-then-insert. (T04, T77)
- **Timestamp format: consistent** — use `new Date().toISOString()` everywhere. Don't mix with SQLite `CURRENT_TIMESTAMP`. (T04)
- **OFFSET requires LIMIT in SQLite** — always pair them. (T04)
- **Hard vs soft DELETE: be deliberate** — if parent uses soft delete, document child strategy. (T77)
- **NOT NULL constraints must match TypeScript** — if migration says `NOT NULL`, TS must not allow `null`. (T10)
- **Column names in dynamic SQL** — `buildUpdateSql` uses Object.entries() keys. Whitelist allowed columns at runtime. (T04)

## IPC / Handlers

- **Every handler must validate entity exists** — before delegating to service. Don't let service throw opaque errors. (T45)
- **Delete handlers return success/not-found** — never void. Renderer needs to distinguish. (T09)
- **Empty-schema channels accept `undefined` OR `{}`** — use `.optional()` in Zod. (T07)
- **Handler type must match Zod schema** — use `z.infer<typeof Schema>`. No `as SomeType` casts. (T09)
- **Boolean fields: convert at IPC boundary** — SQLite 0/1 → true/false in handler, not component. (T07)
- **IPC calls need timeout** — add AbortSignal or timeout wrapper. (T03, T07)
- **All declared filter params must be used** — dead params mislead callers. (T10)
- **CLI commands with spaces** — `which "gh copilot"` fails. Extract first token for binary lookup. (T10)
- **Preload allowlist must match registered handlers** — channels in preload but not registered = silent fail. (T07)

## Migrations

- **CHECK constraints for enum columns** — `CHECK(status IN ('created','running',...))`. (T77)
- **Partial indexes for filtered queries** — `WHERE deleted_at IS NULL` on status columns. (T77)
- **FK constraints on all child tables** — orphaned references accumulate without them. (T10)

## Services / Orchestration

- **Init promise must reset on failure** — `_initPromise = null` in catch. Otherwise permanently bricked. (T05)
- **Fetch calls need AbortSignal timeout** — 30s default. No timeout = main process blocks forever. (T05, T06)
- **TOCTOU on resource creation** — concurrent first-access: both see missing, both create. Use mutex or catch-and-retry. (T05)
- **Validate response count matches input** — embedding APIs may return fewer results. Check length. (T05)
- **Validate vector dimensions before search** — wrong dimensions = opaque LanceDB error. (T05)
- **Credential decryption needs try/catch** — cross-machine DB copy breaks it. Show helpful error. (T10)
- **Session status check before message routing** — `sendMessage` checks `running` vs `waiting_for_input`. (T77)
- **Persist state after stream completes** — not during. Partial persistence corrupts on crash. (T45)
- **Conversation format must match adapter spec** — read the contract, don't assume. (T45)
- **Namespace delimiter in IDs** — underscores cause ambiguity. Use `::` or validate no underscores. (T05)

- **In-memory buffers need size caps** — any service accumulating data (text deltas, event queues) must enforce a `MAX_BUFFER_SIZE`. Unbounded growth causes OOM under high throughput. (T79)
- **Services with timers must provide dispose()** — any service creating `setTimeout`/`setInterval` must expose a `dispose()` method that clears timers and flushes state. Wire it into `shutdownIpc()`. (T79)
- **Distinct timeline actions for intermediate vs terminal events** — don't reuse `session_completed` for both `action_complete` and `session_complete`. Use separate action types to keep timeline unambiguous. (T79)
- **Defensive Number() guards before .toFixed()** — adapter events may contain NaN/undefined numeric fields. Always use `Number(x) || 0` before formatting. (T79)

## Electron / Preload

- **`window.electronAPI` may not exist** — guard in dev/test outside Electron. (T03)
- **Context isolation stays enabled** — never `contextIsolation: false`. (T02)
- **Shell `openExternal`: validate URLs** — reject `file://`, `javascript:`. Only `https://`. (T07)
- **Database init failure must block app** — don't open window if migration fails. Show error dialog. (T09)

## Security (backend-specific)

- **LanceDB `.where()` filter strings** — validate or build programmatically. Raw strings = injection. (T05)
- **Never put API keys in URLs** — use request headers. Keys in query strings leak in logs/errors. (T10)
- **Credential decryption must be try/caught** — fail gracefully, not stack trace. (T10)
- **Child process spawn: validate command** — whitelist allowed binaries. Never pass unsanitized input. (T22, T77)
- **Mutual exclusion on dialogs/pickers** — concurrent calls overlap. Use guard flag. (T04)
- **Seed operations must be transactional** — partial seed = unrecoverable. Wrap in `db.transaction()`. (T10)
- **Atomic DB operations for counters** — `SET count = count + ?`. Race condition otherwise. (T04, T77)
- **Path traversal: reject `..`** — use `absolutePathSchema` pattern. (T77)
- **String/array length limits in Zod** — max length on prompts, `.max()` on arrays. (T77)
- **Enum values validated at runtime** — Zod `.enum()` or `.refine()`. Don't trust TS alone. (T10)
- **Symlink following in file operations** — use `fs.lstatSync()` to detect symlinks before reading. `fs.statSync()` follows symlinks by default, allowing arbitrary file reads. (T75)
- **TOCTOU on file size checks** — re-check size immediately before `readFileSync()`. File may change between stat and read. (T75)
- **Transaction result counting** — variables tracking counts inside a transaction must not be read outside if the transaction could roll back. Return counts from the transaction or wrap `txn()` in try/catch. (T75)
- **DatabaseService accessor is `.db`** — not `getDatabase()`. This is a getter property, not a method. (T75)
- **Exact match for dedup queries** — `findByProjectId({ search })` uses LIKE, which is fuzzy. For duplicate detection, use a direct SQL `WHERE LOWER(title) = LOWER(?)` query. (T75)
- **Don't repurpose semantic columns** — storing unrelated metadata in columns like `locked_versions` creates future parsing conflicts. Use the intended field or add a proper metadata mechanism. (T75)
- **Never mix config storage with concurrency-counting maps** — storing pipeline configs in the same Map used for `getRunningCount()` inflates the count and blocks real tasks from starting. Use separate data structures. (T86)
- **Conflicted queue items must not be permanently removed** — `queue.shift()` on conflict drops the task forever. Skip or re-append conflicted items so they retry on next cycle. (T86)
- **Wrap DB writes in event callbacks with try-catch** — an uncaught exception in a session event callback (e.g., cost recording) can crash the entire event pipeline, breaking all downstream handlers. (T86)
- **In-memory queues need persistence or recovery** — purely in-memory task queues are lost on app restart. Persist to SQLite or serialize on change. (T86)
- **Stub resolveWorkDir breaks dependent features** — if conflict guard and parallel runner both use a hardcoded `process.cwd()`, all tasks conflict with each other, making parallel execution impossible. (T86)
- **Prevent duplicate enqueue** — check for existing taskId in queue before pushing. Double-enqueue causes pipeline "already running" throws. (T86)

## CLI Argument Validation

- **Shorthand expansion functions must validate input range before constructing IDs** — a `resolveTaskId(shorthand)` that calls `padStart(3, '0')` silently produces a malformed ID (`TASK_2026_4000`) when the input exceeds the expected digit count. Validate the shorthand format (e.g., `/^\d{1,3}$/`) and emit a user-visible error before constructing the expanded ID; never let a silently-malformed ID reach a downstream regex gate. (TASK_2026_047)
- **Dead code branches introduced by refactoring must be removed immediately** — when a routing refactor changes a call site from `spawnSupervisor(cwd, taskId, opts)` to `spawnSupervisor(cwd, undefined, opts)`, any branch inside `buildAutoPilotArgs` that handled the non-undefined `taskId` case is now unreachable. Leaving it in place creates a maintenance trap: the next person who reads it will assume the path is reachable, or will inadvertently re-enable it when changing call sites. (TASK_2026_047)
- **Action callback option types must not use inline intersection to smuggle in extra fields** — typing the Commander.js action callback as `RunOptions & { skipConnectivity: boolean }` means `skipConnectivity` is absent from the interface and only visible at the call site. Add all run-time flags directly to the options interface; intersections at action boundaries are a type hygiene smell that obscures the real shape of the options object. (TASK_2026_047)

## Service Discovery / CLI Services

- **File-based service discovery needs identity validation** — checking `resp.ok` on a `/health` endpoint accepts any HTTP 200, including from unrelated local servers. The health endpoint must return a distinctive JSON body (e.g., `{"service":"nitro-dashboard"}`) and callers must validate it. (T024)
- **Service startup must use `process.once` not `process.on` for signals** — `process.on('SIGINT')` accumulates handlers on each `start()` call. Use `process.once` and store the reference for removal in `stop()`. (T024)
- **Non-critical background services must not block the main command** — wrap optional service startup (e.g., dashboard in `run`) in try/catch. If the optional service fails, log a warning and continue; never let it abort the primary command path. (T024)
- **Port files survive SIGKILL — document and provide `--force-restart`** — SIGTERM/SIGINT cleanup cannot protect against SIGKILL or OOM. Any file-based port/lock scheme must include a `--force-restart` flag that deletes stale files before starting fresh. (T024)
- **Atomic service startup guard requires `O_EXCL` lock file** — polling a port file does not prevent two concurrent CLI invocations from both spawning the same service. Use `fs.openSync(lockPath, 'wx')` to create a lock atomically; if it throws EEXIST, wait and retry. (T024)
- **Watcher/resource setup after port file write needs error boundary** — if `start()` writes the port file and then throws in watcher setup, the port file is orphaned. Wrap post-write setup in try/catch and call `stop()` (which deletes the port file) before re-throwing. (T024)
- **Published CLI packages must embed their web assets** — `findWebDistPath` that resolves to a sibling package's `dist/` only works in a monorepo. For a published npm package, a `postbuild` script must copy web assets into the CLI's own `dist/` and the `files` array in `package.json` must include them. (T024)
- **`exec` for browser open must use `execFile`** — `exec(\`open ${url}\`)` interprets the URL in a shell string. Use `execFile(command, [url], cb)` to prevent shell injection if the URL derivation ever changes. (T024)
- **Duplicate signal handlers from multiple spawned children** — when a CLI command spawns both a dashboard child and a Supervisor child, each adds its own `SIGINT`/`SIGTERM` listeners. Use `process.once` for parent-level shutdown handlers and coordinate kill order explicitly to avoid races. (T024)
- **Env var presence must be validated before child process spawn** — spreading `process.env` and assigning an optional env var (e.g., `ANTHROPIC_AUTH_TOKEN: process.env['ZAI_API_KEY']`) produces `undefined` when the var is absent. Node.js `spawn` serializes `undefined` env values inconsistently across platforms. Always guard required env vars with an explicit throw before spawn: `if (!process.env['ZAI_API_KEY']) throw new Error('ZAI_API_KEY is required for GLM provider')`. (TASK_2026_021)
- **New launcher modes must be handled in all process-lifecycle branches** — when a new launcher type is added (e.g., `opencode`), every branch that dispatches on `worker.launcher` must be updated: kill paths, auto-close paths, stats-push paths, and process-liveness checks. An `else` catch-all that calls the wrong kill function is a silent bug that only surfaces under auto-close conditions. (TASK_2026_021)
- **Subprocess utility code must not be duplicated across launcher files** — log-dir creation, stdout-buffer accumulation, JSON-line parsing, SIGTERM/SIGKILL escalation, and `process.on('exit')` cleanup are invariant across launcher types. Extract to a shared `spawnTrackedProcess` utility. Duplicated subprocess logic diverges silently when one copy is patched and the other is not. (TASK_2026_021)
- **Cost fallback to a named model on unknown model is silently wrong** — `PRICING[model] ?? PRICING['claude-opus-4-6']` assigns Opus rates to any unrecognized model string, including subscription-priced models (where the correct cost is $0). Log a warning and return a zero-cost object for unrecognized models rather than charging an arbitrary rate. (TASK_2026_021)

## File Watchers / Data Services

- **Never use `readFileSync` in a file-watcher callback** — chokidar events fire on the Node.js event loop. Calling `readFileSync` inside the callback blocks all HTTP requests, WebSocket sends, and further watcher events for the duration of the read. Use `readFile` from `node:fs/promises` and make the callback handler async. (TASK_2026_022)
- **Array-index-based diff logic breaks when the source array is compacted** — comparing `newLog.length > oldLog.length` and using `slice(oldLength)` to find new entries assumes the array is append-only. If the source document is periodically compacted (truncated), this emits zero events after compaction and silently skips entries once the log grows past the pre-compaction length. Track a compaction counter or diff by content identity, not array position. (TASK_2026_022)
- **`as SomeType` casts on externally-parsed strings must be replaced with runtime validation** — `cells[1] as TaskRecord['status']` in a markdown parser silently passes typos and future enum additions through to the store and event bus. Validate against the known union values at parse time and emit a warning for unrecognized values; never use a cast on data that originates from a user-editable file. (TASK_2026_022)
- **Static file servers must validate resolved paths stay within the served root** — `join(webDistPath, pathname.slice(1))` does not prevent path traversal; `path.join` normalizes `..` but does not reject paths that escape the root. After joining, verify `resolvedPath.startsWith(resolve(webDistPath))` and return 404 if not. This is a pre-existing lesson (`path traversal: reject ..`) but the vector via URL-derived join is a distinct pattern. (TASK_2026_022)
- **Closed interfaces used only for a single if-else chain add complexity without polymorphism** — defining `FileParser<T>` as an interface and then dispatching via hardcoded `if (this.registryParser.canParse(...)) ... else if (this.planParser.canParse(...))` means the interface is never used as a type bound. Either register parsers in an array and dispatch polymorphically, or drop the interface and make the dispatch explicit. Half-abstraction is worse than no abstraction. (TASK_2026_022)
- **Dead event types in a discriminated union mislead UI consumers** — if `'worker:progress'` is in the `DashboardEventType` union but is never emitted, any subscriber filtering on it will silently receive nothing. Remove unused event types from the union or mark them as reserved with a comment; do not leave them as live-looking members. (TASK_2026_022)
- **Event payloads reused across semantically different event types cause shape confusion** — stuffing `task:deleted` into the `task:updated` payload shape (`field: 'deleted', oldValue, newValue: null`) forces consumers to special-case the field value to detect deletions. Each semantically distinct event type should have its own payload shape. With `payload: Record<string, unknown>`, this is invisible to the compiler; use a discriminated union on event type to enforce payload shapes. (TASK_2026_022)
- **`npm start` on a library package must point to the CLI entry, not the library index** — if `package.json` `main` is `dist/index.js` (the library export) and `start` runs `node dist/index.js`, a developer running `npm start` gets a no-op because the library module exports but does not execute. The `start` script must point to the CLI entry (`dist/cli-entry.js`). (TASK_2026_022)
