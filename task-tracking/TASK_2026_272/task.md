# Task: Research — Multi-Launcher Data Model, Compatibility Matrix, and MCP API Spec

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | RESEARCH                     |
| Priority              | P3-Low                       |
| Complexity            | Simple                       |
| Preferred Tier        | light                        |
| Model                 | default                      |
| Testing               | skip                         |
| Worker Mode           | single                       |

## Description

Part 1 of 2 — Multi-Launcher Architecture Design (see TASK_2026_273 for Part 2).

Research and document the data model and API surface for supporting multiple launchers in the autopilot pipeline. Create `docs/multi-launcher-design.md` covering:

**Launcher vs Provider distinction** — a launcher is a CLI harness (claude-code, opencode, codex), a provider is a model API backend (anthropic, zai/glm, openai). These are separate concepts and must be modeled separately.

**Compatibility matrix** — document which launchers support which providers:
- claude-code → anthropic, zai/glm
- codex → openai only
- opencode → zai/glm, openai (NOT anthropic)

**`get_available_launchers()` MCP tool spec** — full API design: what it returns, when it is called, how it differs from `get_available_providers()`. Include example response shape.

**`spawn_worker` signature change** — current signature is `(prompt, model, provider)`. New signature adds `launcher` field: `(launcher, provider, model, prompt)`. Define defaults (omitting launcher defaults to claude-code) and validation rules (reject invalid launcher+provider combinations using the matrix).

This task produces the data model and API sections of the design doc only. Prompt templates and Supervisor routing are covered in Part 2 (TASK_2026_273).

## Dependencies

- None

## Acceptance Criteria

- [ ] `docs/multi-launcher-design.md` created with launcher vs provider distinction clearly documented
- [ ] Compatibility matrix (launcher × provider) is explicit and covers claude-code, opencode, codex
- [ ] `get_available_launchers()` API spec is fully defined (response shape, fields, example)
- [ ] `spawn_worker` new signature documented with defaults and validation rules

## References

- Existing provider routing: `.claude/skills/auto-pilot/SKILL.md` (get_available_providers usage)
- Worker spawning: `.claude/skills/auto-pilot/references/worker-prompts.md`
- MCP cortex tools: `packages/mcp-cortex/src/tools/`

## File Scope

- docs/multi-launcher-design.md

## Parallelism

✅ Can run in parallel — creates a new doc, no overlap with active tasks.
