# Task: CLI Provider Configuration and Dependency Validation

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

Add `npx nitro-fueled config` command that lets users set up providers and validates all dependencies — so the user never needs to leave the terminal or manually edit config files.

### What it does

**1. Dependency check (runs automatically on `init` and `config`)**

```
$ npx nitro-fueled config

Checking dependencies...
  ✓ claude CLI found (v1.2.3)
  ✓ Claude Code logged in (subscription active)
  ✗ opencode CLI not found
    → Install with: npm i -g opencode
  ✓ node v22.1.0

```

Checks:
- `claude` binary on PATH → required (error if missing)
- `claude` logged in → required (check via `claude status` or similar)
- `opencode` binary on PATH → optional (skip if not using GPT/other providers)
- `node` version → required (minimum version for dashboard service)

**2. Provider setup (interactive)**

```
$ npx nitro-fueled config

Configure providers:

  Claude (subscription)
  ✓ Already configured — logged in via Claude Code

  GLM (Z.AI)
  ? Enable GLM provider? (y/N) y
  ? Z.AI API key: zai_sk_***************
  ✓ Testing connection... OK (GLM-4.7 available)
  ✓ GLM configured

  OpenCode (GPT and others)
  ? Enable OpenCode provider? (y/N) y
  ? OpenAI API key: sk-***************
  ✓ Testing connection... OK (gpt-4.1-mini available)
  ✓ OpenCode configured

  Providers configured: Claude ✓  GLM ✓  OpenCode ✓
```

**3. Where config is stored**

Create `.nitro-fueled/config.json` in the project root (gitignored):

```json
{
  "providers": {
    "claude": {
      "enabled": true,
      "source": "subscription"
    },
    "glm": {
      "enabled": true,
      "apiKey": "zai_sk_...",
      "baseUrl": "https://api.z.ai/api/anthropic",
      "models": {
        "opus": "glm-5",
        "sonnet": "glm-4.7",
        "haiku": "glm-4.5-air"
      }
    },
    "opencode": {
      "enabled": true,
      "defaultModel": "openai/gpt-4.1-mini"
    }
  }
}
```

API keys can also be set via env vars (`ZAI_API_KEY`, `OPENAI_API_KEY`) which take precedence over the config file.

**4. Validation command**

```
$ npx nitro-fueled config --check

Dependencies:
  ✓ claude CLI (v1.2.3)
  ✓ Claude Code subscription active
  ✓ opencode CLI (v0.8.1)
  ✓ node (v22.1.0)

Providers:
  ✓ Claude — connected (Opus, Sonnet, Haiku available)
  ✓ GLM — connected (GLM-5, GLM-4.7, GLM-4.5-Air available)
  ✓ OpenCode — connected (openai/gpt-4.1-mini verified)

Ready to run.
```

This can also run automatically before `npx nitro-fueled run` starts the auto-pilot — fail fast if a required provider is misconfigured.

**5. Auto-install missing optional deps**

If user enables OpenCode but it's not installed:

```
  ✗ opencode CLI not found
  ? Install opencode globally? (Y/n) y
  → Running: npm i -g opencode
  ✓ opencode installed (v0.8.1)
```

Same for any other optional tooling.

### CLI subcommands

```
npx nitro-fueled config              # Interactive setup (deps + providers)
npx nitro-fueled config --check      # Validate only, no changes
npx nitro-fueled config --providers  # Only configure providers (skip deps)
npx nitro-fueled config --reset      # Remove config, start fresh
```

### How session-orchestrator reads the config

The print-launcher reads `.nitro-fueled/config.json` at spawn time:
- Provider is `glm` → read GLM config, build env vars from stored API key + base URL
- Provider is `opencode` → verify opencode is available, read default model
- Provider is `claude` → no extra config needed (subscription)

The config file is the single source of truth — no scattered env vars to manage.

### Security

- `.nitro-fueled/` directory added to `.gitignore` by `nitro-fueled init`
- API keys stored locally only, never committed
- Config file permissions set to 600 (owner read/write only)
- `config.json` supports env var references: `"apiKey": "$ZAI_API_KEY"` (reads from env at runtime instead of storing the key)

## Dependencies

- TASK_2026_021 — Three-Provider Routing (defines the providers this configures)

## Acceptance Criteria

- [ ] `npx nitro-fueled config` runs interactive provider setup
- [ ] Dependency check validates claude, opencode, node on PATH
- [ ] Claude login status verified
- [ ] GLM setup: prompts for Z.AI API key, tests connection
- [ ] OpenCode setup: prompts for OpenAI API key, tests connection
- [ ] Config stored in `.nitro-fueled/config.json` (gitignored)
- [ ] `--check` flag validates without changing anything
- [ ] Auto-install offer for missing optional deps (opencode)
- [ ] Session orchestrator reads config at spawn time
- [ ] API keys support env var references (`$ZAI_API_KEY`)
- [ ] `.nitro-fueled/` added to `.gitignore` by init
- [ ] Pre-flight check runs before auto-pilot starts

## References

- `packages/cli/` — CLI implementation
- `TASK_2026_021` — Three-Provider Routing
- `TASK_2026_033` — Pre-Flight Validation (can integrate the config check)
- Z.AI setup docs: https://docs.z.ai/devpack/tool/claude
