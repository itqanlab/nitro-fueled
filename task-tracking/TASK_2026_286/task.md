# Task: Generate .codex/ Configuration and Agent Files on Init


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Generate .codex/ configuration files on init alongside .claude/ setup. When Codex is detected as an available launcher (or always as optional config), init should generate: (1) .codex/config.toml with nitro-cortex MCP server configuration (equivalent to .mcp.json for Claude Code). (2) .codex/agents/ directory with TOML agent definitions mirroring the nitro-* agents from .claude/agents/ — translated from markdown to Codex's TOML format (fields: name, description, developer_instructions, model, sandbox_mode). (3) AGENTS.md at repo root with project conventions (generated alongside CLAUDE.nitro.md from the same ProjectProfile). Track all .codex/ files in the manifest as coreFiles so they are updated by npx nitro-fueled update. The update command must handle .codex/ files with the same checksum-based skip logic as .claude/ files. Codex spawn command is `codex exec --yolo --model <model>`, supports full MCP via config.toml [mcp_servers], and uses AGENTS.md for project instructions.

## Dependencies

- TASK_2026_282
- TASK_2026_272

## Acceptance Criteria

- [ ] init generates .codex/config.toml with nitro-cortex MCP server config
- [ ] init generates .codex/agents/*.toml mirroring nitro-* agents in Codex TOML format
- [ ] AGENTS.md generated at repo root with project conventions
- [ ] All .codex/ files tracked in manifest and updated by npx nitro-fueled update
- [ ] Codex worker can connect to nitro-cortex MCP via the generated config

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/init.ts
- apps/cli/src/commands/update.ts
- apps/cli/src/utils/manifest.ts
- apps/cli/scaffold/codex/ (new)


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_282 or TASK_2026_283 — depends on ProjectProfile and shares init.ts scope.
