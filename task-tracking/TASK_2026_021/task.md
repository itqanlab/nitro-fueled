# Task: Smart Provider & Model Routing

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | FEATURE    |
| Priority   | P1-High    |
| Complexity | Complex    |

## Description

Build an intelligent cost-routing system that selects the cheapest capable provider and model for each task. The goal is to avoid burning expensive Claude tokens on work that a cheaper provider or lighter model can handle.

### The Problem

Today every task runs on Claude Opus — the most expensive option. A simple README fix costs the same as a complex multi-service refactor. There's no cost intelligence.

### The Solution

Three layers of intelligence:

**Layer 1 — Provider Abstraction (Session Orchestrator)**

Add a provider adapter system to the session-orchestrator with two concrete implementations:

**Claude adapter (primary — full orchestration):**
- Binary: `claude`
- Flags: `--print`, `--dangerously-skip-permissions`, `--model <model>`, `--output-format stream-json`
- Models: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Capabilities: Full orchestration (agents, MCP, tools, multi-step pipelines)
- Output parsing: Stream JSON from stdout (per TASK_2026_019)

**OpenCode adapter (secondary — single-shot execution):**
- Binary: `opencode`
- Command: `opencode run --model <provider/model> --format json "prompt"`
- Models: Any model available through configured providers — OpenAI (`openai/o3`, `openai/o4-mini`, `openai/gpt-4.1`), Anthropic (`anthropic/claude-sonnet-4-6`), Google (`google/gemini-2.5-flash`), local (Ollama), and 75+ providers via Models.dev
- Capabilities: Single-shot execution only — prompt in, code out, no internal agent orchestration
- Output parsing: JSON format from `--format json` flag for token/cost extraction
- Concurrency-safe: Each spawn passes `--model` inline, no shared config. `OPENCODE_CONFIG` env var available as fallback for advanced overrides.

Each adapter implements:
- `buildCommand(prompt, model, workingDir)` → spawn args
- `parseOutput(line)` → normalized `{ tokens, cost, progress, isDone }`
- `getModels()` → available models with pricing
- `detectCompletion(output)` → boolean

The `spawn_worker` MCP tool gets two new optional params:
- `provider`: `claude | opencode` (default: `claude`)
- `model`: provider-specific model string (default: provider's default)

**Layer 2 — Model-Aware Orchestration (Nitro-Fueled)**

The orchestration skill adapts its pipeline based on what the provider and model can handle:

| Provider | Model Tier | Pipeline |
|----------|-----------|----------|
| Claude | Opus | Full: PM → Architect → Team Leader → Dev → Review |
| Claude | Sonnet | Simplified: PM → Architect → Dev → Review (skip Team Leader, fewer nested agents) |
| Claude | Haiku | Minimal: Single-pass Dev → Review (no multi-agent nesting) |
| OpenCode | Any | Bare: Single-shot prompt → code output (no orchestration skill, no agents) |

The Build Worker prompt should include a `## Model Constraints` section that tells the orchestration skill what to simplify. The auto-pilot skill reads provider + model from task.md and adjusts the worker prompt accordingly.

**Layer 3 — Smart Cost Router (Auto-Pilot Supervisor)**

The Supervisor gains a cost-routing decision function that runs before spawning each worker. It evaluates:

| Signal | Source | What it tells the router |
|--------|--------|------------------------|
| Task type | task.md `Type` field | BUGFIX/DOCUMENTATION → simpler, FEATURE/REFACTORING → may be complex |
| Complexity | task.md `Complexity` field | Simple → cheap model, Complex → expensive model |
| Priority | task.md `Priority` field | P0-Critical → prefer accuracy (Opus), P3-Low → prefer cost (Sonnet/OpenCode) |
| Explicit override | task.md `Provider` and `Model` fields | User's explicit choice always wins |
| Estimated scope | Acceptance criteria count, description length | More criteria → more complex → stronger model |

**Default routing table (when no explicit Provider/Model is set):**

| Complexity | Priority | Recommended | Rationale |
|-----------|----------|-------------|-----------|
| Simple | Any | OpenCode `openai/o4-mini` | Cheapest option for trivial work |
| Simple | P0-Critical | Claude Sonnet | Critical but simple — needs reliability |
| Medium | P3-Low / P2-Medium | Claude Sonnet | Good enough, saves cost |
| Medium | P1-High / P0-Critical | Claude Opus | Needs full reasoning |
| Complex | Any | Claude Opus | Full pipeline, max capability |

The user can always override by setting `Provider` and `Model` explicitly in task.md. The router's suggestions are defaults, not mandates.

### Task Template Changes

Add to `task-tracking/task-template.md` Metadata table:

```
| Provider   | [claude | opencode | default]                                                   |
| Model      | [provider-specific model or default]                                            |
```

When both are `default`, the cost router decides. When set explicitly, the router is bypassed.

### OpenCode Model Format

OpenCode models use `provider/model` format:
- `openai/o4-mini`, `openai/o3`, `openai/gpt-4.1`
- `anthropic/claude-sonnet-4-6`, `anthropic/claude-haiku-4-5-20251001`
- `google/gemini-2.5-flash`, `google/gemini-2.5-pro`
- Any model from Models.dev catalog

### Reporting

- Registry gets `Provider` and `Model` columns for completed tasks
- Orchestrator-state Active Workers table shows provider + model per worker
- `get_worker_stats` response includes provider and model
- After a batch completes, the Supervisor logs a cost summary: total tokens, total cost, breakdown by provider/model

### Key Files

**Session Orchestrator** (`/Volumes/SanDiskSSD/mine/session-orchestrator/`):
- `src/core/print-launcher.ts` → refactor into provider adapters
- `src/core/token-calculator.ts` → add OpenAI/multi-provider pricing table
- `src/core/worker-registry.ts` → add provider field
- `src/index.ts` → add provider/model params to spawn_worker

**Nitro-Fueled** (this repo):
- `task-tracking/task-template.md` → add Provider and Model fields
- `.claude/skills/auto-pilot/SKILL.md` → cost router logic, model-aware spawning
- `.claude/skills/orchestration/SKILL.md` → model-aware strategy adaptation
- `.claude/commands/create-task.md` → prompt for provider/model (optional)

## Dependencies

- TASK_2026_019 — Fix Print Mode Token/Cost Tracking (stdout parsing foundation)
- TASK_2026_020 — Per-Task Model Selection (model field plumbing)

## Acceptance Criteria

- [ ] Session orchestrator supports Claude and OpenCode as providers via adapter pattern
- [ ] `spawn_worker` accepts `provider` and `model` parameters
- [ ] OpenCode adapter spawns `opencode run --model <model> --format json "prompt"`
- [ ] OpenCode adapter parses JSON output for token/cost data
- [ ] Concurrent OpenCode workers can use different models without conflict
- [ ] Orchestration skill adapts pipeline depth based on provider and model tier
- [ ] OpenCode tasks bypass orchestration skill and run as single-shot execution
- [ ] Cost router recommends provider/model based on task type, complexity, and priority
- [ ] Explicit Provider/Model in task.md overrides the cost router
- [ ] Registry and orchestrator-state show provider + model per task/worker
- [ ] `get_worker_stats` includes provider and model in response
- [ ] Supervisor logs cost summary after batch completion
- [ ] Task template includes optional Provider and Model fields
- [ ] /create-task supports provider and model selection

## References

- Session orchestrator repo: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Task template: `task-tracking/task-template.md`
- OpenCode CLI docs: https://opencode.ai/docs/cli/
- OpenCode config docs: https://opencode.ai/docs/config/
- OpenCode providers: https://opencode.ai/docs/providers/
- OpenCode GitHub: https://github.com/opencode-ai/opencode
- TASK_2026_019: Fix Print Mode Token/Cost Tracking
- TASK_2026_020: Per-Task Model Selection
