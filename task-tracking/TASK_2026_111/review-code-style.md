# Code Style Review — TASK_2026_111

## Verdict
REVISE

## Review Summary

| Metric          | Value         |
|-----------------|---------------|
| Overall Score   | 5/10          |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3             |
| Serious Issues  | 4             |
| Minor Issues    | 3             |
| Files Reviewed  | 7             |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`libs/worker-core/src/types.ts` now defines `LauncherInfo`, `ProviderEntry`, `NitroFueledConfig`, `LauncherName`, and `ModelTier`. The same types already exist in `apps/cli/src/utils/provider-config.ts` with a richer shape. The two definitions will drift the moment anyone updates one without updating the other. `LauncherInfo.models` is already inconsistent (`string[]` in `types.ts` vs `Record<ModelTier, string>` in `ProviderEntry.models` in `provider-config.ts`). This is a silent contract break that will not fail at compile time because the packages are compiled independently.

### 2. What would confuse a new team member?

`apps/session-orchestrator/src/tools/spawn-worker.ts` imports `NitroFueledConfig` via `@nitro-fueled/worker-core` (i.e., `types.ts`), while `apps/cli/src/utils/complexity-estimator.ts` imports the same-named type from `./provider-config.js`. A developer trying to understand the config schema will find two authoritative definitions and no guidance on which is canonical. The `NitroFueledConfig.routing` field is `Partial<Record<string, string>>` in `types.ts` but `RoutingConfig` (a named union of specific slots) in `provider-config.ts` — same field, different types.

### 3. What's the hidden complexity cost?

`provider-resolver.ts` re-implements config reading, type guards, and launcher availability checks that already exist in `provider-config.ts`. This is ~130 lines of parallel infrastructure that must be maintained alongside the original. Every future config schema change (new launcher, new routing slot) must now be applied in three places: `types.ts`, `provider-config.ts`, and `provider-resolver.ts` type guards.

### 4. What pattern inconsistencies exist?

- `provider-resolver.ts:parseConfigFile` silently returns `null` on error with no logging. `provider-config.ts:parseConfigFile` logs a human-readable warning. Same function, different behavior, no explanation.
- `codex-launcher.ts` `args` array passes `opts.prompt` as the last positional argument. `opencode-launcher.ts` does the same. Neither handles prompts containing shell-special characters. This is a latent issue, but the inconsistency with `print-launcher.ts` (which uses `--print` flag) is undocumented.
- `spawn-worker.ts` Phase 2 re-validation is gated on `args.provider !== undefined && args.model !== undefined`. A worker spawned via the orchestrator with only `provider` (no explicit `model`) skips re-validation entirely. The task spec does not call out this gap.

### 5. What would I do differently?

The config types belong in `@nitro-fueled/worker-core/types.ts` as the single canonical definition. `provider-config.ts` should import from the shared library instead of defining its own version. Until that refactor is feasible, `provider-resolver.ts` should import `NitroFueledConfig` from `provider-config.ts` via a cross-package import path or the shared types file — not define a third copy. The duplicate fallback attempt for `anthropic` in `resolveProviderForSpawn` (lines 147–154 of `provider-resolver.ts`) should be removed since the preceding loop already covers it.

---

## Blocking Issues

### Issue 1: Duplicate type definitions create a silent contract break

- **File**: `libs/worker-core/src/types.ts` lines 46–65, `apps/cli/src/utils/provider-config.ts` lines 15–59
- **Problem**: `LauncherName`, `ModelTier`, `LauncherInfo`, `ProviderEntry`, and `NitroFueledConfig` are now defined in both files. The two definitions are already inconsistent: `LauncherInfo.models` is `string[]` in `types.ts` but `ProviderEntry.models` uses `Record<ModelTier, string>` in `provider-config.ts`. `NitroFueledConfig.routing` is `Partial<Record<string, string>>` in `types.ts` vs the named `RoutingConfig` type in `provider-config.ts`. These packages compile independently, so divergence is invisible until a runtime boundary is crossed.
- **Impact**: Any consumer that reads `LauncherInfo.models` as `string[]` from `worker-core` will be incompatible with a consumer that reads it as `Record<ModelTier, string>` from `provider-config.ts`. Mismatches are runtime failures, not compile errors.
- **Fix**: Choose one canonical location. The cleanest resolution is to make `provider-config.ts` import `NitroFueledConfig`, `LauncherName`, `ModelTier`, `LauncherInfo`, and `ProviderEntry` from `@nitro-fueled/worker-core/types` and re-export them. Remove the duplicate definitions from `provider-config.ts`. If cross-package imports are not currently set up, at minimum add a comment to both files citing the coupling and ensure the shapes are byte-for-byte identical before merging.

### Issue 2: `resolveProviderForSpawn` last-resort fallback block is unreachable dead code

- **File**: `libs/worker-core/src/core/provider-resolver.ts` lines 147–154
- **Problem**: The function walks ALL keys in `config.providers` (lines 140–144), which includes `'anthropic'`. It skips only the originally-requested provider. So if `anthropic` is in the config and available, it will be returned from the loop. The explicit anthropic block after the loop (lines 147–154) can only run if `anthropic` was somehow found by `Object.keys` but not returned — which is structurally impossible. This dead block reads as intentional logic to a future maintainer.
- **Impact**: No runtime impact today, but the dead code misleads readers into thinking there is a special two-step anthropic fallback. If the loop is ever changed to exclude anthropic, the dead block still will not catch it because of the `FALLBACK_PROVIDER.providerName` lookup against the config.
- **Fix**: Remove lines 147–154. The hardcoded `FALLBACK_PROVIDER` constant still serves its purpose as documentation of the ultimate last resort, but the code path does not need to be duplicated. Add a comment noting that anthropic is covered by the loop.

### Issue 3: Phase 2 re-validation is skipped when `model` is not explicitly set

- **File**: `apps/session-orchestrator/src/tools/spawn-worker.ts` line 46
- **Problem**: The guard `if (args.provider !== undefined && args.model !== undefined)` means that if a caller passes `provider: 'opencode'` without `model`, the entire Phase 2 re-validation block is bypassed and the hardcoded `DEFAULT_MODEL` is used without checking whether the opencode launcher is still available. A caller passing only `provider` (which is valid per the schema — `model` is optional) never gets a fallback.
- **Impact**: The task spec requirement "Phase 2: before each spawn_worker call, resolver re-validates launcher availability" is not fully satisfied. If the opencode launcher goes offline between task creation and spawn, a worker with no explicit `model` will attempt to spawn with an unavailable launcher and fail mid-run.
- **Fix**: Run Phase 2 when `args.provider !== undefined`, regardless of whether `args.model` is set. Pass `DEFAULT_MODEL` as the model argument to `resolveProviderForSpawn` when `args.model` is undefined.

---

## Serious Issues

### Issue 4: `provider-resolver.ts` silent config parse failure vs `provider-config.ts` logged warning

- **File**: `libs/worker-core/src/core/provider-resolver.ts` lines 52–59
- **Problem**: `parseConfigFile` catches all errors and returns `null` with no logging. The equivalent function in `provider-config.ts` (lines 103–115) logs a human-readable warning directing the user to `npx nitro-fueled config`. A user whose config file is corrupted will see no feedback from the session-orchestrator path, only silent degradation to the fallback provider.
- **Tradeoff**: The worker-core library may not want a `console.warn` dependency. But swallowing config errors entirely violates the anti-patterns rule "Config/init failures at startup must block with a clear message".
- **Recommendation**: Either log the warning (matching `provider-config.ts` behavior) or return a typed result that distinguishes "file absent" from "file corrupt" so the caller can surface the error.

### Issue 5: `exitCodes` Map never purges — memory leak in long-running orchestrator

- **File**: `libs/worker-core/src/core/codex-launcher.ts` line 19, `libs/worker-core/src/core/opencode-launcher.ts` line 19
- **Problem**: Both launchers share the same pattern: a module-level `Map<number, number>` accumulates exit codes and is never pruned. In a long-running session-orchestrator process that spawns hundreds of workers, this is a monotonically growing Map. The same issue exists in `opencode-launcher.ts` and was not addressed in this task.
- **Tradeoff**: PIDs are recycled by the OS eventually, so stale entries will be overwritten — but the Map grows unbounded until process restart. For the current usage scale this is not critical, but it becomes a problem at 10,000+ workers in a continuous deployment.
- **Recommendation**: In `onExit`, after setting the exit code, schedule a cleanup: `setTimeout(() => exitCodes.delete(pid), 60_000)`. This retains the code long enough for callers to read it while preventing unbounded growth.

### Issue 6: `tryProvider` in `provider-resolver.ts` ignores the requested model and picks arbitrarily

- **File**: `libs/worker-core/src/core/provider-resolver.ts` lines 102–115
- **Problem**: `tryProvider` picks the provider's model by preference (`balanced` → `heavy` → `light`), completely ignoring the `model` parameter that was originally requested. If the original task was assigned `gpt-5-heavy` (a specific model), the fallback returns `gpt-5-balanced` with no indication that the model changed — only the provider change is logged (line 52 of `spawn-worker.ts`). The logged message in `spawn-worker.ts` captures `resolved.model`, but `tryProvider` may have silently chosen a different tier.
- **Tradeoff**: Picking any available model is better than failing, but the fallback log message should always report what actually changed (provider AND model). Currently the log only fires when `providerName` or `model` differs, which would catch the model change — but only if `providerName` is unchanged and `model` is the only thing that changed.
- **Recommendation**: The log condition at `spawn-worker.ts:51` (`resolved.providerName !== args.provider || resolved.model !== args.model`) is correct and will catch this. The `tryProvider` model selection behavior should be documented with a comment explaining why tier preference overrides the requested model.

### Issue 7: `complexity-estimator.ts` and `provider-resolver.ts` use different import paths for the same config types

- **File**: `apps/cli/src/utils/complexity-estimator.ts` line 1, `libs/worker-core/src/core/provider-resolver.ts` line 4
- **Problem**: `complexity-estimator.ts` imports `NitroFueledConfig, LauncherName` from `./provider-config.js`. `provider-resolver.ts` imports `NitroFueledConfig, LauncherName` from `../types.js`. These are two different type definitions with the same name. If a `NitroFueledConfig` object obtained from `readConfig()` in `provider-config.ts` is passed to a function in `provider-resolver.ts` that expects `NitroFueledConfig` from `types.ts`, TypeScript will accept it structurally — but the `LauncherInfo.models` field (`string[]` vs nothing in `types.ts`'s `LauncherInfo`) will cause runtime surprises.
- **Recommendation**: Tracked as blocking in Issue 1. This issue is a symptom of the same root cause.

---

## Minor Issues

- **`provider-resolver.ts` line 10**: `FALLBACK_PROVIDER` type annotation is an inline object type `{ providerName: string; model: string; launcher: LauncherName }`. Per project convention, this should be a named exported type or use an existing interface. Minor because it is internal to the module.
- **`spawn-worker.ts` line 42**: `let p: Provider` uses a mutable `let` declaration. The variable is reassigned at most once inside the re-validation block. Using `let` for what is effectively a derived value makes the flow harder to follow. Not a correctness issue.
- **`codex-launcher.ts` line 22**: The `args` array places `opts.prompt` as the final positional argument. If the `codex exec` CLI requires the prompt as a flag (e.g., `--prompt`) rather than a positional, this will fail silently at runtime. The task spec says `codex exec --model <model> <prompt>` suggesting positional is correct, but this should be validated against `codex exec --help` output. No risk if spec is accurate.

---

## File-by-File Analysis

### `libs/worker-core/src/core/codex-launcher.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: Correctly mirrors `opencode-launcher.ts` as specified. Structure is clean, types are correct, and the `onExit` handler guards against null/zero pid before storing. The minor concern is the unreleased `exitCodes` Map (Issue 5). The `process` field on `CodexLaunchResult` is exported but not used by `spawn-worker.ts` — this is consistent with the other launchers but is unused API surface.

**Specific Concerns**:
1. Line 19: Module-level `exitCodes` Map grows unbounded (shared with opencode-launcher pattern — Issue 5)
2. Line 22: Positional prompt argument should be verified against `codex exec --help`

---

### `libs/worker-core/src/core/provider-resolver.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 2 serious, 1 minor

**Analysis**: The logic for config merging and fallback chain is sound in intent. The type guards are thorough and avoid `as` assertions. However, the unreachable anthropic fallback block (Issue 2), the silent error swallowing (Issue 4), the model selection ignoring the requested model (Issue 6), and most critically the duplication of types that already exist in `provider-config.ts` (Issue 1) are all significant problems.

**Specific Concerns**:
1. Lines 147–154: Dead code — anthropic already covered by loop on lines 140–144 (Issue 2)
2. Lines 52–59: Silent config parse failure with no logging (Issue 4)
3. Lines 4–5: Imports types from `../types.js` that are a different definition from `provider-config.ts` (Issue 1)
4. Lines 102–115: `tryProvider` model selection ignores requested model, only documented implicitly (Issue 6)

---

### `libs/worker-core/src/types.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

**Analysis**: The pre-existing types are fine. The new additions (`LauncherName`, `ModelTier`, `LauncherInfo`, `ProviderEntry`, `NitroFueledConfig`) are typed correctly in isolation, but `LauncherInfo.models: string[]` is already inconsistent with how models are represented elsewhere. The `routing` field type (`Partial<Record<string, string>>`) is weaker than the `RoutingConfig` in `provider-config.ts`. This file should not own these types — it creates the dual-definition problem (Issue 1).

**Specific Concerns**:
1. Lines 49–53: `LauncherInfo.models: string[]` contradicts `ProviderEntry.models: Record<ModelTier, string>` — `models` on a launcher is a list of supported model strings, but `models` on a provider entry is a tier-keyed map. These are genuinely different concepts but the field names collide and will confuse readers
2. Lines 61–65: `NitroFueledConfig.routing: Partial<Record<string, string>>` loses the slot-name type safety present in `RoutingConfig` in `provider-config.ts`

---

### `libs/worker-core/src/index.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean barrel export. New exports follow the exact pattern established by `opencode-launcher.ts`. `FALLBACK_PROVIDER` is exported from `provider-resolver.ts` — appropriate since callers may need to reference the constant.

---

### `apps/cli/src/utils/complexity-estimator.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: The `resolveProviderForTier` function is well-structured with a clean fallback chain. The `TIER_TO_MODEL_TIER` constant is a redundant identity mapping (`heavy→heavy`, etc.) that adds no value — `PreferredTier` and `ModelTier` appear to be the same union under different names, which itself signals a naming/architecture issue. The import of `NitroFueledConfig, LauncherName` from `./provider-config.js` is correct for the CLI package but diverges from the `types.ts` definitions (Issue 7 / Issue 1).

**Specific Concerns**:
1. Lines 130–134: `TIER_TO_MODEL_TIER` is an identity map. `PreferredTier` and `ModelTier` are the same union. Either use `ModelTier` directly as the function parameter, or document why two names exist for the same concept.
2. Line 1: Imports from `provider-config.js` while `provider-resolver.ts` imports equivalent types from `types.js` (Issue 1 symptom)

---

### `apps/cli/src/commands/create.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Clean and minimal. The provider suggestion is embedded as a prompt note rather than modifying the task.md directly, which is the correct boundary for a CLI command (the AI does the write). The ternary `description.length > 0` guards are consistent with the pre-existing pattern.

**Specific Concerns**:
1. Lines 49–55: The `tierNote` string is assembled via string concatenation with `+=`. For readability, prefer building an array of note lines and joining. Not a correctness issue.

---

### `apps/session-orchestrator/src/tools/spawn-worker.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

**Analysis**: The codex branch (lines 172–215) is a clean copy of the opencode branch. The Phase 2 re-validation block is correctly positioned and logs substitutions. However, the guard condition (Issue 3) means re-validation is skipped in the most common orchestrator case where only `provider` is set without an explicit `model`. The file is 261 lines — above the 200-line limit for handler/service files per project rules. The handler function itself is 220 lines of logic with four distinct execution branches (iterm, opencode, codex, print); this is a responsibility violation.

**Specific Concerns**:
1. Line 46: Phase 2 guard requires both `provider` AND `model` — should only require `provider` (Issue 3)
2. Lines 1–261: File is 261 lines. The four provider branches (`iterm`, `opencode`, `codex`, `print`) should each be an extracted helper. `handleSpawnWorker` currently does launcher selection AND registration AND output formatting for four different code paths.

---

## Pattern Compliance

| Pattern                    | Status | Concern                                                              |
|----------------------------|--------|----------------------------------------------------------------------|
| No `as` type assertions    | PASS   | Type guards used throughout — no `as` casts                         |
| No `any` types             | PASS   | All new code uses typed or `unknown` properly                        |
| String unions for enums    | PASS   | `Provider`, `LauncherName`, `ModelTier` are proper unions            |
| No duplicate type defs     | FAIL   | Config types defined in both `types.ts` and `provider-config.ts`    |
| File size limits           | FAIL   | `spawn-worker.ts` is 261 lines (limit: 200 for handlers)            |
| Error handling             | FAIL   | Config parse errors silently return null in `provider-resolver.ts`  |
| Single responsibility      | FAIL   | `handleSpawnWorker` handles 4 distinct provider paths inline        |

---

## Technical Debt Assessment

**Introduced**:
- Dual config type definitions across `types.ts` and `provider-config.ts` — this will diverge and cause runtime contract breaks unless addressed immediately
- `provider-resolver.ts` is a parallel implementation of config-reading logic that already exists in `provider-config.ts`

**Mitigated**:
- Hardcoded `if provider === 'opencode'` branches in spawn-worker replaced with config-driven lookup — genuine improvement
- `codex` launcher properly typed and integrated

**Net Impact**: Negative. The dual type definition problem adds more maintenance surface than the hardcoded-branch removal saves.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `LauncherInfo`, `ProviderEntry`, `NitroFueledConfig`, `LauncherName`, and `ModelTier` are now defined twice in the codebase with inconsistent shapes. This is a production incident waiting to happen at the next config schema change. The three blocking issues must be resolved before merge; the dual type definition problem is the most urgent.

---

## What Excellence Would Look Like

A 9/10 implementation would:
1. Add the config types to `libs/worker-core/src/types.ts` as the single canonical location, then update `provider-config.ts` to import and re-export them rather than redefining
2. Have `provider-resolver.ts` import `NitroFueledConfig` from `../types.js` OR from `provider-config.ts` — same type in both cases
3. Remove the dead anthropic fallback block from `resolveProviderForSpawn`
4. Run Phase 2 re-validation whenever `provider` is set (not gated on `model` also being set)
5. Extract the four launcher branches in `handleSpawnWorker` into private helpers to stay within the 200-line file limit
6. Log a warning on config parse failure in `provider-resolver.ts` to match `provider-config.ts` behavior

---

**Score: 5/10**
