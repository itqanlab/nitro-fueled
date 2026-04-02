# Task: CLI and MCP — DB-Only Task Creation, Remove File-Based Artifacts

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | REFACTORING                  |
| Priority              | P1-High                      |
| Complexity            | Medium                       |
| Preferred Tier        | balanced                     |
| Model                 | default                      |
| Testing               | required                     |
| Worker Mode           | split                        |

## Description

Remove all file-based task tracking from the CLI and MCP cortex. create_task MCP tool writes to DB only — no folder creation, no status file, no task.md file. CLI create command calls create_task MCP and prints confirmation — no filesystem writes. CLI status command reads from DB via get_tasks — remove registry.md generation. Remove active-sessions.md writes from all code paths. Remove sessions/ folder creation. Add .nitro/cortex.db to .gitignore template in the init command. Add `npx nitro-fueled export` command that renders DB state to markdown files on demand for human review (task list, individual task details, session summaries). Keep task-template.md as a reference doc in docs/.

## Dependencies

- TASK_2026_288 — MCP artifact tools must exist before removing file paths

## Acceptance Criteria

- [ ] create_task MCP tool writes to DB only (no folder or file creation)
- [ ] CLI create command uses MCP only (no filesystem writes)
- [ ] CLI status reads from DB (no registry.md generation)
- [ ] .nitro/cortex.db in .gitignore template
- [ ] `npx nitro-fueled export` renders DB to markdown on demand

## References

- Current create_task: packages/mcp-cortex/src/tools/tasks.ts
- CLI create: apps/cli/src/commands/create.ts
- CLI status: apps/cli/src/commands/status.ts
- CLI init: apps/cli/src/commands/init.ts

## File Scope

- packages/mcp-cortex/src/tools/tasks.ts
- apps/cli/src/commands/create.ts
- apps/cli/src/commands/status.ts
- apps/cli/src/commands/init.ts
- apps/cli/src/commands/export.ts (new)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_289 or TASK_2026_290 — depends on TASK_2026_288 and shares CLI scope.
