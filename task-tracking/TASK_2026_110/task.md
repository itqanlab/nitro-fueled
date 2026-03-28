# Task: Provider Config Schema + CLI Wizard (Part 1/3 — Provider Resolver Engine)

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | claude-opus-4-6 |
| Testing    | skip    |

## Description

Redesign the provider configuration to be **provider-first and dynamic**. All providers are equal peers — none is hardcoded as special. Users configure providers, not launchers.

### New Config Schema (`~/.nitro-fueled/config.json`)

```json
{
  "providers": {
    "anthropic": {
      "apiType": "anthropic",
      "enabled": true,
      "auth": { "method": "api-key", "key": "$ANTHROPIC_API_KEY" },
      "baseUrl": "https://api.anthropic.com",
      "models": {
        "heavy": "claude-opus-4-6",
        "balanced": "claude-sonnet-4-6",
        "light": "claude-haiku-4-5-20251001"
      }
    },
    "zai": {
      "apiType": "anthropic",
      "enabled": true,
      "auth": { "method": "api-key", "key": "$ZAI_API_KEY" },
      "baseUrl": "https://api.z.ai/api/anthropic",
      "models": {
        "heavy": "glm-5",
        "balanced": "glm-4.7",
        "light": "glm-4.5-air"
      }
    },
    "openai": {
      "apiType": "openai",
      "enabled": false,
      "auth": { "method": "oauth" },
      "models": {
        "heavy": "gpt-4.1",
        "balanced": "gpt-4.1",
        "light": "gpt-4.1-mini"
      }
    }
  },
  "routing": {
    "default": "zai",
    "complex-tasks": "anthropic",
    "review-logic": "anthropic",
    "review-style": "zai",
    "simple-tasks": "zai",
    "documentation": "zai"
  },
  "launchers": {
    "claude-code": { "supports": ["anthropic"], "binary": "claude" },
    "opencode": { "supports": ["openai"], "binary": "opencode" }
  }
}
```

### Key Design Decisions

- `apiType` determines which launcher handles this provider (`"anthropic"` → claude-code, `"openai"` → opencode)
- `auth.method` can be `"api-key"` or `"oauth"` — launcher must be compatible with the auth method
- Config lives at user workspace level (`~/.nitro-fueled/config.json`), not per-project
- `routing` section maps task conditions to provider names
- `launchers` section is system-defined (not user-editable) — documents which launchers exist and what they support

### CLI Wizard Update

```
$ npx nitro-fueled config

  Add a provider:
  1. Anthropic (Claude)     ← apiType auto-set to "anthropic"
  2. Z.AI (GLM)             ← apiType auto-set to "anthropic"
  3. OpenAI                 ← apiType auto-set to "openai"
  4. Custom                 ← asks: Anthropic-compatible or OpenAI-compatible?

  > 2
  Auth method: [A]PI Key  [O]Auth  > A
  API Key (or env var like $ZAI_API_KEY): > $ZAI_API_KEY
  ✓ Connected — 5 models available
  Auto-assigned: heavy=glm-5, balanced=glm-4.7, light=glm-4.5-air
  Set as default provider? [Y/n] > Y
  ✓ Z.AI added as default provider
```

### Changes

1. **provider-config.ts** — New config schema with `apiType`, per-provider `auth`, `models` by tier, `routing`, `launchers`
2. **config.ts** — Updated wizard flow: provider-first selection, apiType auto-detection for known providers, Custom option for arbitrary providers
3. **provider-flow.ts** — Updated interactive menus for new schema

## Dependencies

- None

## Acceptance Criteria

- [ ] New config schema supports arbitrary number of providers with `apiType` field
- [ ] Each provider has `auth` with `method` (api-key or oauth) and `models` by tier (heavy/balanced/light)
- [ ] Config stored at `~/.nitro-fueled/config.json` (user workspace scope)
- [ ] CLI wizard offers known providers (Anthropic, Z.AI, OpenAI) + Custom option
- [ ] Known providers auto-set `apiType`; Custom asks user
- [ ] `routing` section maps task conditions to provider names
- [ ] Backward compatible — old config format is migrated on first read

## References

- Current config: `apps/cli/src/utils/provider-config.ts`
- Current wizard: `apps/cli/src/commands/config.ts`
- Current flow: `apps/cli/src/utils/provider-flow.ts`

## File Scope

- apps/cli/src/utils/provider-config.ts
- apps/cli/src/commands/config.ts
- apps/cli/src/utils/provider-flow.ts

## Parallelism

- ✅ Can run in parallel with most tasks — no file overlap with orchestration tasks
- 🚫 Do NOT run in parallel with TASK_2026_091 — both modify CLI commands
