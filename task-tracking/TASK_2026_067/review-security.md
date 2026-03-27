# Security Review — TASK_2026_067

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 3/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 2                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 5                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | No length caps on path/value/contains/event_label; empty strings accepted; no cap on conditions array length |
| Path Traversal           | FAIL   | `join(workingDirectory, condition.path)` with no boundary check; `working_directory` parameter not validated against registry value |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys present |
| Injection (shell/prompt) | PASS   | No shell execution; no eval; no prompt construction from external input |
| Insecure Defaults        | FAIL   | No watcher cap; unbounded event queue; symlink escape not guarded |

---

## Critical Issues

### Issue 1: Path Traversal via `condition.path` — Arbitrary File Watching and Reading

- **File**: `src/core/file-watcher.ts:42` and `src/core/file-watcher.ts:100`
- **Problem**: The absolute path is constructed as `join(workingDirectory, condition.path)` with no boundary check. `path.join` normalizes but does not sanitize `..` sequences. A caller can supply `condition.path = "../../../etc/passwd"` and the resulting `absolutePath` will point outside `workingDirectory`. Chokidar then watches that path, and on any `add` or `change` event `readFile(absolutePath, 'utf-8')` is called, reading the file content. Although the content is not returned to the caller directly, the evaluated condition result (satisfied/not satisfied) leaks one bit per file-change event, and the `WatchEvent.condition.path` that is returned in `get_pending_events` echoes back the traversed path, confirming reachability.
- **Impact**: An attacker with MCP tool access can watch `/etc/passwd`, any SSH private key, or any credential file, triggering the condition to fire as a side-channel oracle. The file is also fully read into memory (`content = await readFile(...)`) and compared against the caller-supplied `value`/`contains` string, enabling substring-search enumeration of arbitrary files.
- **Fix**: After constructing `absolutePath`, resolve both it and the base directory with `path.resolve` and assert that the resolved absolute path starts with `path.resolve(workingDirectory) + path.sep`. Reject the subscription with an error response if the check fails. Example:
  ```typescript
  const resolvedBase = path.resolve(workingDirectory);
  const resolvedTarget = path.resolve(workingDirectory, condition.path);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Path traversal rejected: ${condition.path}`);
  }
  ```

---

### Issue 2: Caller-Supplied `working_directory` Bypasses Registry Value

- **File**: `src/tools/subscribe-worker.ts:52`
- **Problem**: `handleSubscribeWorker` correctly validates that `args.worker_id` exists in the registry. However, it then passes `args.working_directory` (the caller-supplied value) to `fileWatcher.subscribe`, not `worker.working_directory` (the value stored at spawn time). A caller can provide any valid worker ID but supply a completely different absolute path for `working_directory`, redirecting all watchers to an arbitrary directory with no path that can be flagged as a traversal.
- **Impact**: Combined with Issue 1, this fully eliminates the constraint of `working_directory` as a boundary. Even with Issue 1 fixed, this issue alone allows watching `/` by submitting `working_directory: "/"` and `condition.path: "etc/passwd"`. The path traversal check in the fix for Issue 1 would pass (no `..` used), so Issue 2 must be fixed independently.
- **Fix**: Ignore `args.working_directory` entirely (or use it only as a cross-check). Always derive the working directory from the registry entry: `const workingDirectory = worker.working_directory`. If the caller-supplied value is needed for forward-compatibility, emit a warning when it does not match `worker.working_directory` and always use the registry value.

---

## Serious Issues

### Issue 1: Symlink Escape — Chokidar Watcher Follows Symlinks Without Boundary Check

- **File**: `src/core/file-watcher.ts:45`, `src/core/file-watcher.ts:100`
- **Problem**: Chokidar by default follows symlinks. If a symlink is planted inside `workingDirectory` pointing to a file outside it (e.g., `task-tracking/status -> /etc/shadow`), chokidar will watch the target and `readFile` will read the target file. The existing project security lesson (TASK_2026_022) explicitly documents this class of vulnerability for chokidar.
- **Impact**: If any worker process can create symlinks inside the working directory (a reasonable capability), it can redirect the file watcher to read sensitive files. Even without malicious workers, accidental symlinks created by build tools or editors can cause the watcher to read out-of-scope files.
- **Fix**: After a chokidar event fires for `absolutePath`, call `fs.realpathSync(absolutePath)` (catching ENOENT) and verify the resolved real path starts with `path.resolve(workingDirectory) + path.sep`. Abort evaluation if the check fails. Alternatively, pass `{ followSymlinks: false }` to the chokidar `watch` call and accept that symlink-based status files will not trigger events.

---

### Issue 2: Unbounded Conditions Array Enables Watcher Exhaustion

- **File**: `src/tools/subscribe-worker.ts:28`
- **Problem**: The Zod schema enforces `min(1)` on the `conditions` array but has no `max()`. A caller can submit a single call with thousands of conditions, each creating a separate chokidar watcher. Each watcher holds an OS-level file descriptor or inotify/FSEvents watch. On Linux, the default `fs.inotify.max_user_watches` limit is 8,192 (sometimes 65,536). Exhausting this limit causes all subsequent `fs.watch` calls on the host to fail silently, potentially crashing unrelated processes.
- **Impact**: A single malicious or misconfigured `subscribe_worker` call can exhaust the OS watch limit for the entire machine, causing denial-of-service for all file-watching processes (editors, build tools, other MCP servers).
- **Fix**: Add `.max(50)` (or a documented constant) to the conditions array schema. Also consider a global cap across all active subscriptions in `FileWatcher.subscribe` (e.g., `if (this.totalWatcherCount() + conditions.length > MAX_TOTAL_WATCHERS) throw ...`).

---

### Issue 3: Unbounded In-Memory Event Queue

- **File**: `src/core/file-watcher.ts:124` and class field `eventQueue: WatchEvent[]`
- **Problem**: `this.eventQueue` is a plain array with no length cap. Events are only removed when `drainEvents()` is called. If the supervisor stops draining (crash, long pause) but workers continue completing, or if a large number of workers all complete simultaneously, the queue grows without bound. Each `WatchEvent` contains the full `WatchCondition` (with potentially long `value`/`contains` strings), so memory usage per event is non-trivial.
- **Impact**: Under sustained load or supervisor outage, the queue can consume unbounded memory, eventually causing an OOM crash of the MCP server process. This takes down all orchestration for all active sessions.
- **Fix**: Cap the queue at a documented maximum (e.g., 1,000 events). When the cap is reached, either drop the oldest events (FIFO eviction) and log a warning, or reject new events and log. Add a comment documenting the in-memory-only design and the acceptable loss on restart (already noted in the task spec as acceptable).

---

## Minor Issues

1. **No length limits on `path`, `value`, `contains`, `event_label` fields** — `src/tools/subscribe-worker.ts:6-23`. Zod `z.string()` accepts strings of any length. A caller can supply a `value` string of several megabytes; this string is then compared against the entire file content on every file-change event using `trimmed === condition.value.trim()`. Add `.max(4096)` on `path` and `event_label`, and a reasonable cap (e.g., `.max(65536)`) on `value` and `contains` to bound per-event memory allocation and comparison time.

2. **Empty string accepted for `path` field** — `src/tools/subscribe-worker.ts:8`. `z.string()` accepts `""`. `join(workingDirectory, "")` returns `workingDirectory` itself. Chokidar watching a directory path fires on every file created or modified within it. The `readFile(workingDirectory)` call then fails with `EISDIR` (silently caught and retried). This is harmless today but introduces confusing behavior. Add `.min(1)` to the `path` field schema.

3. **`event_label` field is reflected verbatim in `get_pending_events` response without sanitization** — `src/core/file-watcher.ts:126`, `src/tools/get-pending-events.ts:22`. The `event_label` string supplied by the caller appears in the JSON response to the supervisor. If the supervisor parses that label for routing decisions (as the task spec describes — e.g., `BUILD_COMPLETE`, `REVIEW_DONE`), injecting a label like `BUILD_COMPLETE\nSome injected instruction` could confuse the supervisor's text parser. Add `.regex(/^[A-Z0-9_]{1,64}$/)` to the `event_label` schema to enforce the clearly-intended enum-like format.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The combination of Issues Critical-1 and Critical-2 means a caller with access to any registered worker ID can redirect file watchers to arbitrary paths on the host filesystem and use the `file_value`/`file_contains` condition types as a single-bit oracle to enumerate the contents of any readable file (SSH keys, environment files, token stores). Issue Critical-2 (caller-supplied `working_directory` ignored in favor of registry) is the simpler fix and must land alongside the path traversal boundary check — fixing only one of them leaves the other as a complete bypass.
