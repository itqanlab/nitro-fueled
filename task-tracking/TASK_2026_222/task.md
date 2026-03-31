# Task: Extend Cortex DB Schema — Agents, Workflows, Launchers, Compatibility

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Extend the Cortex MCP SQLite schema with new tables to support the agnostic architecture. Currently Cortex stores tasks, sessions, workers, events. Add tables for:

1. **`agents`** — Agent definitions (currently in .md files):
   - id, name, description, capabilities (JSON array), prompt_template, launcher_compatibility (JSON), created_at, updated_at

2. **`workflows`** — Workflow definitions (currently hardcoded):
   - id, name, description, phases (JSON array of {name, required_capability, next_phase}), is_default, created_at, updated_at

3. **`launchers`** — Registered launcher adapters:
   - id, type (claude-code, codex, cursor, etc.), config (JSON), status (active/inactive), created_at, updated_at

4. **`compatibility`** — Execution outcome tracking for intelligence layer:
   - id, launcher_type, model, task_type, workflow_id, outcome (success/failed/killed), duration_ms, cost_estimate, review_pass, created_at

Add corresponding MCP tools for CRUD operations on each table. Seed the workflows table with the current PM->Architect->Dev->QA pipeline as the default workflow.

## Dependencies

- None

## Acceptance Criteria

- [ ] Four new tables created in Cortex SQLite schema
- [ ] MCP tools for CRUD on agents, workflows, launchers tables
- [ ] MCP query tool for compatibility data (filter by launcher, model, task_type)
- [ ] Default workflow seeded matching current PM->Architect->Dev->QA pipeline
- [ ] Existing tables and tools unaffected

## References

- Current schema: `packages/mcp-cortex/src/db/schema.ts`
- Current MCP tools: `packages/mcp-cortex/src/tools/`

## File Scope

- `packages/mcp-cortex/src/db/schema.ts` (modified)
- `packages/mcp-cortex/src/tools/agent-tools.ts` (new)
- `packages/mcp-cortex/src/tools/workflow-tools.ts` (new)
- `packages/mcp-cortex/src/tools/launcher-tools.ts` (new)
- `packages/mcp-cortex/src/tools/compatibility-tools.ts` (new)

## Parallelism

Can run in parallel — touches only mcp-cortex package. No overlap with other CREATED tasks except TASK_2026_185/186 (different files within mcp-cortex).
