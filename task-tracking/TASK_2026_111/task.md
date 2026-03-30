# Task: Two-Phase Provider Resolver Engine (Part 2/3 — Provider Resolver Engine)

## Metadata

| Field                 | Value           |
|-----------------------|-----------------|
| Type                  | FEATURE         |
| Priority              | P1-High         |
| Complexity            | Medium          |
| Preferred Tier        | balanced        |
| Model                 | claude-opus-4-6 |
| Testing               | skip            |
| Poll Interval         | default         |
| Health Check Interval | default         |
| Max Retries           | default         |

## Description

Implement a two-phase provider resolver that selects the right launcher, model, and auth path for every worker — once at task creation time and once immediately before spawn.

### Phase 1 — Create-Time Resolution

When a task is created (via `nitro-fueled create` or `/create-task`), the resolver reads the launcher inventory from `~/.nitro-fueled/config.json` and embeds the best available provider/model for each tier directly into the task's `task.md` metadata. This means the task carries its own routing decision from the moment it is created — no guesswork at spawn time.

**Resolution logic:**
1. Read `launchers` section from config — lists what's installed and authenticated
2. For each tier (heavy / balanced / light), look up `routing.<slot>` → get provider name → look up `providers.<name>` → get launcher + model
3. Validate that the named launcher is in `launchers` with `authenticated: true`
4. If not available, pick next best (walk the fallback chain: heavy→balanced→light, then anthropic as last resort)
5. Embed the resolved assignments into task.md Metadata as `| Provider | <name> |` and `| Model | <model> |`

**Integration points:**
- `apps/cli/src/utils/complexity-estimator.ts` — already runs at create time; Phase 1 runs after it and adds provider/model fields
- `apps/cli/src/commands/create.ts` — passes Phase 1 result into the `/create-task` prompt note

### Phase 2 — Spawn-Time Re-validation

Immediately before `spawn_worker` is called in the session-orchestrator, re-check that the task's assigned launcher is still available. Auth tokens expire, binaries get uninstalled, ZAI quotas run out. Phase 2 catches this before the worker fails mid-run.

**Re-validation logic:**
1. Read task's `Provider` and `Model` fields from `task.md`
2. Look up the provider in config → get launcher name
3. Re-check launcher availability (binary exists + auth file still present)
4. If still valid: proceed with original provider/model
5. If unavailable: run fallback chain, log the substitution, spawn with fallback

**Fallback chain (in order):**
1. Same tier, different provider with an available launcher
2. Adjacent tier (balanced if heavy fails, light if balanced fails), same or different provider
3. Last resort: `anthropic` / `claude-sonnet-4-6` via `claude` launcher (always available if claude CLI is installed)

Each fallback step is logged:
```
SPAWN FALLBACK — TASK_X: openai-opencode/gpt-5.4-mini unavailable (auth expired), trying zai/glm-4.7
```

### Launcher-to-Spawn Mapping

The resolver maps a `(launcher, model)` pair to the correct spawn function:

| Launcher   | Spawn function      | Notes                                                          |
|------------|---------------------|----------------------------------------------------------------|
| `claude`   | `launchWithPrint()` | Standard claude CLI, no env override                           |
| `opencode` | `launchWithPrint()` with GLM env | If model prefix is `zai-coding-plan/` → set `ANTHROPIC_*` env vars; if `openai/` → set opencode OAuth env |
| `opencode` | `launchWithOpenCode()` | For non-GLM opencode models; single-shot headless             |
| `codex`    | `launchWithCodex()` (new) | Calls `codex exec --model <model> <prompt>`, non-interactive  |

**New:** `launchWithCodex()` in `libs/worker-core/src/core/codex-launcher.ts` — mirrors `opencode-launcher.ts` structure, calls `codex exec --model <model> --output-format json <prompt>`.

### Config Read Path

Both phases read config using the same resolution order:
1. `{project}/.nitro-fueled/config.json` (project override, if exists)
2. `~/.nitro-fueled/config.json` (global)
3. Merge: project values override global values per key

### Changes

1. **apps/cli/src/utils/complexity-estimator.ts** — Add `resolveProviderForTier(tier, config)` export; called from `create.ts` to embed Phase 1 result
2. **apps/cli/src/commands/create.ts** — Pass Phase 1 provider/model suggestion into the `/create-task` prompt note alongside complexity estimate
3. **apps/session-orchestrator/src/tools/spawn-worker.ts** — Add Phase 2 re-validation before spawning; replace hardcoded `if provider === 'opencode'` branches with config-driven launcher lookup
4. **libs/worker-core/src/core/codex-launcher.ts** — New file: `launchWithCodex()` function mirroring opencode-launcher.ts
5. **libs/worker-core/src/index.ts** — Export `launchWithCodex` and `getCodexExitCode`
6. **libs/worker-core/src/types.ts** — Add `'codex'` to `Provider` union type; add `'codex'` to `Launcher` union type

## Dependencies

- TASK_2026_110 — provides the new config schema with `launchers`, `providers`, `routing` sections

## Acceptance Criteria

- [ ] Phase 1: at task creation, resolver reads launcher inventory and embeds `Provider` and `Model` fields into task.md metadata
- [ ] Phase 1: if assigned launcher is unavailable at create time, next-best is used and a note is added
- [ ] Phase 2: before each `spawn_worker` call, resolver re-validates launcher availability
- [ ] Phase 2: fallback chain is walked and logged when primary launcher is unavailable
- [ ] `codex` launcher is supported: `launchWithCodex()` calls `codex exec --model <model> <prompt>`
- [ ] `opencode` multi-provider routing: `zai-coding-plan/*` models use GLM env vars; `openai/*` models use opencode OAuth path
- [ ] Config is read from global then project-override, merged correctly
- [ ] Provider type `'codex'` added to worker-core types; no hardcoded provider strings remain in spawn logic

## References

- Config schema: from TASK_2026_110
- Current spawn-worker: `apps/session-orchestrator/src/tools/spawn-worker.ts`
- Current opencode-launcher: `libs/worker-core/src/core/opencode-launcher.ts`
- Current print-launcher: `libs/worker-core/src/core/print-launcher.ts`
- Complexity estimator: `apps/cli/src/utils/complexity-estimator.ts`
- codex CLI: `codex exec --help`

## File Scope

- apps/cli/src/utils/complexity-estimator.ts
- apps/cli/src/commands/create.ts
- apps/session-orchestrator/src/tools/spawn-worker.ts
- libs/worker-core/src/core/codex-launcher.ts
- libs/worker-core/src/index.ts
- libs/worker-core/src/types.ts

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_110 — depends on it
- 🚫 Do NOT run in parallel with TASK_2026_112 — 112 depends on this
- Suggested execution wave: after TASK_2026_110, before TASK_2026_112
