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
