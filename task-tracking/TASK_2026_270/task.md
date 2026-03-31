# Task: MCP Cortex: Launcher-Aware spawn_worker and get_available_providers


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P3-Low |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Extend the nitro-cortex MCP server to support multiple worker launcher types, not just Claude Code. Two changes required: (1) Add a `launcher` parameter to the `spawn_worker` tool. When `launcher: "codex"` is passed, invoke the Codex CLI instead of the Claude Code CLI. When absent or `launcher: "claude-code"`, behavior is unchanged. (2) Update `get_available_providers()` to return launcher-aware entries — each provider entry gains a `launcher` field (e.g., `{ id: "codex", launcher: "codex", model: "..." }`). Existing claude/glm entries get `launcher: "claude-code"` added. This is the infrastructure layer that enables non-Claude workers; the prompt adapter and supervisor routing are handled in a follow-on task.

## Dependencies

- None

## Acceptance Criteria

- [ ] spawn_worker accepts optional launcher param; defaults to claude-code when absent
- [ ] spawn_worker invokes the Codex CLI when launcher=codex is passed
- [ ] get_available_providers() returns a launcher field on every provider entry
- [ ] Existing claude and glm provider entries are backward-compatible (launcher field added, nothing else changed)
- [ ] Unit tests cover both launcher paths in spawn_worker

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/spawn-worker.ts
- packages/mcp-cortex/src/tools/get-available-providers.ts


## Parallelism

✅ Can run in parallel — touches only MCP cortex internals, no overlap with active tasks
