# Task: Launcher-Aware Config Schema + CLI Wizard (Part 1/3 — Provider Resolver Engine)

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

Redesign the provider configuration to be **launcher-first and discovery-driven**. Instead of asking users to manually configure providers and auth methods, nitro-fueled detects what launchers are installed on the machine, reads their existing auth state, and derives which models are available — automatically.

### Core Design

**Launchers** are the actual binaries (`claude`, `opencode`, `codex`). Each launcher has its own auth mechanism and exposes a set of models. The user configures auth once in the launcher tool they already use — nitro-fueled discovers the rest.

**opencode** is a multi-provider unified runner — one binary, multiple access paths depending on what's authenticated:
- `openai/*` models → OAuth via ChatGPT subscription (`~/.local/share/opencode/auth.json`)
- `zai-coding-plan/*` models → Z.AI API key (`ZAI_API_KEY` env or stored key)
- `opencode/*` models → free tier (no auth required, always available when binary is found)

**codex** is a separate agentic launcher with its own harness and auth (different execution model from opencode):
- `openai/*` models → ChatGPT OAuth (`~/.codex/auth.json`, `auth_mode: chatgpt`)
- `openai/*` models → API key (`~/.codex/auth.json`, `OPENAI_API_KEY`)

### Launcher Detection

Run at `nitro-fueled config` time. For each launcher:

| Launcher   | Binary check     | Auth check                                        | Derives available models                                                            |
|------------|------------------|---------------------------------------------------|-------------------------------------------------------------------------------------|
| `claude`   | `which claude`   | `claude auth status` (exit code + output)         | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`                |
| `opencode` | `which opencode` | parse `opencode auth list` output                 | `openai/*` if OAuth row present; `zai-coding-plan/*` if ZAI row present; `opencode/*` always |
| `codex`    | `which codex`    | read `~/.codex/auth.json`, check `auth_mode` field | `openai/*` if `chatgpt` or api-key mode                                            |

Detected state is stored in config under a `launchers` section (auto-populated, not user-editable):

```json
{
  "launchers": {
    "claude":   { "found": true, "authenticated": true, "models": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
    "opencode": { "found": true, "authenticated": true, "authMethods": ["oauth", "api-key"], "models": ["openai/gpt-5.4", "openai/gpt-5.4-mini", "zai-coding-plan/glm-5", "zai-coding-plan/glm-4.7", "opencode/big-pickle"] },
    "codex":    { "found": true, "authenticated": true, "authMethods": ["oauth"], "models": ["openai/codex-mini-latest", "openai/gpt-5.4"] }
  }
}
```

### Config Schema

Config lives at `~/.nitro-fueled/config.json` (machine-level, not per-project). Per-project overrides remain possible at `{project}/.nitro-fueled/config.json` — merged over global at runtime (project values win).

```json
{
  "launchers": { /* auto-detected, see above */ },
  "providers": {
    "anthropic": {
      "launcher": "claude",
      "models": { "heavy": "claude-opus-4-6", "balanced": "claude-sonnet-4-6", "light": "claude-haiku-4-5-20251001" }
    },
    "zai": {
      "launcher": "opencode",
      "modelPrefix": "zai-coding-plan/",
      "models": { "heavy": "zai-coding-plan/glm-5", "balanced": "zai-coding-plan/glm-4.7", "light": "zai-coding-plan/glm-4.5-air" }
    },
    "openai-opencode": {
      "launcher": "opencode",
      "modelPrefix": "openai/",
      "models": { "heavy": "openai/gpt-5.4", "balanced": "openai/gpt-5.4-mini", "light": "openai/gpt-5.4-mini" }
    },
    "openai-codex": {
      "launcher": "codex",
      "modelPrefix": "openai/",
      "models": { "heavy": "openai/gpt-5.4", "balanced": "openai/gpt-5.4-mini", "light": "openai/codex-mini-latest" }
    }
  },
  "routing": {
    "default":       "zai",
    "heavy":         "anthropic",
    "review-logic":  "anthropic",
    "review-style":  "zai",
    "review-simple": "openai-opencode",
    "documentation": "openai-opencode"
  }
}
```

### CLI Wizard Update

Replace per-provider menus with a detection-first flow:

```
$ npx nitro-fueled config

Detecting launchers...
  ✓ claude       connected (subscription)
  ✓ opencode     openai/oauth + zai/api-key
  ✓ codex        openai/oauth

Available model tiers (derived from detected launchers):
  heavy    → claude-opus-4-6     (anthropic via claude)
  balanced → glm-5               (zai via opencode)
  light    → gpt-5.4-mini        (openai-opencode via opencode)

Routing assignments — press Enter to accept defaults:
  heavy    [anthropic]       >
  balanced [zai]             >
  light    [openai-opencode] >

✓ Config saved to ~/.nitro-fueled/config.json
```

If a launcher is missing or unauthenticated, show the fix:
```
  ✗ opencode   openai not authenticated — run: opencode auth login
  ✗ codex      not found — install: npm i -g @openai/codex
```

### Backward Compatibility

On first read of an old per-project `{project}/.nitro-fueled/config.json` in the old format, auto-migrate to the new schema and write to `~/.nitro-fueled/config.json`. Rename the old file to `.nitro-fueled/config.json.migrated`.

### Changes

1. **provider-config.ts** — New schema with `launchers`, `providers`, `routing`. Global path `~/.nitro-fueled/config.json`. Merge logic for project override. Migration from old format.
2. **config.ts** — Detection-first wizard: scan launchers, derive available tiers, prompt for routing slot assignments only.
3. **provider-flow.ts** — Replace per-provider menus with launcher display + routing assignment prompts.
4. **provider-status.ts** — Read from `launchers` section instead of per-provider auth fields.

## Dependencies

- None

## Acceptance Criteria

- [ ] `nitro-fueled config` scans for `claude`, `opencode`, `codex` binaries and their auth state without any manual user input
- [ ] `opencode auth list` output is parsed to determine which model prefixes are available per launcher
- [ ] `~/.codex/auth.json` is read to determine codex availability and auth mode
- [ ] Config stored at `~/.nitro-fueled/config.json` (global); per-project override merged at runtime
- [ ] `launchers` section is auto-populated by detection, never prompted for manually
- [ ] `routing` section maps task conditions to provider names; user can override defaults
- [ ] CLI wizard shows detected state upfront with derived tier assignments, then prompts routing slots only
- [ ] Old config format is auto-migrated on first read with `.migrated` backup

## References

- Current config: `apps/cli/src/utils/provider-config.ts`
- Current wizard: `apps/cli/src/commands/config.ts`
- Current flow: `apps/cli/src/utils/provider-flow.ts`
- opencode auth file: `~/.local/share/opencode/auth.json`
- codex auth file: `~/.codex/auth.json`

## File Scope

- apps/cli/src/utils/provider-config.ts
- apps/cli/src/commands/config.ts
- apps/cli/src/utils/provider-flow.ts
- apps/cli/src/utils/provider-status.ts

## Parallelism

- ✅ Can run in parallel with most tasks — no overlap with session-orchestrator or auto-pilot
- 🚫 Do NOT run in parallel with TASK_2026_111 or TASK_2026_112 — sequential dependency
- Suggested execution wave: run first in the 110→111→112 chain
