# Task: Dynamic Model Fetching, Auto-Refresh, and Auto-Fallback

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | integration  |

## Description

Currently the system uses static model names that go stale as providers release new models. This task implements **live model fetching** so the system always knows what models are available, plus an **auto-fallback chain** so work never blocks waiting for user input when a model is unavailable.

### Auto-Refresh on Orchestration Start

At the start of any orchestration or auto-pilot run:
1. Check the `modelsLastRefreshed` timestamp in global config (`~/.nitro-fueled/config.json`)
2. If older than 1 hour (configurable TTL), fetch `/v1/models` from each enabled provider
3. Update the available models list in global config
4. If the fetch fails (network error, API down), silently use the last cached list — never block

The refresh is **fire-and-forget at startup** — it does not delay task execution. It runs before the first worker is spawned.

### Tier→Model Resolution

When resolving a tier to a model name at worker spawn time:
1. Look up the user's tier mapping in global config (e.g., `balanced → glm-4.7`)
2. Check if that model is in the current available models list
3. If available → use it
4. If not available → run the fallback chain

### Auto-Fallback Chain (No User Blocking)

If a preferred model is unavailable, the system automatically tries in order:
1. Other models in the same tier (if user has mapped multiple)
2. Next tier down (e.g., `balanced` → `light`)
3. Claude equivalent tier (e.g., `balanced` → `claude-sonnet-4-6`)

The fallback decision is logged in the task trace (TASK_2026_098). The user is never prompted.

### Implementation Points

- **Model refresh service** — new module `libs/worker-core/src/core/model-refresh.ts` (or equivalent location)
- **Fallback resolver** — `libs/worker-core/src/core/tier-resolver.ts` — given a provider + tier, returns the resolved model name after fallback
- **Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`) — add model refresh step at orchestration start
- **Spawn worker tool** — update to call tier resolver before spawning

## Dependencies

- **TASK_2026_095** — global config with tier→model schema must exist first

## Acceptance Criteria

- [ ] On orchestration start, available models are fetched if cache is older than 1 hour
- [ ] If provider API is unreachable, last cached model list is used silently
- [ ] If preferred model is unavailable, fallback chain runs automatically with no user prompt
- [ ] Fallback choice is logged (provider, original model, fallback model used)
- [ ] Manual refresh never required — system self-updates
- [ ] Auto-pilot skill documentation updated to describe model refresh step

## Parallelism

**Wave**: 2 (depends on TASK_2026_095)
**Can run in parallel with**: TASK_2026_097 (independent), TASK_2026_098 (tracing can start in parallel once 095 is done, but 098 captures fallback info so benefit from 096 being done)
**Conflicts with**: None

## References

- `libs/worker-core/src/core/print-launcher.ts`
- `apps/session-orchestrator/src/tools/spawn-worker.ts`
- `.claude/skills/auto-pilot/SKILL.md`
- `apps/cli/src/utils/provider-status.ts`
