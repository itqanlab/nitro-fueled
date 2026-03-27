# Code Logic Review — TASK_2026_024

## Score: 5/10

## Review Summary

| Metric              | Value          |
|---------------------|----------------|
| Overall Score       | 5/10           |
| Assessment          | NEEDS_REVISION |
| Blocking Issues     | 3              |
| Serious Issues      | 3              |
| Minor Issues        | 2              |
| Failure Modes Found | 7              |

---

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| `npx nitro-fueled dashboard` starts service + web UI + opens browser | PARTIAL |
| `--service` flag starts headless data service only | PASS |
| `--port` flag allows custom port selection | PASS |
| `--no-open` flag prevents browser auto-open | PASS |
| Service writes `.dashboard-port` file for discovery | PASS |
| CLI detects and reuses already-running service (no double-start) | PARTIAL |
| Supervisor auto-starts data service on `run` command | PASS |
| Dashboard URL printed in Supervisor startup log | PASS |
| Graceful shutdown when Supervisor stops or CLI exits (SIGINT/SIGTERM) | PARTIAL |
| `.dashboard-port` file cleaned up on shutdown | PARTIAL |
| Build pipeline produces self-contained CLI package with embedded web assets | FAIL |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The dashboard child process in `run.ts` is spawned with `stdio: 'ignore'`. If `cli-entry.js` crashes during startup for any reason other than the port file timeout (e.g., malformed task-tracking directory contents, a watcher setup error after the port file is written), the `run` command sees only the timeout warning and continues. The supervisor starts but the dashboard is silently dead with no visible error output anywhere.

Also: `openBrowser` in `dashboard.ts` calls `exec` with a bare `() => {}` error callback. Browser open failures (command not found, xdg-open not installed) are fully swallowed.

### 2. What user action causes unexpected behavior?

Rapid double-invocation: if the user runs `npx nitro-fueled dashboard` twice within the service startup window (before the port file is written), `checkExistingService` returns `null` for both invocations because the port file doesn't exist yet. Both processes spawn a service child, both write the port file (racing), and two service instances end up listening — one on a port that will never be cleaned up because only one PID is tracked.

### 3. What data makes this produce wrong results?

A port file left over from a crashed service that happened to be on port 80 or 443 would cause `parseInt` to return a valid port, the health check to succeed against some unrelated local server (e.g., a local nginx, macOS AirPlay receiver), and the CLI to report "Dashboard already running" and do nothing — while the actual dashboard service is not running at all.

### 4. What happens when dependencies fail?

`run.ts` starts the dashboard before `spawnSupervisor`. If `startDashboardService` throws an unhandled exception (e.g., `fetch` throws something `AbortSignal.timeout` doesn't catch on older Node 18 point releases), the entire `run` action crashes and the Supervisor never starts. The dashboard startup is in the critical path of `run` with no isolation boundary.

### 5. What's missing that the requirements didn't mention?

- No cleanup of the port file when the CLI parent process exits abnormally (SIGKILL, OOM kill). The port file survives and will cause the stale-service detection path to fire on every subsequent run, hitting the health-check timeout (1 second) as a mandatory delay before each start.
- No mechanism for the Supervisor to communicate back to the CLI that a graceful shutdown is happening; the dashboard child is killed based on CLI process signals only, which do not fire when the Supervisor finishes its work normally.
- The `--service` flag suppresses web UI serving but still announces "Dashboard available at" with a URL that serves no web UI — misleading to users who follow that URL expecting the UI.

---

## Failure Mode Analysis

### Failure Mode 1: TOCTOU Race on Double Dashboard Start

- **Trigger**: User runs `npx nitro-fueled dashboard` twice within 8 seconds of each other (before the port file appears).
- **Symptoms**: Two `dashboard-service` processes running. One is completely untracked (no PID reference, never shut down). Both write to the same port file; whichever wins owns the port entry, the other runs silently forever.
- **Impact**: Resource leak, unpredictable WebSocket behavior, stale port file on next boot.
- **Current Handling**: `checkExistingService` only guards against an already-written port file, not concurrent startup.
- **Recommendation**: Use a lock file (`.dashboard-lock`) with `O_EXCL` / `openSync` to create atomically. If lock exists, wait-then-check rather than start.

### Failure Mode 2: Silent Dashboard Death After Port File Write

- **Trigger**: An error in `watchTaskTracking`, `watchAntiPatterns`, or `watchReviewLessons` is thrown after `start()` writes the port file but before it returns.
- **Symptoms**: Port file exists, health check responds (server is up), but watcher is not running. Dashboard shows no live updates. User sees "Dashboard available" but data never refreshes.
- **Impact**: Degraded experience, no indication of the problem. In `run.ts`, `stdio: 'ignore'` means the error is completely invisible.
- **Current Handling**: None. `watchTaskTracking` calls are not wrapped in try/catch. An exception would propagate up through `start()` but only after the port file was written and the console message was printed.
- **Recommendation**: Wrap watcher setup in try/catch inside `start()`. On failure, call `stop()` to clean up the port file before re-throwing.

### Failure Mode 3: Stale Port File Matches Unrelated Local Service

- **Trigger**: A previous service crashed (SIGKILL, power loss). Port file contains `8080`. User runs the `dashboard` command on a machine with a local web server on port 8080.
- **Symptoms**: `checkExistingService` GETs `/health` on port 8080, receives HTTP 200 from the unrelated service, returns "Dashboard already running at http://localhost:8080". Browser opens to the wrong service.
- **Impact**: User is confused, dashboard never actually starts.
- **Current Handling**: Only checks `resp.ok` (any 2xx). No response body validation, no content-type check.
- **Recommendation**: The health endpoint should return a distinctive JSON payload (e.g., `{"service":"nitro-dashboard"}`). The client should validate the body, not just the status.

### Failure Mode 4: `run.ts` Signal Handler Accumulation Across Multiple Runs

- **Trigger**: A developer imports and calls `registerRunCommand` logic in a test harness or re-registers it in a REPL context; or more practically, the `spawn-claude.ts` `spawnClaude` adds signal listeners that are never removed on child exit.
- **Symptoms**: `run.ts` adds `process.on('exit')`, `process.on('SIGINT')`, `process.on('SIGTERM')` unconditionally when `dashboardProcess !== null`. `spawn-claude.ts` also adds `SIGINT`/`SIGTERM` listeners. If SIGINT fires, `run.ts` calls `process.exit(0)` while `spawn-claude.ts`'s `forwardSignal` also fires — both race to handle the same signal.
- **Impact**: Double signal forwarding; the dashboard child may receive two SIGTERMs; the Supervisor child receives a SIGINT then also gets the forwarded kill from the run listener.
- **Current Handling**: None. Listeners are additive with no deduplication.
- **Recommendation**: Use `process.once` for SIGINT/SIGTERM in `run.ts`, and coordinate with `spawnClaude` so only one handler governs the process lifecycle.

### Failure Mode 5: Port File Not Cleaned Up on SIGKILL or Crash

- **Trigger**: OS kills the dashboard service process with SIGKILL (OOM), or the machine loses power.
- **Symptoms**: `.dashboard-port` persists in `task-tracking/`. Next run hits a 1-second health-check delay before every start. If the port is reused by anything else, Failure Mode 3 triggers.
- **Impact**: Mandatory startup delay on every subsequent run; potential false-positive service detection.
- **Current Handling**: `stop()` calls `unlinkSync` — but `stop()` is only called from SIGINT/SIGTERM handlers and is bypassed entirely by SIGKILL.
- **Recommendation**: This is inherent to file-based service discovery. Document it explicitly and add a `--force-restart` flag to `dashboard.ts` that deletes the port file and ignores any running service check.

### Failure Mode 6: `startDashboardService` in Critical Path of `run`

- **Trigger**: `startDashboardService` throws synchronously (e.g., `resolve()` or `readFileSync` throws due to a permissions issue on task-tracking directory).
- **Symptoms**: The entire `run` action handler rejects. `spawnSupervisor` is never called. The user sees an unhandled promise rejection or no output at all.
- **Impact**: The Supervisor fails to start due to a dashboard-adjacent error. The dashboard is optional — the Supervisor should always start.
- **Current Handling**: `await startDashboardService(cwd)` is not wrapped in try/catch.
- **Recommendation**: Wrap in try/catch. If dashboard startup fails, log a warning and continue. Dashboard is a non-critical enhancement; it must not gate the Supervisor.

### Failure Mode 7: `findEntryScript` Falls Back to Non-Existent Path Without Warning

- **Trigger**: Neither candidate path exists (service not built, published package not installed).
- **Symptoms in `dashboard.ts`**: `findEntryScript` returns `candidates[1]` (the monorepo path) unconditionally as a fallback even when it doesn't exist. The next check `if (!existsSync(entryScript))` catches this and exits — so this is handled, albeit with a misleading error message saying "expected at" the fallback path, not the installed path.
- **Symptoms in `run.ts`**: `findDashboardEntryScript` returns `null` and the function exits gracefully. Correct behavior, but the error message ("Build dashboard-service to enable") is the only signal to the user that something is off.
- **Impact**: Silent degradation in `run` mode; confusing error message in `dashboard` mode.
- **Current Handling**: Partial. `dashboard.ts` always returns a path (even a bad one); `run.ts` returns null correctly.
- **Recommendation**: Align both functions. `dashboard.ts`'s `findEntryScript` should return `string | null` and exit with a clear error, not silently pass a non-existent path to the next check.

---

## Findings

### [BLOCKING] Dashboard Start Can Leave Two Competing Service Processes Running

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/dashboard.ts:111-119`

Issue: `checkExistingService` guards only against a pre-existing port file. Between two rapid invocations, both processes read no port file, both spawn a service child. Both children race to write the port file. The second PID is untracked and never killed — not by CLI shutdown, not by SIGTERM forwarding, not by `stop()`.

Fix: Implement an advisory lock file (e.g., `task-tracking/.dashboard-lock`) using `fs.openSync` with the `wx` flag (exclusive create). The lock file should contain the spawned PID. On startup, if the lock exists but the PID is dead, remove it and proceed. Delete the lock in `stop()`.

---

### [BLOCKING] `startDashboardService` in run.ts Is Unguarded — Can Crash the Supervisor

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts:291`

Issue: `await startDashboardService(cwd)` is called without try/catch. Any exception from `readFileSync`, `fetch`, or `spawn` crashes the entire `run` action, preventing the Supervisor from starting. The dashboard is an optional enhancement; its failure should never abort a run.

Fix:
```typescript
let dashboardProcess: ChildProcess | null = null;
try {
  dashboardProcess = await startDashboardService(cwd);
} catch (err) {
  console.warn(`Warning: Dashboard service failed to start: ${String(err)}`);
}
```

---

### [BLOCKING] Build Pipeline Does Not Embed Web Assets Into CLI Package

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/package.json`

Issue: The acceptance criterion requires "a self-contained CLI package with embedded web assets." The root `package.json` has a `build:dashboard` script that builds both packages sequentially, but there is no step that copies `dashboard-web/dist` into `cli/dist` or includes it in the CLI npm package manifest. `findWebDistPath` in `dashboard.ts` resolves to either a sibling package's `dist/` or a `node_modules` path — both require the web package to be separately installed or the monorepo to be intact. A published `@nitro-fueled/cli` tarball would contain neither.

Fix: Add a `postbuild` step in `cli/package.json` that copies `../dashboard-web/dist` into `cli/dist/web-dist/`. Update `findWebDistPath` to check `resolve(thisDir, '../web-dist')` as the first candidate. Add `dist/web-dist/` to the CLI package's `files` array in its `package.json`.

---

### [SERIOUS] Stale Port File Matches Unrelated Local HTTP Server

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/dashboard.ts:72-80`
File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts:189-199`

Issue: Both `checkExistingService` and `startDashboardService`'s already-running check validate only `resp.ok` (HTTP 2xx). A stale port file pointing to port 80, 3000, 3001, 8080, or 8443 (all commonly occupied on developer machines) will trick the check into believing the dashboard is already running. User sees "Dashboard already running" but the actual dashboard never starts.

Fix: The `/health` endpoint in `dashboard-service` should return a JSON body with a service identifier field (e.g., `{"ok":true,"service":"nitro-dashboard"}`). The discovery clients should parse the JSON and validate the `service` field before trusting the response.

---

### [SERIOUS] Duplicate Signal Handlers on SIGINT/SIGTERM in run.ts

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts:303-305`
File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/spawn-claude.ts:19-20`

Issue: When `dashboardProcess !== null`, `run.ts` registers `SIGINT` and `SIGTERM` listeners that call `process.exit(0)`. `spawnClaude` also registers `SIGINT` and `SIGTERM` listeners that forward the signal to the Claude child. Both sets fire on the same signal. `process.exit(0)` inside the `run.ts` handler fires before `spawnClaude`'s `forwardSignal` can complete, potentially cutting off an in-progress Claude session without a clean handshake.

Fix: Use `process.once` instead of `process.on` in `run.ts`'s signal registration. Coordinate shutdown order: forward to Supervisor first, then kill dashboard, then exit.

---

### [SERIOUS] `dashboard.ts` `registerShutdownHandlers` Registers Handlers on Every `start()` Call

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/index.ts:120-128`

Issue: `registerShutdownHandlers` unconditionally calls `process.on('SIGINT', ...)` and `process.on('SIGTERM', ...)`. If `start()` is called more than once (e.g., in a test, or after a `stop()` and restart), signal handlers accumulate. Node emits a `MaxListenersExceededWarning` and multiple shutdown sequences race.

Fix: Use `process.once` instead of `process.on`. Store the handler reference and call `process.off` in `stop()`.

---

### [MINOR] `openBrowser` Executes an Unsanitized URL via Shell

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/dashboard.ts:46-50`

Issue: `exec(`${command} ${url}`)` passes `url` directly into a shell string. If `url` contains special characters (unlikely given it's derived from `parseInt`, but possible if a future refactor changes port resolution), shell injection is possible.

Fix: Use `execFile` with an array of arguments: `execFile(command, [url], () => {})`. This avoids shell interpretation entirely.

---

### [MINOR] `cli-entry.ts` Default Port is 4200, But `dashboard.ts` Sends `String(requestedPort)` (Default 0)

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/dashboard-service/src/cli-entry.ts:12`

Issue: `cli-entry.ts` defaults the port to `4200` if `--port` is not provided or is `NaN`. `dashboard.ts` always passes `--port` with the validated `requestedPort` value (default `0`). In `run.ts`, `startDashboardService` always passes `--port 0`. So the default in `cli-entry.ts` is dead code — but it creates a misleading inconsistency: if `cli-entry.ts` is ever invoked directly without `--port`, it defaults to 4200 (a fixed port) rather than auto-assign. This creates a conflict risk if another tool (e.g., Angular dev server) is using 4200.

Fix: Change the default in `cli-entry.ts` to `0` (auto-assign) to match intent.

---

## Data Flow Analysis

```
[User: npx nitro-fueled dashboard]
         |
         v
dashboard.ts action()
  |
  +-- checkExistingService(portFilePath)
  |     |-- existsSync(portFilePath)?
  |     |     NO: return null (proceed)
  |     |     YES: readFileSync -> parseInt -> fetch /health
  |     |           ISSUE: any HTTP 200 accepted, not service-specific
  |     +-- returns null (no existing) or port (existing)
  |
  +-- findEntryScript()
  |     ISSUE: always returns candidates[1] as fallback even if not found
  |
  +-- spawn(process.execPath, [entryScript, ...args])
  |     stdio: 'inherit' (visible to user, good)
  |     |
  |     v
  |   cli-entry.ts -> DashboardService.start()
  |     |-- server.listen(port, cb)
  |     |-- writeFileSync(portFilePath, actualPort)   <- port file written here
  |     |-- watchTaskTracking()
  |     |     ISSUE: if this throws, port file is already written, stop() not called
  |     |-- registerShutdownHandlers()
  |     |     ISSUE: process.on not process.once, accumulates on restart
  |     +-- console.log(url)
  |
  +-- pollForPortFile(portFilePath, 8000ms)
  |     100ms polling -> reads port file -> parseInt
  |     ISSUE: race if two dashboard.ts instances start simultaneously
  |
  +-- openBrowser(url)
        exec(`open ${url}`)
        ISSUE: shell string, error swallowed

[User: npx nitro-fueled run]
         |
         v
run.ts action()
  |
  +-- preflightChecks, validateOptions, displaySummary
  |
  +-- startDashboardService(cwd)   <- NOT wrapped in try/catch
  |     ISSUE: any exception here aborts the Supervisor
  |     |
  |     +-- already-running check (same stale-port-file risk)
  |     |
  |     +-- spawn(process.execPath, [entryScript, ...], stdio: 'ignore')
  |     |     ISSUE: all crash output invisible
  |     |
  |     +-- pollForPortFile(8000ms)
  |           timeout warning only, Supervisor still starts
  |
  +-- process.on('SIGINT'/'SIGTERM', shutdownDashboard + process.exit)
  |     ISSUE: conflicts with spawnClaude's own SIGINT/SIGTERM handlers
  |
  +-- spawnSupervisor(cwd, taskId, opts)
        spawnClaude() -> process.on('SIGINT'/'SIGTERM', forwardSignal)
        ISSUE: now two SIGINT handlers both fire, process.exit races with forwardSignal

Gap Points:
1. Port file survives SIGKILL — stale file on next boot mandatory delay
2. No atomic lock prevents two concurrent dashboard starts
3. Web assets not embedded in CLI package build
4. Dashboard watcher errors after port file write leave service in degraded state silently
```

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| `npx nitro-fueled dashboard` starts service + UI + opens browser | PARTIAL | Web assets not embedded for published package |
| `--service` flag starts headless only | COMPLETE | None |
| `--port` flag allows custom port | COMPLETE | None |
| `--no-open` flag prevents browser open | COMPLETE | None |
| Service writes `.dashboard-port` for discovery | COMPLETE | Written before watchers set up; error there leaves orphan file |
| CLI detects and reuses already-running service | PARTIAL | Health check accepts any HTTP 200 (stale port file false positive) |
| Supervisor auto-starts data service on `run` | COMPLETE | But unguarded — dashboard failure can abort Supervisor |
| Dashboard URL printed in Supervisor startup log | COMPLETE | None |
| Graceful shutdown on Supervisor stop / CLI exit | PARTIAL | `process.on` not `process.once`; duplicate handlers; SIGKILL not handled |
| `.dashboard-port` cleaned up on shutdown | PARTIAL | Only on SIGINT/SIGTERM, not SIGKILL or crash |
| Build pipeline produces self-contained CLI package | FAIL | No step embeds web assets into CLI package |

### Implicit Requirements NOT Addressed

1. **Port file survives abnormal termination** — there is no recovery mechanism (e.g., a `--force-restart` flag) documented or implemented.
2. **Supervisor completion does not trigger dashboard shutdown** — the dashboard keeps running after the Supervisor finishes all tasks and exits normally, because the Supervisor exiting fires no signal to the `run.ts` process (the Claude child exits, but `run.ts` itself does not exit until the user sends SIGINT).
3. **`--service` mode URL is misleading** — the URL is printed with a note about the "data service," but if `--service` is used, the printed URL leads to no web UI. There is no UI, and no warning that the URL serves only the API/WebSocket.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Port file absent at start | YES | Proceeds to spawn | None |
| Port file present, service alive | YES | Health check, reuse | Accepts any HTTP 200 |
| Port file present, service dead | YES | Health check fails, spawns new | SIGKILL-killed services leave stale files permanently |
| Two concurrent `dashboard` invocations | NO | None | Both spawn service, one untracked |
| Watcher error after port file write | NO | None | Orphan port file, degraded service |
| Invalid port in port file | YES | `parseInt` guard | None |
| `--port 0` auto-assign | YES | OS assigns, polled from file | None |
| `entryScript` not found | PARTIAL | `dashboard.ts` exits with error; `run.ts` warns and skips | dashboard.ts fallback path misleading |
| Dashboard startup timeout | YES | Warns and continues | Supervisor still starts |
| SIGINT while polling for port | NO | `pollForPortFile` blocks the resolved promise chain | Signal arrives, child gets SIGINT, port file never appears, timeout fires late |
| Web assets not built | PARTIAL | Warns user | No embedded fallback for published package |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| `spawn` of `cli-entry.js` | LOW | HIGH | Covered by entry-not-found check; crash invisible in `run.ts` (stdio:ignore) |
| `fetch /health` stale-port check | MEDIUM | MEDIUM | No service-identity validation; misleads on port collision |
| `pollForPortFile` during SIGINT | LOW | MEDIUM | Polling loop not aborted on signal; delay before shutdown |
| `process.on` signal accumulation | MEDIUM | MEDIUM | Duplicate listeners cause double-exit or double-forward |
| Web asset path resolution | HIGH | HIGH | Published CLI package has no web assets at either candidate path |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The build pipeline does not embed web assets into the CLI package — the primary acceptance criterion (`npx nitro-fueled dashboard` serves the web UI) fails for any consumer who installs the CLI from npm rather than running it in the monorepo. This is a structural gap, not an edge case.

The three blocking issues (TOCTOU on double-start, unguarded `startDashboardService` in `run.ts`, missing web asset embedding) must be resolved before this task can be marked complete. The three serious issues (stale-port false positives, duplicate signal handlers, accumulating shutdown handlers) should be resolved in the same pass.

## What Robust Implementation Would Include

- An `O_EXCL` lock file for atomic service startup guard
- Service-identity JSON body in `/health` endpoint validated by all callers
- `try/catch` around `startDashboardService` in `run.ts` with graceful degradation
- `process.once` instead of `process.on` for all signal handlers; `process.off` in cleanup paths
- A `postbuild` script in `cli/package.json` that copies `dashboard-web/dist` to `cli/dist/web-dist/` and lists it in the `files` field
- Error boundary in `DashboardService.start()` that calls `stop()` before re-throwing if watcher setup fails
- A `--force-restart` flag to handle SIGKILL-survivor stale port files
- `execFile` instead of `exec` for `openBrowser` to avoid shell injection
- Default port of `0` (not `4200`) in `cli-entry.ts` to match auto-assign intent across all callers
