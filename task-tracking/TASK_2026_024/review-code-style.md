# Code Style Review — TASK_2026_024

## Score: 5/10

## The 5 Critical Questions

### 1. What could break in 6 months?

The `pollForPortFile` function is duplicated verbatim across `dashboard.ts` (lines 52–63) and `run.ts` (lines 161–172). Both also duplicate the port-file reading and health-check logic (the `checkExistingService` / inline equivalent in `startDashboardService`). When someone needs to adjust the polling interval or health-check timeout — and they will — they will edit one copy and miss the other. Silent behavioral divergence is guaranteed. The review-general lessons explicitly call this out: "Shared logic must live in exactly one place." (TASK_2026_019)

### 2. What would confuse a new team member?

`dashboard.ts:29` returns `candidates[1]` as a fallback even when that path does not exist, then immediately calls `existsSync(entryScript)` to block on it. This is a deliberate "return a best-guess path and let the caller error" pattern, but it's invisible from the function signature: `findEntryScript(): string` looks authoritative. The companion `findDashboardEntryScript(): string | null` in `run.ts` (line 149) makes the same call but returns `null` on failure — an incompatible contract for the same conceptual operation. Two functions, same job, different contracts, no shared implementation. A new contributor who looks at one will have no idea the other exists.

### 3. What's the hidden complexity cost?

`dashboard.ts` spawns the dashboard service as a subprocess via `spawn(process.execPath, [entryScript, ...])` rather than importing `DashboardService` and starting it in-process. `DashboardService` is already exported from the service package. The out-of-process spawn means: (a) `--inherit` stdio mixes child logs into parent output with no labeling, (b) the browser-open race depends on polling a filesystem file rather than a resolved Promise, (c) there is no way to programmatically confirm the service started cleanly vs. crashed immediately. This complexity is not forced by the architecture — `run.ts` takes the same approach, doubling the blast radius.

### 4. What pattern inconsistencies exist?

- `PORT_FILE_NAME` is defined as a module-level constant in `index.ts` (dashboard-service), imported via the package's public API (`export const PORT_FILE_NAME`), but then **re-declared as a local constant** in both `dashboard.ts:7` and `run.ts:12`. The service package already exports it. Neither CLI file imports it from the package. This is direct duplication of a value that has a single canonical source.

- `findEntryScript()` returns `string` (with a lying fallback); `findDashboardEntryScript()` returns `string | null`. Two functions with the same responsibility should share the same return type.

- `STARTUP_TIMEOUT_MS` in `dashboard.ts:9` vs. `DASHBOARD_STARTUP_TIMEOUT_MS` in `run.ts:13`. Both are `8000`. Different names, same value, same purpose.

- `openBrowser()` is defined in `dashboard.ts` but there is no equivalent in `run.ts`. `run.ts` does not open a browser even when the dashboard starts successfully (intentional), but the utility function is not shared — if `run.ts` ever needs to open the browser, someone will write a third copy.

### 5. What would I do differently?

Extract shared logic into a utility: `packages/cli/src/utils/dashboard-utils.ts` containing `pollForPortFile`, `checkServiceAlive`, and `PORT_FILE_NAME` re-export. Both commands import from that utility. The `findEntryScript` variants would unify to one function returning `string | null`. This would also be the right place to consolidate the `STARTUP_TIMEOUT_MS` constant.

---

## Findings

### [BLOCKING] Duplicated `pollForPortFile` with identical implementation

File: `packages/cli/src/commands/dashboard.ts:52–63` and `packages/cli/src/commands/run.ts:161–172`

Issue: The function is copied character-for-character. The project's existing review lesson is explicit: "Shared logic must live in exactly one place." This is not a style preference — two diverging copies of a polling loop will produce different timeout behaviour as soon as one is patched.

Fix: Extract to `packages/cli/src/utils/dashboard-utils.ts`, export it, and import it in both commands.

---

### [BLOCKING] `PORT_FILE_NAME` redeclared in both CLI files instead of imported from the package

File: `packages/cli/src/commands/dashboard.ts:7` and `packages/cli/src/commands/run.ts:12`

Issue: `dashboard-service/src/index.ts` exports `PORT_FILE_NAME` at line 12. Both CLI files ignore that export and redefine it locally. If the service package changes the filename (e.g., to `.nitro-port`), the CLI silently looks at the wrong file. This is exactly the "single source of truth" violation the review lessons flag for version strings and enum values. The same principle applies to any canonical constant.

Fix: Import `PORT_FILE_NAME` from `@nitro-fueled/dashboard-service` in both CLI command files, or move it to the shared utility.

---

### [SERIOUS] `findEntryScript()` returns a non-existent path instead of `null`

File: `packages/cli/src/commands/dashboard.ts:18–30`

Issue: When neither candidate path exists, the function returns `candidates[1]` — a path that does not exist — rather than `null`. The caller then calls `existsSync(entryScript)` and reports an error, which appears correct, but the function's return type is `string` with no indication it may be a lie. Compare to `findDashboardEntryScript()` in `run.ts:149–159` which correctly returns `string | null`. The inconsistent contract means future call sites for `findEntryScript` may skip the `existsSync` guard, causing a runtime crash.

Fix: Change the return type to `string | null`, return `null` when no candidate exists, and adjust the call site to handle `null` directly.

---

### [SERIOUS] `checkExistingService` logic duplicated inline in `startDashboardService`

File: `packages/cli/src/commands/dashboard.ts:65–81` and `packages/cli/src/commands/run.ts:184–200`

Issue: The "read port file, parse port, fetch `/health`, return port if ok" pattern is the same in both places. `run.ts` inlines it rather than calling `checkExistingService`. Same divergence risk as `pollForPortFile` — the timeout is 1000ms in both today, but future callers will not know to keep them in sync.

Fix: Move to shared utility, same as `pollForPortFile`.

---

### [SERIOUS] Two constants for the same startup timeout with different names

File: `packages/cli/src/commands/dashboard.ts:9` (`STARTUP_TIMEOUT_MS = 8000`) and `packages/cli/src/commands/run.ts:13` (`DASHBOARD_STARTUP_TIMEOUT_MS = 8000`)

Issue: Same value, same purpose, different names. The inconsistency signals they are unrelated to a reader who does not know the history. When someone changes the timeout in one file, they will not know to update the other.

Fix: Single constant in shared utility, imported by both commands.

---

### [SERIOUS] Unhandled rejection in `pollForPortFile.then().catch()`

File: `packages/cli/src/commands/dashboard.ts:175–183`

```typescript
pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS).then((actualPort) => {
  ...
}).catch(() => {});
```

Issue: The `.catch(() => {})` silently swallows any polling error. `pollForPortFile` itself can throw if `readFileSync` raises an exception (e.g., a file appears but is immediately deleted, causing ENOENT). The review lessons are explicit: "Never swallow errors — at minimum, log them. No empty catch blocks." (review-general.md)

Fix: At minimum log the error: `.catch((err) => { console.warn('Warning: error while polling for port file:', err); })`.

---

### [SERIOUS] Signal handler registration in `run.ts` is not idempotent and leaks handlers

File: `packages/cli/src/commands/run.ts:303–305`

```typescript
process.on('exit', shutdownDashboard);
process.on('SIGINT', () => { shutdownDashboard(); process.exit(0); });
process.on('SIGTERM', () => { shutdownDashboard(); process.exit(0); });
```

Issue: These handlers are registered unconditionally inside the `action` callback. If `registerRunCommand` somehow fires more than once, or if the action is invoked in a test, handlers stack. More practically: the `SIGINT`/`SIGTERM` handlers call `process.exit(0)` directly without waiting for the async `stop()` in `DashboardService`. If the dashboard service is still flushing, the port file will not be cleaned up before the process exits. (The `dashboard.ts` signal handlers in `registerShutdownHandlers` do await `stop()` properly.)

Fix: Store a `didRegister` flag or use `process.once`. Also forward the signal to the dashboard child process (which already has proper shutdown handlers) rather than calling `process.exit` directly from the parent.

---

### [MINOR] `exec` imported but used unsafely for browser open

File: `packages/cli/src/commands/dashboard.ts:3`, `packages/cli/src/commands/dashboard.ts:49`

```typescript
exec(`${command} ${url}`, () => {});
```

Issue: The URL is interpolated directly into the shell command string without escaping. If `url` ever contains a space or shell metacharacter (unlikely for a localhost URL but possible if the port is somehow injected), this is a shell injection. The error callback `() => {}` also silently swallows failures. Not critical for a localhost URL but it is sloppy. Use `execFile` or `spawn` with an args array instead of string interpolation.

Fix: `execFile(command, [url], () => {})` — removes shell parsing entirely.

---

### [MINOR] `resolve` imported but not used in `dashboard.ts`

File: `packages/cli/src/commands/dashboard.ts:2`

```typescript
import { resolve, join, dirname } from 'node:path';
```

Issue: `resolve` is used on lines 92, 129, 130 — it is actually used. However, the import order within `node:path` is `resolve, join, dirname` while the actual usage order in the file is `dirname` (line 19), `resolve` (line 92, 129, 130), `join` (line 108, 51). This is a minor style inconsistency — import order within a destructure ideally reflects frequency or call order, though it is not a hard rule.

(Downgraded from issue to observation — imports are used, just ordered differently from usage.)

---

### [MINOR] `DashboardOptions.open` has a misleading boolean default comment

File: `packages/cli/src/commands/dashboard.ts:15`

```typescript
open: boolean; // false when --no-open is passed
```

Issue: The comment says "false when --no-open is passed" but the Commander `--no-open` flag makes `open` default to `true` and sets it to `false` only when the flag is provided. The comment is not wrong, but it is incomplete — it would more accurately say "true by default; false when --no-open is passed." A new contributor reading the interface in isolation might think the default is `false`.

Fix: Update comment: `open: boolean; // true by default; false when --no-open is passed`

---

### [MINOR] Magic number `0` for auto-assign port appears inline in `run.ts`

File: `packages/cli/src/commands/run.ts:203`

```typescript
const args = [entryScript, '--task-tracking-dir', taskTrackingDir, '--port', '0'];
```

Issue: `dashboard.ts` defines `DEFAULT_PORT = 0` with a comment explaining `0 = OS auto-assigns a free port`. `run.ts` inlines `'0'` without that context. Minor readability issue but consistent with the broader duplication problem.

---

## File-by-File Analysis

### `packages/dashboard-service/src/index.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

The service file is the cleanest of the four. `DashboardService` has proper access modifiers, typed fields, and clear lifecycle methods. `start()`/`stop()` are symmetric. The `registerShutdownHandlers` properly uses `void` to handle the floating Promise from `shutdown()`.

**Specific Concerns**:

1. Line 46: `(res)` as the Promise resolve parameter name — `res` shadows the common convention for HTTP responses. `resolve` would be clearer. Same on line 75. Minor.
2. Line 29: `httpServer: Server | null = null` — the only non-readonly field. This is intentional (lifecycle state), but the asymmetry with all-readonly peers is worth a comment explaining why it is mutable.

---

### `packages/cli/src/commands/dashboard.ts`

**Score**: 4/10
**Issues Found**: 2 blocking, 2 serious, 2 minor

This file contains the root source of the duplication problem. `findEntryScript` has the lying return type. The empty `.catch` is here. The `PORT_FILE_NAME` re-declaration is here.

**Specific Concerns**:

1. Lines 18–30: `findEntryScript()` returns a non-existent path — SERIOUS (see above).
2. Lines 52–63: `pollForPortFile` duplicate — BLOCKING.
3. Lines 7: `PORT_FILE_NAME` local re-declaration — BLOCKING.
4. Lines 175–183: empty `.catch` — SERIOUS.
5. Line 49: shell interpolation in `exec` — MINOR.

---

### `packages/cli/src/commands/run.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

`run.ts` is the consumer of the duplication. Its copies of `pollForPortFile` and the health-check inline are well-written in isolation, but their existence is the problem. The signal handler issue is in this file.

**Specific Concerns**:

1. Lines 161–172: `pollForPortFile` duplicate — BLOCKING (same function as dashboard.ts).
2. Lines 184–200: inline health-check duplicate — SERIOUS.
3. Lines 303–305: signal handlers that `process.exit(0)` without awaiting dashboard shutdown — SERIOUS.
4. Line 13: `DASHBOARD_STARTUP_TIMEOUT_MS` vs `STARTUP_TIMEOUT_MS` naming inconsistency — SERIOUS.
5. Line 203: magic `'0'` for port — MINOR.

---

### `package.json`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

The root `package.json` is minimal and correct. Workspace configuration is standard. The `build:dashboard` script correctly orders web before service. The `engines` node constraint is appropriate.

**Specific Concerns**:

1. The `"dashboard"` convenience script (`node packages/cli/dist/index.js dashboard`) requires that `packages/cli` has already been built, but there is no `build:cli` prerequisite expressed in the command. A developer who runs `npm run dashboard` after a fresh clone with only `build:dashboard` completed will get a confusing "cannot find module" error. Consider renaming to make it clear it requires a prior build, or add a `&&` chain.

---

## Pattern Compliance

| Pattern | Status | Concern |
|---|---|---|
| TypeScript access modifiers | PASS | All class members in service have explicit modifiers |
| No `any` types | PASS | None found |
| No `as` type assertions | PASS | None found |
| Single source of truth for constants | FAIL | PORT_FILE_NAME and STARTUP_TIMEOUT_MS duplicated across files |
| No empty catch blocks | FAIL | dashboard.ts:183 `.catch(() => {})` |
| Shared logic in utils | FAIL | pollForPortFile and health-check logic duplicated |
| Consistent function return types for same operation | FAIL | findEntryScript vs findDashboardEntryScript |
| Import from canonical source | FAIL | PORT_FILE_NAME re-declared instead of imported |

---

## Technical Debt Assessment

**Introduced**: Three duplication points (`pollForPortFile`, health-check logic, `PORT_FILE_NAME`) that will diverge under maintenance. A lying return type on `findEntryScript`. An empty catch that hides startup failures.

**Mitigated**: None — this is net new code.

**Net Impact**: Negative. The duplication is avoidable and the shared utility would have been 30 lines. The debt is small today but the pattern will be copied by future commands.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: Two functions named differently for the same job, with different contracts, in files that should share a utility. This is a textbook extraction candidate that was skipped. Fix the shared utility before this ships — the individual files are otherwise readable and correct.

---

## What Excellence Would Look Like

A 9/10 implementation would:

1. Have a `packages/cli/src/utils/dashboard-utils.ts` containing `pollForPortFile`, `checkServiceAlive(portFilePath): Promise<number | null>`, `openBrowser(url)`, and a re-export of `PORT_FILE_NAME` from the service package.
2. Both `dashboard.ts` and `run.ts` import from that utility — zero duplicated logic.
3. `findEntryScript` returns `string | null` in both files (or is extracted to the same utility with one implementation).
4. `STARTUP_TIMEOUT_MS` is one constant, one location.
5. The `.catch` in `dashboard.ts` logs rather than swallowing.
6. Signal handlers in `run.ts` await dashboard process shutdown rather than calling `process.exit` directly.
