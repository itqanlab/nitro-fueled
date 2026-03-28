# Task: Provider Resolver Engine in Session Orchestrator (Part 2/3 — Provider Resolver Engine)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | claude-opus-4-6 |
| Testing    | skip    |

## Description

Implement the **resolver engine** in session-orchestrator that resolves a task's provider/model requirement to a concrete launcher + auth + environment at spawn time. Replaces the current hardcoded `if provider === 'claude'` / `if provider === 'glm'` / `if provider === 'opencode'` logic.

### Resolution Flow

```
Input: { provider: "zai", tier: "balanced" }
       ↓
Step 1: Load config → providers.zai
Step 2: Resolve model → zai.models.balanced → "glm-4.7"
Step 3: Match launcher → zai.apiType === "anthropic" → claude-code launcher
Step 4: Check auth → zai.auth.method === "api-key" → compatible with claude-code
Step 5: Build env → ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, model env vars
Step 6: Spawn process
```

### Fallback Chain

If spawn fails:
1. Same model, different provider? (another provider might have it)
2. Same tier, different provider? (e.g., glm-5 fails → try claude-opus-4-6, both "heavy")
3. Different tier, same provider? (e.g., heavy fails → try balanced)
4. Last resort: anthropic/claude-sonnet-4-6 via claude-code (always available)

Each fallback step is logged. The supervisor sees: `SPAWN FALLBACK — TASK_X: zai/glm-4.7 failed, trying anthropic/claude-opus-4-6`

### Changes

1. **New: resolver.ts** — Resolution engine that takes `{ provider, tier }` and returns `{ launcher, binary, env, model, auth }`
2. **spawn-worker.ts** — Refactor to use resolver instead of hardcoded provider switch
3. **print-launcher.ts** — Generalize env building from config (not hardcoded GLM env vars)
4. **opencode-launcher.ts** — Accept auth config from resolver (api-key or oauth)
5. **types.ts** — Update `Provider` type from union literal to string (any configured provider)
6. **index.ts** — Load config at startup, pass to resolver

## Dependencies

- TASK_2026_110 — config schema must exist for resolver to read

## Acceptance Criteria

- [ ] Resolver takes `{ provider, tier }` and returns fully resolved spawn config
- [ ] Launcher selection is driven by `apiType` from config, not hardcoded provider names
- [ ] Auth compatibility check: resolver verifies launcher supports the auth method
- [ ] Fallback chain executes automatically on spawn failure (same tier cross-provider → lower tier → claude fallback)
- [ ] Every fallback step is logged with provider/model transition details
- [ ] Adding a new provider requires only a config entry — zero code changes
- [ ] Existing 2-provider setup (Claude + GLM) works identically after refactor

## References

- Current spawn: `apps/session-orchestrator/src/tools/spawn-worker.ts`
- Current launchers: `apps/session-orchestrator/src/core/print-launcher.ts`, `opencode-launcher.ts`
- Worker-core: `libs/worker-core/src/`
- Config schema: from TASK_2026_110

## File Scope

- apps/session-orchestrator/src/core/resolver.ts (new)
- apps/session-orchestrator/src/tools/spawn-worker.ts
- apps/session-orchestrator/src/core/print-launcher.ts
- apps/session-orchestrator/src/core/opencode-launcher.ts
- apps/session-orchestrator/src/types.ts
- apps/session-orchestrator/src/index.ts

## Parallelism

- ✅ Can run in parallel with dashboard tasks, orchestration tasks
- 🚫 Do NOT run in parallel with TASK_2026_088 — both modify session-orchestrator
