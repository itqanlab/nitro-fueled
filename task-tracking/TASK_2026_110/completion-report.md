# Completion Report — TASK_2026_110

## Files Created
- `apps/cli/src/utils/provider-defaults.ts` (54 lines) — DEFAULT_PROVIDERS + DEFAULT_ROUTING constants
- `apps/cli/src/utils/provider-migration.ts` (81 lines) — isOldFormatConfig + buildMigratedConfig
- `apps/cli/src/utils/glm-test.ts` (81 lines) — resolveApiKey + testGlmConnection + SSRF guard
- `apps/cli/src/utils/launcher-detect.ts` (273 lines) — detectClaude/detectOpenCode/detectCodex

## Files Modified
- `apps/cli/src/utils/provider-config.ts` — rewritten: new schema (LaunchersConfig/ProviderEntry/RoutingConfig), global config path, merge logic; extracted constants/migration/GLM utilities to separate modules; isRecord exported
- `apps/cli/src/commands/config.ts` — detection-first wizard, Object.hasOwn prototype-pollution fix, await removed from getProviderStatus calls
- `apps/cli/src/utils/provider-flow.ts` — routing assignment + provider derivation only; launcher detection extracted to launcher-detect.ts; isRecord duplicate removed
- `apps/cli/src/utils/provider-status.ts` — reads from launchers section; async removed (no await in body)

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | 7/10 |
| Code Logic | 8/10 |
| Security | 8/10 |

## Findings Fixed

### Blocking (Style — HIGH)
- **as assertions (3 instances)**: All removed. Old `as { providers: OldProviders }` replaced by validated type guards in `buildMigratedConfig`; `as Record<string, unknown>` made redundant by guard extraction; `as 'heavy' | 'balanced' | 'light'` replaced by `ModelTier[]` loop typing.
- **Empty catch block (rename)**: Added `console.warn` with error message in provider-migration.ts.

### Serious (Style — MEDIUM / Logic — MAJOR / Security — MEDIUM)
- **File size limit**: provider-config.ts (397→252 lines), provider-flow.ts (344→140 lines) via module extraction.
- **Duplicate isRecord**: Exported from provider-config.ts; removed from provider-flow.ts; launcher-detect.ts imports it directly.
- **Unused `cwd` param**: `runDetectionWizard` now calls `readConfig(cwd) ?? readGlobalConfig()`.
- **Swallowed errors (3 catch blocks)**: All now log via `console.debug`/`console.warn`.
- **Duplicate models in detectOpenCode**: `seenPrefixes` Set prevents duplicate auth rows.
- **Unavailable provider in wizard**: Warning printed when user assigns an unauthenticated provider.
- **Prototype pollution (`in` operator)**: Replaced with `Object.hasOwn(config.providers, providerArg)`.
- **SSRF in testGlmConnection**: `isPrivateOrLoopback` guard added; blocks loopback, RFC-1918, link-local hostnames.

### Minor (Logic — MINOR / Security — LOW)
- **Unnecessary async**: Removed from `getProviderStatus`; callers updated to drop `await`.
- **Silent rename failure**: `console.warn` added in provider-migration.ts.
- **No maxBuffer on spawnSync**: All 4 `spawnSync` calls now pass `maxBuffer: 1024 * 1024` + try/catch for graceful ENOBUFS degradation.
- **Leftover `as Array<unknown>`**: Removed from glm-test.ts; TypeScript narrows correctly after `Array.isArray`.

## New Review Lessons Added
- none

## Integration Checklist
- [x] All new modules export correctly and re-exported via provider-config.ts for backward compat
- [x] No circular imports (provider-migration.ts uses local isRecord copy to avoid cycle)
- [x] TypeScript compiles clean (`npx tsc --noEmit` passes with 0 errors)
- [x] Barrel exports / public API unchanged — existing callers of provider-config.ts get same symbols via re-exports

## Verification Commands
```bash
npx tsc --noEmit   # should exit 0
grep -r "as " apps/cli/src/utils/provider-config.ts   # should return nothing
grep -rn "async function getProviderStatus" apps/cli/src/utils/provider-status.ts   # should not say async
```
