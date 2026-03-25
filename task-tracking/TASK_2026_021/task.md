# Task: Three-Provider Routing — Claude, GLM, OpenCode

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | FEATURE    |
| Priority   | P1-High    |
| Complexity | Medium     |

## Description

Add support for 3 providers in the session orchestrator so workers can be routed to the best-fit provider and model. Right model for the right job — quality first, cost savings second.

### The 3 providers

All three use the same `claude` binary. GLM works by swapping environment variables to redirect API calls to Z.AI servers. OpenCode is separate for non-Claude models.

**1. Claude (subscription)** — full orchestration, best reasoning
- Binary: `claude --print`
- Env: normal (uses logged-in subscription)
- Models: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Capabilities: Full orchestration — agents, MCP, tools, skills, multi-step pipelines

**2. GLM (Z.AI)** — full orchestration, saves Claude quota
- Binary: `claude --print` (same CLI, different API endpoint)
- Env: Z.AI env vars override Anthropic endpoint
  - `ANTHROPIC_AUTH_TOKEN` = Z.AI API key
  - `ANTHROPIC_BASE_URL` = `https://api.z.ai/api/anthropic`
  - `ANTHROPIC_DEFAULT_OPUS_MODEL` = `glm-5`
  - `ANTHROPIC_DEFAULT_SONNET_MODEL` = `glm-4.7`
  - `ANTHROPIC_DEFAULT_HAIKU_MODEL` = `glm-4.5-air`
- Models: GLM-5, GLM-5-Turbo, GLM-4.7, GLM-4.6, GLM-4.5-Air
- Capabilities: Full orchestration — same as Claude (agents, MCP, tools, skills)

**3. OpenCode (GPT and others)** — single-shot focused tasks
- Binary: `opencode run --model <provider/model> --format json "prompt"`
- Models: `openai/gpt-5.4`, `openai/gpt-4.1`, `openai/gpt-4.1-mini`, `openai/o4-mini`, and any provider OpenCode supports
- Capabilities: Single-shot only — prompt in, output out, no orchestration

### Implementation

**print-launcher.ts changes:**

Add a `provider` option that controls the environment:

```typescript
type Provider = 'claude' | 'glm' | 'opencode';

// Claude: normal env
// GLM: swap env vars to Z.AI endpoint
// OpenCode: different binary entirely
```

For Claude and GLM, the only difference is environment variables. The same `claude --print` binary is used. This keeps it simple — no new adapter classes, just an env builder function.

For OpenCode, spawn `opencode run` instead of `claude --print`.

**spawn_worker MCP tool:**

Add `provider` parameter:
```
spawn_worker(prompt, working_directory, label, model?, provider?)
  provider: 'claude' | 'glm' | 'opencode' (default: 'claude')
```

**GLM env builder:**

```typescript
function buildGlmEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: process.env.ZAI_API_KEY,
    ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
    API_TIMEOUT_MS: '3000000',
  };
}
```

The Z.AI API key is read from `ZAI_API_KEY` env var (user sets this once).

### Routing table

The Supervisor or Lead picks the provider based on what the work needs:

| Work needs | Provider | Model | Why |
|---|---|---|---|
| Best reasoning (architecture, complex logic) | Claude | Opus | Top quality for critical decisions |
| Full orchestration (Build Worker, Leads) | GLM | GLM-5 / GLM-4.7 | Full Claude Code capabilities, saves Claude quota |
| Deep code review (logic reviewer) | Claude | Opus | Needs strongest reasoning |
| Medium orchestration (style review, test lead) | GLM | GLM-4.7 | Good enough, full tool access |
| Simple focused task (checklist review, unit tests) | OpenCode | GPT-4.1-mini | Single-shot, cheapest |

User can override per task by setting `Provider` and `Model` in task.md. If not set, the Supervisor uses the routing table.

### Task template changes

Add to `task-tracking/task-template.md` Metadata table:

```
| Provider   | [claude | glm | opencode | default]  |
| Model      | [model name or default]               |
```

### Reporting

- Registry shows Provider + Model per completed task
- Orchestrator-state Active Workers table shows provider + model
- `get_worker_stats` response includes provider and model

### Key files to change

**Session Orchestrator** (`/Volumes/SanDiskSSD/mine/session-orchestrator/`):
- `src/core/print-launcher.ts` — add provider param, env builder for GLM
- `src/core/token-calculator.ts` — add GLM and OpenAI pricing
- `src/core/worker-registry.ts` — add provider field
- `src/index.ts` — add provider param to spawn_worker
- New: `src/core/opencode-launcher.ts` — spawns `opencode run`

**Nitro-Fueled** (this repo):
- `task-tracking/task-template.md` — add Provider and Model fields
- `.claude/skills/auto-pilot/SKILL.md` — routing table, provider-aware spawning
- `.claude/commands/create-task.md` — prompt for provider/model (optional)

## Dependencies

- TASK_2026_019 — Fix Print Mode Token/Cost Tracking (done)
- TASK_2026_020 — Per-Task Model Selection (model field plumbing)

## Acceptance Criteria

- [ ] print-launcher supports `provider` param: `claude`, `glm`, `opencode`
- [ ] GLM workers spawn `claude --print` with Z.AI env vars
- [ ] Claude and GLM workers can run concurrently without env conflicts
- [ ] OpenCode workers spawn `opencode run --model X --format json`
- [ ] `spawn_worker` MCP tool accepts `provider` parameter
- [ ] `ZAI_API_KEY` env var used for GLM auth
- [ ] Routing table in auto-pilot skill selects best-fit provider
- [ ] Explicit Provider/Model in task.md overrides routing
- [ ] Registry and orchestrator-state show provider + model per worker
- [ ] `get_worker_stats` includes provider and model
- [ ] Task template includes optional Provider and Model fields

## References

- Session orchestrator: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Z.AI Claude Code integration: https://docs.z.ai/devpack/tool/claude
- Z.AI GLM Coding Plan: https://z.ai/subscribe
- OpenCode CLI: https://github.com/opencode-ai/opencode
- `src/core/print-launcher.ts` — current launcher (env swap happens here)
- TASK_2026_020 — Per-Task Model Selection
