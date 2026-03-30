# Review Context — TASK_2026_111

## Task Summary
Two-Phase Provider Resolver Engine: selects the right launcher, model, and auth path for every worker. Phase 1 embeds provider/model into task.md at create time; Phase 2 re-validates launcher availability before spawning.

## Files Changed

### New Files
- `libs/worker-core/src/core/codex-launcher.ts` — `launchWithCodex()` mirroring opencode-launcher.ts structure
- `libs/worker-core/src/core/provider-resolver.ts` — `readProviderConfig()`, `resolveProviderForSpawn()`, `FALLBACK_PROVIDER`

### Modified Files
- `libs/worker-core/src/types.ts` — Added `'codex'` to `Provider`/`LauncherMode` unions; added `LauncherName`, `ModelTier`, `LauncherInfo`, `ProviderEntry`, `NitroFueledConfig` types
- `libs/worker-core/src/index.ts` — Exported codex launcher, provider-resolver, new types
- `apps/cli/src/utils/complexity-estimator.ts` — Added `ResolvedProvider`, `resolveProviderForTier()`
- `apps/cli/src/commands/create.ts` — Embeds provider suggestion in `/create-task` prompt note
- `apps/session-orchestrator/src/tools/spawn-worker.ts` — Phase 2 re-validation block + codex spawn branch

## Key Design Decisions
1. Config types duplicated in `libs/worker-core/src/types.ts` (rather than imported from apps/cli) — avoids cross-app import
2. `resolveProviderForSpawn` walks all config providers in insertion order as fallback, then hardcoded anthropic
3. `resolveProviderForTier` uses tier-specific routing slots with fallback chains (heavy→balanced→light→anthropic)
4. All JSON.parse results validated with `isNitroFueledConfig()` / `isProviderEntry()` / `isLauncherInfo()` type guards
5. `codex exec --model <model> --output-format json <prompt>` arg array — no shell concatenation

## Acceptance Criteria
- [x] Phase 1: resolver reads launcher inventory and embeds Provider/Model into task.md
- [x] Phase 1: fallback chain used when primary launcher unavailable
- [x] Phase 2: re-validates launcher availability before spawn
- [x] Phase 2: fallback logged when primary unavailable
- [x] codex launcher: `launchWithCodex()` calls `codex exec`
- [x] opencode multi-provider: handled by existing spawn-worker logic
- [x] Config read: global + project merge (project wins)
- [x] Provider type 'codex' added; no hardcoded provider strings in spawn logic

## Findings Summary

| Reviewer | Finding Count | Blocking |
|----------|---------------|----------|
| (pending) | - | - |
