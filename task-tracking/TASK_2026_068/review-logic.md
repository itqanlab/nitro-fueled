# Logic Review — TASK_2026_068

## Verdict
REVISE

## Score
5/10

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `runUnloadMode` calls `writeConfig()` after `delete config.providers[provider]`. If `writeConfig` throws (disk full, permission denied), the error propagates to the `.action()` handler which has no try/catch. The CLI crashes with a raw Node.js stack trace. The user sees an unformatted error, and `process.exitCode` may not have been set before the throw — so from a CI perspective the exit code is non-deterministic.

- `runProvidersPhase` calls `writeConfig(cwd, config)` at line 146 unconditionally even when the user chose [K]eep for every provider. An I/O error here throws unhandled from the `.action()` async callback with no user-visible message and no guaranteed non-zero exit code.

- OpenCode "connected" status in `getProviderStatus` is derived purely from API key presence — not a live test. A user who sees "✓ OpenCode connected" in the status table and chooses [K]eep based on that display may have a broken OpenCode that will fail at runtime. No caveat is printed. This is a semantically misleading success signal.

### 2. What user action causes unexpected behavior?

- A user who presses Ctrl+C during the `[T]est` GLM connection attempt will interrupt `testGlmConnection`, which is wrapped in a `fetch` with `AbortSignal.timeout(10_000)`. The outer `prompt()` call may leave the terminal in raw mode depending on how `prompt.js` is implemented. No cleanup path is visible in the reviewed files. This is a surface risk, not a certainty — but no SIGINT handler is present.

- A user who runs `--unload` with a provider name in mixed case, e.g. `--unload GLM`, gets the error "Unknown provider 'GLM'" because the validation check lowercases the input but the error message prints the original `providerArg`. The check on line 73 is correct (`lower as UnloadableProvider`), so the matching works, but see Finding 1 below for an edge case with `enabled: false`.

- A user configures GLM (sets `enabled: true`) then manually edits config to set `enabled: false` (to temporarily disable without removing). When they run `config --providers` again:
  - `glmCurrent` (from `config.providers.glm`) is NOT `undefined` — the object exists.
  - `glmStatus?.status` in `getProviderStatus` returns `'not configured'` because `glm?.enabled === true` is false.
  - So the condition `glmCurrent !== undefined && glmStatus?.status !== 'not configured'` evaluates to `true && false` = `false`.
  - They fall into `runGlmFirstTimeMenu()` even though GLM is configured (just disabled).
  - The first-time menu says "currently: not configured" even though there IS a config entry.
  - If the user skips, the `enabled: false` entry is silently preserved in config (not touched by first-time path). If they configure, the old entry is overwritten. This is the most material logic bug in this task.

### 3. What data makes this produce wrong results?

- Config with `glm: { enabled: false, ... }` — see above. The routing condition misroutes to first-time menu.

- Config with `opencode: { enabled: false, ... }` — same class of bug. `opencodeCurrent !== undefined` is true, but `openCodeStatus?.status !== 'not configured'` is false (because `getProviderStatus` gates on `enabled === true`). The user is dropped into first-time menu for an already-configured-but-disabled provider. If they skip, `enabled: false` is preserved silently. There's no "re-enable" path shown.

- `writeConfig` not using write-to-temp + `renameSync`. This is a pre-existing issue but it exists in the mutation path touched by this task. If the process is killed during `writeFileSync`, config is truncated to zero bytes or partially written. The next `readConfig` call sees it as malformed and warns, effectively losing all provider configuration. (Lesson from TASK_2026_059.)

- `reconfigureGlm` called from the [T]est flow: this function is NOT called from test, correctly. The `runGlmMenu` function returns `{ action: 'keep' }` after the test. Correct. No data integrity bug here.

### 4. What happens when dependencies fail?

- `testGlmConnection` is called inside `runGlmMenu` (the [T] choice) with `existing.apiKey` and `existing.baseUrl`. `existing` is typed `GlmProviderConfig` with required `apiKey` and `baseUrl`. No null guard needed here — good.

- `getProviderStatus` calls `testGlmConnection` on every invocation of `runProvidersPhase`. If the GLM API is slow (e.g., 9.5s, just under the 10s timeout), the initial status table paint is blocked for 9.5 seconds with no spinner or progress indication. The user sees a blank screen. This is a UX freeze, not a crash, but it degrades trust.

- `writeConfig` calls `mkdirSync` only if `!existsSync(dir)`. There is a TOCTOU window: another process could remove the directory between the check and `mkdirSync`. This is pre-existing but is now in the hot path for every menu completion. Risk is low in practice but the pattern is a known anti-pattern.

- `spawnSync('npm', ['i', '-g', 'opencode'], { stdio: 'inherit' })` in `reconfigureOpenCode`: if the user does not have permission to write to the global npm prefix, `result.status` is non-zero and the install fails. The code handles this correctly by returning `null`. However, `spawnSync` with `stdio: 'inherit'` means any npm error output goes directly to the terminal, which is correct behavior.

### 5. What's missing that the requirements didn't mention?

- No handling of the `enabled: false` state. The acceptance criteria says `[U]nload` "sets `enabled: false` or removes the key entirely." The implementation chose to `delete config.providers[provider]` (removes entirely). That is acceptable per the spec, but the routing condition in `runProvidersPhase` does not account for the fact that a provider entry can exist with `enabled: false` — making the state table and first-time-menu behavior wrong for that case.

- No `--unload` flag confirmation prompt. The command is non-interactive and destructive. A user who runs `nitro-fueled config --unload glm` immediately removes GLM config with no undo. An `--unload --force` guard or at minimum an "are you sure?" for the interactive path would be safer. The spec does not require this, but it's a gap the spec itself missed.

- The `--test` and `--unload` flags can be combined (`config --test --unload glm`). The priority ordering in `.action()` evaluates `reset` → `unload` → `test` → `check`. Combining `--test --unload` silently runs only unload. Combining `--reset --test` silently runs only reset. No conflict detection.

- `runTestMode` sets `process.exitCode = 1` only if a provider has `status === 'failed'`. If ALL providers are 'not configured', the function exits 0. A CI pipeline checking `--test` for connectivity will get exit 0 even if no provider is reachable. This may or may not be intended, but it's surprising.

---

## Findings

### [BLOCKING] `enabled: false` provider entry routes to first-time menu
File: `packages/cli/src/commands/config.ts:113` and `:132`

When a provider entry exists in config but has `enabled: false`, `getProviderStatus` reports `'not configured'` for it (because it gates on `enabled === true`). The routing condition `glmCurrent !== undefined && glmStatus?.status !== 'not configured'` then evaluates to `false`, so the user sees the first-time `[C]onfigure / [S]kip` menu instead of the full `[K]eep / [R]econfigure / [T]est / [U]nload` menu. The display also says "currently: not configured" even though a config entry exists.

The fix is to separate "has a config entry" from "is enabled and connected." The routing condition should be `glmCurrent !== undefined` alone (entry exists → show management menu). The `currentStatus` label passed to the menu function already communicates the connection state.

### [BLOCKING] No try/catch around `writeConfig` in `runUnloadMode` or `runProvidersPhase`
File: `packages/cli/src/commands/config.ts:90`, `packages/cli/src/commands/config.ts:146`

`writeConfig` calls `mkdirSync` and `writeFileSync`, both of which can throw (disk full, permission denied, EROFS). Neither call site has a try/catch. The async `.action()` callback is not wrapped in a top-level error handler. A disk write failure produces a raw Node.js stack trace to the user and exits with a non-deterministic exit code — violating the "Config/init failures must block with a clear message" anti-pattern rule.

Fix: wrap both call sites in try/catch, print a human-readable error, and set `process.exitCode = 1` before returning.

### [BLOCKING] `writeConfig` uses `writeFileSync` without write-to-temp + rename
File: `packages/cli/src/utils/provider-config.ts:82`

`writeFileSync` truncates the file before writing. A SIGKILL, OOM, or power loss mid-write leaves a zero-byte or partially-written config file. On next startup, `readConfig` emits a warning and returns `null`, losing all provider configuration. This is a known production anti-pattern (TASK_2026_059). The fix is: write to `configPath + '.tmp'`, then call `renameSync(tmp, configPath)` — which is atomic on POSIX. This affects every mutation path in this task.

Note: `provider-config.ts` was not listed as a changed file in this task, but this is an existing defect that the task's new mutation paths (unload, reconfigure) are directly exposed to.

### [MINOR] `--test` exits 0 when no providers are configured
File: `packages/cli/src/commands/config.ts:66-68`

`runTestMode` only sets `process.exitCode = 1` when a provider has `status === 'failed'`. If all providers (GLM, OpenCode) are `'not configured'`, the command exits 0. A CI pipeline using `--test` to gate deployment will see 0 even if the project has no working providers. Consider also failing (or at minimum warning) when zero non-Claude providers are connected, or document the intended behavior in help text.

### [MINOR] GLM live test in `getProviderStatus` blocks with no feedback
File: `packages/cli/src/utils/provider-status.ts:37`

`testGlmConnection` is awaited inline during the status table build with a 10-second timeout. There is no spinner, progress message, or "testing connection..." output before the await. If the connection is slow, the user stares at a blank screen after typing `config --providers`. The accepted UX spec shows the table printing before prompts — but if the table itself takes 10 seconds to render, the UX is frozen.

Fix: print "Checking providers..." before the `getProviderStatus` call in `runProvidersPhase` (and `runTestMode`/`runCheckMode`).

### [MINOR] Flag conflict not detected — silent priority ordering
File: `packages/cli/src/commands/config.ts:174-198`

`--reset --test`, `--test --unload`, `--unload --check` are all silently accepted. The first matching flag in the if-chain wins and the rest are ignored. Users who accidentally combine flags get no warning. Add a mutual exclusion check at the top of the action handler that errors and exits with a usage message if more than one mode flag is set.

### [MINOR] `runGlmFirstTimeMenu` returns `{ action: 'keep' }` on user abort (Ctrl+C / cancelled reconfigure)
File: `packages/cli/src/utils/provider-flow.ts:82`

When `reconfigureGlm(undefined)` returns `null` (user declined to save after a failed connection test), the function returns `{ action: 'keep' }`. For a first-time setup where there is nothing to keep, this is semantically misleading — the result looks identical to "user typed K on an existing provider." The caller in `config.ts:123` only acts on `result.action === 'reconfigure'`, so no wrong mutation happens, but a future change that also handles `'keep'` differently could break this.

Consider returning `{ action: 'skip' }` from `runGlmFirstTimeMenu` consistently (the type already allows it on OpenCode's first-time menu). The `GlmMenuResult` union would need to add `'skip'`, which is a minor type change.

### [SUGGESTION] OpenCode status is "connected" based on key presence, not live test — no disclosure
File: `packages/cli/src/utils/provider-status.ts:50-55`

The status table shows `✓ OpenCode connected` but this is inferred from key presence, not a live API call. This is intentional (no live test for OpenCode), but the table gives no indication of this. A user who acts on this green checkmark and discovers OpenCode is actually broken only finds out at runtime. Adding a note like `(key present — not tested)` or changing the status to `'key present'` would be more honest. This does not meet the bar for BLOCKING but it is a UX truthfulness gap.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Show current provider state before prompts | COMPLETE | GLM live test may block for up to 10s with no feedback |
| Per-provider menu [K]eep [R]econfigure [T]est [U]nload | COMPLETE | Routing breaks for `enabled: false` entries (BLOCKING) |
| [T]est reruns connection test, no config change | COMPLETE | Correct — returns `keep` without mutation |
| [U]nload removes provider | COMPLETE | Removes entry entirely (not `enabled: false`) — valid per spec |
| [K]eep default on Enter | COMPLETE | Correct |
| [R]econfigure runs configure flow | COMPLETE | Correct |
| `--test` flag tests all providers and exits | COMPLETE | Exits 0 when no providers configured — surprising |
| `--unload <provider>` non-interactive removal | COMPLETE | No conflict detection with `--test` or `--check` |
| Unknown provider name for `--unload` shows error + exits non-zero | COMPLETE | Correct |
| `--reset` unchanged | COMPLETE | Correct |

### Implicit Requirements NOT Addressed

1. `enabled: false` is a valid config state (per the spec's own wording "sets enabled:false or removes the key entirely") but is never routed to the management menu — users in this state get first-time prompts.
2. No atomic config write — mid-write crash loses all configuration.
3. No error boundary around `writeConfig` — disk failures produce raw stack traces.
4. Flag mutual exclusion — multi-flag combinations silently pick a winner.
