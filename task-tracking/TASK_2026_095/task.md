# Task: Global Config Infrastructure — Migrate Provider Config to User Workspace Scope

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | integration  |

## Description

Currently provider configuration (GLM API key, base URL, MCP settings, tier→model mapping) is stored per-project in `.nitro-fueled/config.json`. This means users must re-configure GLM for every new project they `nitro-fueled init` into.

Migrate all provider config to a **user workspace scope** at `~/.nitro-fueled/config.json`. This file is machine-level and shared across all projects on the same machine. Project-level `.nitro-fueled/config.json` is reserved for future project-specific overrides (out of scope here).

The internal routing language must be changed from hard-coded model names (`glm-4.7`, `glm-5`, etc.) to **tiers** (`heavy`, `balanced`, `light`). The global config stores the user's tier→model mapping, chosen when they configure a provider. Model names are never hard-coded in skills, agents, or orchestration logic.

### Config Schema

**Global config** (`~/.nitro-fueled/config.json`):
```json
{
  "providers": {
    "glm": {
      "enabled": true,
      "apiKey": "...",
      "baseUrl": "https://api.z.ai/api/anthropic",
      "tiers": {
        "heavy": "glm-5.1",
        "balanced": "glm-4.7",
        "light": "glm-4.5-air"
      },
      "modelsLastRefreshed": "2026-03-28T00:00:00Z"
    },
    "claude": {
      "enabled": true,
      "tiers": {
        "heavy": "claude-opus-4-6",
        "balanced": "claude-sonnet-4-6",
        "light": "claude-haiku-4-5-20251001"
      }
    }
  },
  "mcp": {
    "sessionOrchestratorPath": "/path/to/session-orchestrator"
  }
}
```

### Changes Required

1. **CLI config command** (`apps/cli/src/commands/config.ts`) — read/write from `~/.nitro-fueled/config.json` instead of project-local path
2. **Provider config utils** (`apps/cli/src/utils/provider-config.ts`) — update path resolution to use `os.homedir()`
3. **Provider flow** (`apps/cli/src/utils/provider-flow.ts`) — update to write tier→model mapping (not hard-coded model names)
4. **Print launcher** (`libs/worker-core/src/core/print-launcher.ts`) — read tier→model from global config at runtime instead of hard-coded env vars
5. **Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`) — replace all hard-coded model names with tier references (e.g., `heavy`, `balanced`, `light`)
6. **Review lead agent** (`.claude/agents/nitro-review-lead.md`) — replace hard-coded model names with tier references
7. **Spawn worker tool** (`apps/session-orchestrator/src/tools/spawn-worker.ts`) — accept tier as input, resolve to model name via global config

## Dependencies

None — this is foundational infrastructure.

## Acceptance Criteria

- [ ] `~/.nitro-fueled/config.json` is created on first `nitro-fueled config` run
- [ ] No per-project config file is created for provider settings during `init`
- [ ] All skills, agents, and orchestration code use tier names (`heavy`, `balanced`, `light`) — zero hard-coded model name strings
- [ ] `nitro-fueled config` reads and writes global config correctly
- [ ] Print launcher resolves tier → model name from global config at worker spawn time
- [ ] Existing projects continue to work (global config is backward-compatible)

## Parallelism

**Wave**: 1 (foundational — must complete before TASK_2026_096)
**Can run in parallel with**: TASK_2026_097 (auto-complexity estimation — independent)
**Conflicts with**: None

## References

- `apps/cli/src/utils/provider-config.ts`
- `apps/cli/src/utils/provider-flow.ts`
- `apps/cli/src/commands/config.ts`
- `libs/worker-core/src/core/print-launcher.ts`
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/agents/nitro-review-lead.md`
- `apps/session-orchestrator/src/tools/spawn-worker.ts`
