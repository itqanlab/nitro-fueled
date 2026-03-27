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

## MCP Tool Registration

- **Pick one tool export pattern and enforce it across all tool files** — mixing a factory pattern (`export function xTool(registry)` returning `{ name, description, inputSchema, handler }`) with a split-export pattern (`export const xSchema` + `export function handleX`) in the same `src/tools/` directory leaves dead code that looks authoritative. When the two patterns coexist, the next contributor copies the wrong one and wires up a tool that is never registered. Establish one pattern, delete the other entirely. (TASK_2026_067)
- **Async file-watcher condition evaluators must set the satisfied flag before the first `await`** — if `sub.satisfied = true` is set only after an async `readFile()` returns, two `change` events firing within the read window can both pass the pre-async guard check. Move the flag assignment before the first `await` to close the TOCTOU window; reset on failure only if the retry semantics require it. (TASK_2026_067)
- **MCP tool not-found responses must use `isError: true`** — returning `{ content: [{ type: 'text', text: 'Worker X not found.' }] }` without `isError: true` is a success-shaped error. The supervisor calling `subscribe_worker` with a bad ID will log "SUBSCRIBED" and set `event_driven_mode = true` while no watcher was registered. Use `{ content: [...], isError: true }` for all not-found or validation-failure cases. (TASK_2026_067)
- **MCP tool return shapes must match the task spec** — if the spec defines `{ subscribed: boolean, watched_paths: string[] }`, the tool must return JSON with those fields (even if wrapped in MCP `content`). A text block that contains equivalent information is not machine-parseable and will break any future consumer that extracts structured data from the response. (TASK_2026_067)
- **Use consistent JSON formatting across all response paths in a tool** — `get_pending_events` returns compact JSON for the empty case and pretty-printed JSON for the non-empty case. A consumer doing string comparison or display sees different wire formats for the same semantic result. Pick one format and apply it to both branches. (TASK_2026_067)

- **`chokidar.watch()` must be wrapped in try-catch** — on systems with a limited file descriptor table, `watch()` can throw `EMFILE` synchronously. An uncaught throw inside a `for...of` conditions loop propagates to the MCP tool handler and crashes the server. Wrap each `watch()` call in try-catch and return a structured partial-subscription response rather than letting one bad descriptor kill the whole process. (TASK_2026_067)
- **Set `ignoreInitial: false` when the condition may already be satisfied at subscribe time** — chokidar defaults to `ignoreInitial: true`, which suppresses the initial `add` event for pre-existing files. For event-driven completion detection, a worker that finishes before subscription is registered will never fire an event. Pass `{ ignoreInitial: false }` so chokidar evaluates the file immediately on watch setup. (TASK_2026_067)
- **In-memory event queues need a documented size cap** — any service accumulating `WatchEvent[]` without a limit will OOM under sustained supervisor absence or high worker concurrency. Cap the queue (e.g., 500) and log a warning on overflow; recovery is handled by the supervisor's startup reconciliation path. (TASK_2026_067)
- **Caller-supplied `working_directory` in subscription tools creates misconfiguration surface** — if the worker registry already stores `working_directory`, derive the absolute path from the registry record rather than accepting it as a parameter. A caller passing a wrong path watches the wrong files and the subscription silently never fires. (TASK_2026_067)

## File Watchers / Data Services

- **Never use `readFileSync` in a file-watcher callback** — chokidar events fire on the Node.js event loop. Calling `readFileSync` inside the callback blocks all HTTP requests, WebSocket sends, and further watcher events for the duration of the read. Use `readFile` from `node:fs/promises` and make the callback handler async. (TASK_2026_022)
- **Array-index-based diff logic breaks when the source array is compacted** — comparing `newLog.length > oldLog.length` and using `slice(oldLength)` to find new entries assumes the array is append-only. If the source document is periodically compacted (truncated), this emits zero events after compaction and silently skips entries once the log grows past the pre-compaction length. Track a compaction counter or diff by content identity, not array position. (TASK_2026_022)
- **`as SomeType` casts on externally-parsed strings must be replaced with runtime validation** — `cells[1] as TaskRecord['status']` in a markdown parser silently passes typos and future enum additions through to the store and event bus. Validate against the known union values at parse time and emit a warning for unrecognized values; never use a cast on data that originates from a user-editable file. (TASK_2026_022)
- **Static file servers must validate resolved paths stay within the served root** — `join(webDistPath, pathname.slice(1))` does not prevent path traversal; `path.join` normalizes `..` but does not reject paths that escape the root. After joining, verify `resolvedPath.startsWith(resolve(webDistPath))` and return 404 if not. This is a pre-existing lesson (`path traversal: reject ..`) but the vector via URL-derived join is a distinct pattern. (TASK_2026_022)
- **Closed interfaces used only for a single if-else chain add complexity without polymorphism** — defining `FileParser<T>` as an interface and then dispatching via hardcoded `if (this.registryParser.canParse(...)) ... else if (this.planParser.canParse(...))` means the interface is never used as a type bound. Either register parsers in an array and dispatch polymorphically, or drop the interface and make the dispatch explicit. Half-abstraction is worse than no abstraction. (TASK_2026_022)
- **Dead event types in a discriminated union mislead UI consumers** — if `'worker:progress'` is in the `DashboardEventType` union but is never emitted, any subscriber filtering on it will silently receive nothing. Remove unused event types from the union or mark them as reserved with a comment; do not leave them as live-looking members. (TASK_2026_022)
- **Event payloads reused across semantically different event types cause shape confusion** — stuffing `task:deleted` into the `task:updated` payload shape (`field: 'deleted', oldValue, newValue: null`) forces consumers to special-case the field value to detect deletions. Each semantically distinct event type should have its own payload shape. With `payload: Record<string, unknown>`, this is invisible to the compiler; use a discriminated union on event type to enforce payload shapes. (TASK_2026_022)
- **`npm start` on a library package must point to the CLI entry, not the library index** — if `package.json` `main` is `dist/index.js` (the library export) and `start` runs `node dist/index.js`, a developer running `npm start` gets a no-op because the library module exports but does not execute. The `start` script must point to the CLI entry (`dist/cli-entry.js`). (TASK_2026_022)

## Disk Persistence / State Serialisation

- **JSON persistence files must include a schema version envelope** — writing raw `JSON.stringify(entries)` with no version field means any change to the serialised type silently breaks deserialisers on older files. Wrap in `{ version: 1, entries: [...] }` from day one; `_hydrate` can then detect and discard (or migrate) stale formats before a required field goes missing at runtime. (TASK_2026_059)
- **Hydrated records must be merged with factory defaults** — when loading persisted objects from disk, merge each record with its factory-default object (e.g., `{ tokens: emptyTokens(), cost: emptyCost(), ...worker }`) before inserting into the in-memory store. An older file that predates a new required field will otherwise produce structurally incomplete records that cause silent `undefined` access downstream. TypeScript `as SomeType` casts on parsed JSON do not catch this. (TASK_2026_059)
- **`_persist()` must log on failure — best-effort does not mean silent** — a catch block that swallows write errors with only a comment (`// Best-effort`) creates invisible split-brain state: the in-memory store diverges from disk and neither the operator nor callers get any signal. Add `console.error('[service] persist failed:', err)` at minimum. The function can still not throw, but silence is an anti-pattern violation. (TASK_2026_059)
- **`remove()` / `delete()` that persists must guard on effective deletion** — calling `_persist()` unconditionally after `Map.delete(key)` writes to disk even when the key did not exist. Guard with the boolean return of `delete`: `if (this.workers.delete(id)) this._persist()`. Return the boolean to callers so they can distinguish "removed" from "not found". (TASK_2026_059)
- **`writeFileSync` to a persistence file must use write-to-temp + `renameSync`** — `writeFileSync` truncates the target file before writing; a process crash (SIGKILL, OOM) mid-write leaves a zero-length or partial file. On the next restart the corrupted file is silently discarded and all state is lost — defeating the purpose of persistence. Instead write to `path + '.tmp'` then `renameSync(tmp, path)`. `renameSync` is atomic on POSIX (single filesystem). (TASK_2026_059)
- **Polling loops that call individual persist-on-mutation methods cause write amplification** — if a poller calls `updateTokens()`, `updateCost()`, and `updateProgress()` on every active worker every N seconds, each call independently invokes a synchronous `writeFileSync`. With K workers and 3 mutations per tick this is 3K writes per poll interval. Debounce `_persist()` with a short timer (e.g., 500ms reset on each mutation) to collapse bursts into a single write. (TASK_2026_059)
- **`mkdirSync` for a persistence directory must be called inside `_persist()`, not only at startup** — calling `mkdirSync` once at module load does not protect against the directory being deleted while the process runs. Subsequent `writeFileSync` calls throw ENOENT and are swallowed. Move `mkdirSync({ recursive: true })` inside `_persist()` before the write — it is a no-op when the directory already exists, so the overhead is negligible. (TASK_2026_059)

## Git Integration in CLI Commands

- **Use `git rev-parse --git-dir` to detect a git repo, not `.git` existence check** — `existsSync(resolve(cwd, '.git'))` fails for two common layouts: (1) git worktrees, where `.git` is a file not a directory, and (2) subdirectories of a repo, where `.git` does not exist in the subdir. Use `spawnSync('git', ['rev-parse', '--git-dir'], { cwd })` and check `status === 0` instead. (TASK_2026_031)
- **Track all files modified by init, not just files created** — when a file like `.gitignore` pre-exists and init appends content to it, a boolean `!fileExisted` guard will exclude it from the staged file list. Use the return value of the writer function (return true/false for "did write") to decide whether to stage, not just whether the file was new. (TASK_2026_031)
- **On failed `git commit`, always unstage with `git reset HEAD --`** — if `git add` succeeds but `git commit` fails (e.g., pre-commit hook rejection, missing git identity), the files remain staged. The CLI must run `git reset HEAD -- <files>` before returning, or the user's working tree is left in an unexpected staged state with no guidance. (TASK_2026_031)
- **CLI commands that invoke git must propagate failure via process.exitCode** — if `commitScaffold()` logs an error and returns, but the caller does not set `process.exitCode = 1`, CI pipelines will exit 0 on commit failure. Every failure path in a CLI command must set `process.exitCode` to a non-zero value. (TASK_2026_031)
- **Files created by async sub-operations must be returned to the caller for downstream use** — `handleStackDetection` generates agent files but returns `void`. When the caller needs those paths (e.g., to stage them in a `--commit` flow), the function must return the list of written paths. A void async helper that creates files is a tracking black hole. (TASK_2026_031)

## Supervisor Orchestration Specs (SKILL.md)

- **Every new log event type must be registered in the canonical log event table** — when a new supervisor event is added (e.g., "Spawn fallback"), its pipe-table row must be added to the log table alongside the inline instruction. Omitting it means the event appears in `log.md` but is invisible to anyone reading the table to understand what events exist, and creates a second definition drift risk when the inline description uses a different format than the table. (TASK_2026_069)
- **Prose specs must state whether retry/fallback attempts increment retry_count** — if a fallback spawn path does not explicitly say whether `retry_count` is incremented, the supervisor may retry a permanently broken task indefinitely or count the fallback as an extra attempt, burning quota. Each failure path must document its effect on retry_count. (TASK_2026_069)
- **MCP tool signatures in the reference section must include all accepted parameters** — if a tool accepts `provider` at runtime (as Step 5d documents), but the signature block omits it, the next reader will assume the parameter does not exist and write code that cannot pass it. Keep the signature block and the prose usage instructions in sync. (TASK_2026_069)
- **Fallback provider selection should match routing-table quality intent** — a hard-coded fallback to `claude-sonnet-4-6` silently downgrades a Complexity=Complex task that the routing table would have run on `claude-opus-4-6`. Consider using the routing table's claude-equivalent model for the fallback rather than a fixed Sonnet constant. (TASK_2026_069)

## CLI Config / Provider State Machines

- **Provider routing must distinguish "entry exists" from "entry is enabled"** — a condition like `provider !== undefined && status !== 'not configured'` silently misroutes an `enabled: false` entry to the first-time menu. Route on `provider !== undefined` alone; use the status value only to label the menu prompt, not to gate which menu is shown. (TASK_2026_068)
- **CLI mode flags must detect mutual exclusion explicitly** — when a command has multiple mode flags (e.g., `--test`, `--unload`, `--check`, `--reset`), a silent priority chain (`if reset … else if unload … else if test`) swallows accidental multi-flag combinations with no error. Check for flag conflicts at the top of the action handler and exit with a usage error. (TASK_2026_068)
- **`--test` / `--check` exit codes must account for "no providers configured"** — exiting 0 when every provider is `'not configured'` lets a CI pipeline pass even though nothing is usable. Define and document the intended exit semantics: fail if any provider failed, or fail if fewer than N providers are connected. (TASK_2026_068)
- **Wrap `writeConfig` call sites in try/catch with human-readable error output** — `writeFileSync` and `mkdirSync` throw on disk-full, permission denied, or EROFS. An unhandled throw from an async `.action()` callback produces a raw stack trace and a non-deterministic exit code. Always catch, print a friendly message, and set `process.exitCode = 1`. (TASK_2026_068)
