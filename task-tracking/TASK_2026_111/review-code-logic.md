# Code Logic Review — TASK_2026_111

## Verdict
REVISE

## Review Summary

| Metric              | Value       |
|---------------------|-------------|
| Overall Score       | 6/10        |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 2           |
| Serious Issues      | 3           |
| Moderate Issues     | 2           |
| Failure Modes Found | 7           |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

Phase 2 re-validation is gated on `args.provider !== undefined && args.model !== undefined`. If either is absent — the common case when the Supervisor passes only a `provider` with no explicit `model`, or when a task's `task.md` only has a `Provider` field — the entire Phase 2 block is silently skipped. No log, no fallback, the code proceeds with whatever defaults were set at the top. The user sees a successful spawn but the provider/model may be stale or unavailable.

`resolveProviderForSpawn` returns `null` when even the hardcoded `anthropic` fallback is unavailable. spawn-worker.ts does not handle this `null` — it silently falls through, keeping `p` and `m` as whatever was set before the Phase 2 block, which may be the same unavailable provider. The worker is then spawned with a known-bad provider. Nothing is logged.

`readProviderConfig` in provider-resolver.ts silently swallows JSON parse errors (`catch { return null; }`). A corrupted config file produces the same behavior as a missing one — no warning, no log. In contrast, the CLI-side `readConfig` in provider-config.ts logs a `console.warn` with the error message. The session-orchestrator path has no visibility into this failure at all.

### 2. What user action causes unexpected behavior?

A user who configures only a `zai` or `openai` provider in their config (no `anthropic` entry) will get `null` from `resolveProviderForSpawn` when that provider goes down. The spawn proceeds with the original unavailable provider, silently, because `null` is not handled.

A user who runs `nitro-fueled create --quick "implement something"` when no config file exists gets no provider suggestion in `task.md` (acceptable). But when the Supervisor later reads `Provider` and `Model` from `task.md` and calls `spawn_worker` with those values, Phase 2 runs. If the config has since been reconfigured and the original provider name no longer matches any config entry, `resolveProviderForSpawn` walks all providers in insertion order and picks the first available — which may be a completely different tier than intended. The substitution is logged, but the task metadata still shows the old provider name.

A user whose config has a provider entry where `models` is present but all values are empty strings (`""`) will pass `isProviderEntry` (it only checks `isRecord(value['models'])`) but then `tryProvider` will catch the empty model check. However, `isProviderEntry` in provider-resolver.ts does NOT validate that `models` contains the expected keys (`heavy`/`balanced`/`light`). A config with `models: { custom: "gpt-5" }` passes `isProviderEntry` but `tryProvider` returns null because `entry.models['balanced']`, `entry.models['heavy']`, and `entry.models['light']` are all undefined. This falls silently to the next provider in the chain with no indication that the config is malformed.

### 3. What data makes this produce wrong results?

**The `glm` provider falls through to print mode with no mapping in Phase 2.** The `Provider` type includes `'glm'`. The resolver's launcher-to-Provider mapping in spawn-worker.ts lines 57-65 maps: `anthropic/launcher=claude → 'claude'`, `launcher=opencode → 'opencode'`, `launcher=codex → 'codex'`. There is no branch for `launcher=claude` when `providerName !== 'anthropic'` — specifically the case where a config entry named `'zai'` uses `launcher: 'claude'`. The mapping correctly catches this via `resolved.launcher === 'claude'` (line 59), which will map ANY `claude`-launched provider to `p = 'claude'`, losing the `'glm'` distinction. This means a GLM/ZAI worker resolved via Phase 2 will be set to `p = 'claude'`, not `p = 'glm'`, and the `launchWithPrint` call at the bottom will receive provider `'claude'` instead of `'glm'`. Whether this matters depends on what `launchWithPrint` does with the provider field, but the provider label in the registry will be wrong.

**`resolveProviderForSpawn` re-uses the requested `model` parameter when the primary provider is valid**, without verifying the specific model still exists in the config. If the user pinned `model: 'gpt-5.4-mini'` in task.md and the config's `providers.openai.models.balanced` has since changed to `'gpt-5'`, Phase 2 returns the old model string unchanged. This is a design choice, but it means Phase 2 does NOT fully re-validate the model — only the launcher availability.

**`ProviderEntry.models` is typed as `Record<ModelTier, string>` (required keys), but the type guard in provider-resolver.ts only checks `isRecord(value['models'])`.** A real config at runtime may have partial models objects (a user who only fills in `balanced`). TypeScript won't catch this at runtime. `tryProvider` reads `entry.models['balanced'] ?? entry.models['heavy'] ?? entry.models['light']` — this works correctly for partial maps since it chains through alternatives. However, `resolveProviderForTier` in complexity-estimator.ts reads `entry.models[modelTier]` directly without chaining fallbacks, so a config with only `balanced` filled in will return `null` for a `heavy` or `light` tier lookup even if the provider is otherwise healthy.

### 4. What happens when dependencies fail?

**Phase 2 config read failure is a silent no-op.** `readProviderConfig` returns `null` on any error. spawn-worker.ts checks `if (config !== null)` and skips Phase 2 entirely if config is null. The worker is spawned with unchecked provider/model. No log entry is written. The operator has no indication Phase 2 was bypassed.

**Phase 2 resolve returning `null` is unhandled.** If `resolveProviderForSpawn` returns `null` (all providers including the hardcoded `anthropic` fallback are unavailable), spawn-worker.ts silently continues with the original `p` and `m` values set at lines 42-43. This means the worker is spawned with a provider that Phase 2 just determined is unavailable. The spawn will likely fail at the subprocess level, but the error will appear in the worker log only — not surfaced to the caller of `handleSpawnWorker`.

**Config file race condition.** `readProviderConfig` calls `existsSync` then `readFileSync`. Between the two calls, the config file could be written atomically by the CLI (which uses a `writeFile + renameSync` pattern). This is a TOCTOU window: `existsSync` returns true, then the rename replaces the file, and `readFileSync` reads the new file. In practice this is benign, but the reverse — exists check passes, file is deleted — would produce an `ENOENT` exception, which is caught by the `try/catch` and returns `null`. Silent fallback.

### 5. What's missing that the requirements didn't mention?

**Memory leak: `exitCodes` Map in codex-launcher.ts is never pruned.** Same issue exists in opencode-launcher.ts (not introduced here, but codex-launcher.ts copies the pattern). Every completed codex worker adds a PID entry to the module-level `exitCodes` Map that is never removed. In long-running session-orchestrator processes that spawn many workers, this accumulates indefinitely. The anti-patterns.md rule "In-memory buffers need size caps" applies.

**The Phase 2 condition `args.provider !== undefined && args.model !== undefined` is too strict.** The task requirements say Phase 2 should run "before each `spawn_worker` call". There is no requirement that the caller must provide both fields — the Supervisor may call spawn_worker with only a provider name (taken from task.md) and rely on the config for model selection. The current gate means Phase 2 is only active when both fields are explicitly set.

**The `'glm'` provider has no mapping path through the resolver.** `LauncherName` in types.ts is `'claude' | 'opencode' | 'codex'`. No launcher is named `'glm'`. The GLM provider uses `launcher: 'claude'` under the hood (as documented in the task spec). The resolver correctly maps this to `p = 'claude'`, but `'glm'` as a resolved providerName is never mapped back to `p = 'glm'`. The `Provider` type still includes `'glm'`, but there is no code path through Phase 2 that produces `p = 'glm'`. The distinction between `'claude'` and `'glm'` workers (which affects env var injection in print-launcher) is permanently lost through the Phase 2 path.

---

## Findings

### [BLOCKING] — `apps/session-orchestrator/src/tools/spawn-worker.ts` — Phase 2 `null` result is silently ignored, spawning with an unavailable provider

When `resolveProviderForSpawn` returns `null` (all providers including the hardcoded anthropic fallback are down), lines 49-68 are skipped entirely because the `if (resolved !== null)` guard exits without action. The code proceeds to spawn with the original `p` and `m` values, which represent a provider that was just confirmed unavailable. The worker launch will fail at the OS level (subprocess exits non-zero or immediately) but nothing in this function indicates the failure to the caller.

**Fix:** When `resolved` is `null`, throw an error or return a structured error response before reaching the spawn calls:
```typescript
if (resolved === null) {
  throw new Error(
    `SPAWN ABORTED — ${args.label}: provider ${args.provider} unavailable and no fallback could be resolved.`
  );
}
```

---

### [BLOCKING] — `apps/session-orchestrator/src/tools/spawn-worker.ts` lines 57-65 — `'glm'` provider identity lost through Phase 2 mapping

The launcher-to-Provider mapping covers three cases: `anthropic/launcher=claude → 'claude'`, `launcher=opencode → 'opencode'`, `launcher=codex → 'codex'`. The `'glm'` provider uses `launcher: 'claude'` and a non-anthropic providerName. It will be caught by `resolved.launcher === 'claude'` and mapped to `p = 'claude'`.

`launchWithPrint` in print-launcher.ts (not reviewed here, but called at line 221) likely uses the `provider` field to set GLM-specific env vars (ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY overrides). Setting `p = 'claude'` instead of `p = 'glm'` causes the print-launcher to omit GLM env setup, launching a worker that will authenticate against Anthropic instead of Z.AI.

**Fix:** Add a check for `providerName` containing GLM-associated names (e.g. `'zai'`, `'glm'`) before the generic `launcher === 'claude'` branch, and map those to `p = 'glm'`. Alternatively, add a `providerType` field to `ProviderEntry` that explicitly carries this distinction.

---

### [MAJOR] — `libs/worker-core/src/core/provider-resolver.ts` lines 52-58 — Silent config parse failure in session-orchestrator context

`parseConfigFile` catches all exceptions and returns `null` with no logging. The CLI-side equivalent (`provider-config.ts` line 107-114) emits a `console.warn` with the file path and error message. In the session-orchestrator, a corrupted or permission-denied config file produces identical behavior to "no config exists", and the operator has no way to distinguish the two cases. Phase 2 is silently skipped.

**Fix:** Add a `console.warn` (or structured log) in the catch block, matching the CLI-side behavior:
```typescript
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`Warning: ${filePath} is unreadable (${msg}). Phase 2 re-validation skipped.`);
  return null;
}
```

---

### [MAJOR] — `libs/worker-core/src/core/codex-launcher.ts` line 19 — Module-level `exitCodes` Map grows unbounded

The `exitCodes` Map is never pruned. Each completed codex worker permanently occupies a slot. In a session-orchestrator that runs for weeks and spawns hundreds of workers, this is a slow memory leak. The same pattern exists in `opencode-launcher.ts` (pre-existing), but this is a new file introducing the same defect.

**Fix:** After `exitCodes.set(pid, code)` in the onExit handler, schedule a cleanup:
```typescript
exitCodes.set(pid, code);
setTimeout(() => exitCodes.delete(pid), 60_000); // keep for 1 min for query window
```

---

### [MAJOR] — `libs/worker-core/src/core/provider-resolver.ts` line 111 — `tryProvider` ignores the requested model; always picks from config

When Phase 2 calls `tryProvider(candidateName, config)` for a fallback candidate, the returned `model` is always whichever of `balanced/heavy/light` is populated first in the config — not related to the tier requested by the task. This is correct for a fallback scenario (task tier is irrelevant when the primary provider is down), but it is inconsistent with Phase 1 which does preserve tier context. The issue is in how `resolveProviderForSpawn` calls `tryProvider` for the initial primary check:

```typescript
// Line 134-137: primary check
const requestedEntry = config.providers[providerName];
if (isProviderEntry(requestedEntry) && isLauncherAvailable(requestedEntry.launcher, config)) {
  return { providerName, model, launcher: requestedEntry.launcher };  // <-- returns original `model` arg unchanged
}
```

The `model` passed through unchecked here is the model stored in `task.md` at create time. If the user manually edits the config and removes that model string, Phase 2 returns a model that no longer exists in the config. This is a deliberate design trade-off (preserve the task's assigned model), but it is undocumented and the model is never validated against `requestedEntry.models`.

**Fix:** Document this behavior explicitly. If strict re-validation is desired, cross-check the requested model against `requestedEntry.models` values and fall back to the configured model if not found.

---

### [MINOR] — `apps/cli/src/utils/complexity-estimator.ts` line 164 — Phase 1 `tryResolveSlot` does not chain model tier fallback

`tryResolveSlot` reads `entry.models[modelTier]` with no chain. If a config entry defines only `balanced` and the requested tier is `heavy`, `entry.models['heavy']` is `undefined` and the function returns `null` — treating a healthy provider as unavailable. Phase 1 then walks the fallback chain and may select a less-preferred tier's provider when the preferred provider actually could have served the request with its `balanced` model.

`tryProvider` in provider-resolver.ts does chain: `entry.models['balanced'] ?? entry.models['heavy'] ?? entry.models['light']`. The two resolver functions are inconsistent in this regard.

**Fix:** In `tryResolveSlot`, after `entry.models[modelTier]` returns undefined, chain through the remaining tiers:
```typescript
const model = entry.models[modelTier]
  ?? entry.models['balanced']
  ?? entry.models['heavy']
  ?? entry.models['light'];
```

---

### [MINOR] — `libs/worker-core/src/types.ts` lines 49-53 — `LauncherInfo.models` type is `string[]` but usage accesses it as a keyed record

`LauncherInfo` in `libs/worker-core/src/types.ts` declares `models: string[]`. However `LauncherInfo` in `apps/cli/src/utils/provider-config.ts` also declares `models: string[]`. Neither is the keyed `Record<ModelTier, string>` that `ProviderEntry.models` uses. These are the "what models does the launcher support" lists (used for display, not routing). This is correct and not a bug, but the type guard `isLauncherInfo` in provider-resolver.ts only checks `found` and `authenticated` — it does not check `models` presence or type. A config object with a `launchers` entry that lacks the `models` field entirely will pass `isLauncherInfo` and be treated as a valid launcher. This is acceptable since `models` is not used in availability checks, but it's an undocumented gap between the type guard and the declared type.

---

## Data Flow Analysis

```
Phase 1 (create time):
  create.ts
    → estimateComplexity(description)              OK: safe, no I/O
    → readConfig(cwd)                              OK: logs parse errors
    → resolveProviderForTier(tier, config)
        → tryResolveSlot(tier, config)
            → config.routing[slot] ?? config.routing['default']
            → config.providers[providerName].models[modelTier]
                                                   ISSUE: no tier fallback chain in models lookup
        → walks FALLBACK_CHAINS
        → anthropic last-resort
    → embeds Provider/Model into prompt note        OK

Phase 2 (spawn time):
  spawn-worker.ts
    → args.provider !== undefined && args.model !== undefined
                                                   ISSUE: gate too strict; single-field case bypasses Phase 2
    → readProviderConfig(args.working_directory)
        → parseConfigFile(global)                  ISSUE: silent on parse error
        → parseConfigFile(project)
        → merge (project wins)
    → if (config !== null)
        → resolveProviderForSpawn(provider, model, config)
            → primary check: launcher available?
                → if yes: return { providerName, model, launcher }
                                                   ISSUE: model not validated against config
            → walk all config.providers in insertion order
                → tryProvider(candidateName, config)
                    → models['balanced'] ?? ['heavy'] ?? ['light']
                                                   OK: chained
            → hardcoded anthropic fallback
        → if (resolved !== null)
            → map launcher to Provider type        ISSUE: 'glm' identity lost
        → if (resolved === null)
            → SILENT: continues with stale p/m     BLOCKING
    → spawn with p, m
```

### Gap Points Identified:
1. Phase 2 gate `provider !== undefined && model !== undefined` — bypassed for single-field callers
2. `resolveProviderForSpawn` returning `null` — unhandled, silent spawn with unavailable provider
3. `'glm'` provider loses identity through the launcher-to-Provider mapping
4. `parseConfigFile` in provider-resolver.ts — no warning on parse failure
5. `tryResolveSlot` in complexity-estimator.ts — no tier fallback in models lookup

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Phase 1: resolver reads launcher inventory and embeds Provider/Model | COMPLETE | None |
| Phase 1: fallback chain when primary launcher unavailable | COMPLETE | Minor: no model-tier chain in tryResolveSlot |
| Phase 2: re-validates launcher availability before spawn | PARTIAL | Gate too strict; null result unhandled |
| Phase 2: fallback logged when primary unavailable | COMPLETE | Log exists when fallback occurs |
| codex launcher: `launchWithCodex()` calls `codex exec` | COMPLETE | exitCodes Map unbounded |
| opencode multi-provider: zai-coding-plan/* and openai/* routing | NOT ADDRESSED | Phase 2 maps all claude-launcher providers to 'claude', loses 'glm' |
| Config read: global + project merge (project wins) | COMPLETE | Silent parse errors in provider-resolver.ts |
| Provider type 'codex' added; no hardcoded provider strings | COMPLETE | None |

### Implicit Requirements NOT Addressed:
1. What happens when Phase 2 resolves to `null` — the task spec says "spawn with fallback" but does not define behavior when all fallbacks are exhausted, including the last-resort anthropic
2. The `'glm'` provider type needs a mapping path through Phase 2 that preserves its identity for `launchWithPrint`

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| config file missing entirely | YES | returns null, Phase 2 skipped | Silent skip, no log |
| config file corrupted/unreadable | PARTIAL | returns null (no log in provider-resolver.ts) | Silent skip |
| all providers unavailable | NO | resolveProviderForSpawn returns null, unhandled | BLOCKING |
| model field empty string in task.md | YES | Phase 2 gate: model undefined/empty → skip | Gate blocks the empty string case since "" is truthy — actually passes gate, then `resolveProviderForSpawn` gets an empty model string but proceeds normally (primary check passes if launcher is available) |
| provider='glm' through Phase 2 | NO | Mapped to 'claude', loses identity | BLOCKING |
| config.providers empty object | YES | walk loop finds nothing, falls to anthropic | OK |
| routing slot missing for requested tier | YES | tryResolveSlot returns null, fallback chains | OK |
| requested model no longer in config | PARTIAL | Primary check returns original model unchanged | Undocumented trade-off |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Phase 2 config read → null | MED (corrupt config, permissions) | Phase 2 bypassed silently | Add logging in parseConfigFile |
| resolveProviderForSpawn → null | LOW (all providers truly down) | Worker spawned with unavailable provider | Throw/return error on null result |
| glm provider through Phase 2 | HIGH (any ZAI-using team) | Wrong env vars, auth against Anthropic | Add glm/zai mapping branch |
| exitCodes Map growth | LOW short-term, HIGH long-running | Memory pressure in session-orchestrator | Prune on TTL |

---

## Score: 6/10

The happy path (provider available, both fields provided, no glm) works correctly. The fallback chains are structurally sound. Type guards are thorough. Config merge logic is correct. The blocking issues are the unhandled `null` from `resolveProviderForSpawn` and the `'glm'` identity loss — both are correctness bugs, not edge cases, that will manifest in production for GLM users and in any multi-provider failure scenario.
