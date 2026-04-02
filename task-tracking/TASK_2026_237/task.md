# Task: Hybrid DB Architecture — Project-Level + Global DB

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | single      |

## Description

Implement a hybrid database architecture with two SQLite databases: a per-project DB for project-specific data and a user-level global DB for cross-project data.

**Per-project DB** (`<project>/.nitro/cortex.db`):
- Tasks, sessions, workers, events (existing — relocate from `packages/mcp-cortex/data/`)
- Agents and workflows (project-specific definitions from TASK_2026_222)
- Project-specific configuration

**Global DB** (`~/.nitro-fueled/global.db`):
- Compatibility data (cross-project learning from TASK_2026_235)
- Launcher registry (installed launchers, config from TASK_2026_234)
- User preferences (default launcher, per-task-type preferences)
- Cross-project telemetry aggregates

**Changes required:**

1. **Cortex MCP server** — accept two DB paths on init: `--project-db` and `--global-db`. Route queries to the correct DB based on data type.

2. **DB connection manager** — new module that manages connections to both databases. Exposes `projectDb` and `globalDb` handles.

3. **Migration** — move existing `packages/mcp-cortex/data/cortex.db` to `<project>/.nitro/cortex.db`. Add `.nitro/` to `.gitignore`.

4. **Global DB initialization** — on first run, create `~/.nitro-fueled/global.db` with compatibility, launchers, and preferences tables.

5. **Server supervisor** — connects to both DBs. Reads project tasks from project DB, reads launcher/compatibility data from global DB.

6. **`npx @itqanlab/nitro-fueled init`** — creates `.nitro/` directory in project root, initializes project DB, ensures global DB exists at `~/.nitro-fueled/`.

## Dependencies

- TASK_2026_222 — DB schema extension (defines the tables that need to be split between project/global)

## Acceptance Criteria

- [ ] Project DB created at `<project>/.nitro/cortex.db` with project-specific tables
- [ ] Global DB created at `~/.nitro-fueled/global.db` with cross-project tables
- [ ] Cortex MCP server connects to both DBs via config
- [ ] Existing data migrated from old location to new project DB
- [ ] `.nitro/` added to `.gitignore`
- [ ] Server supervisor reads from both DBs correctly
- [ ] `init` command creates both DB locations

## References

- Current DB location: `packages/mcp-cortex/data/cortex.db`
- Current schema: `packages/mcp-cortex/src/db/schema.ts`
- Cortex MCP entry: `packages/mcp-cortex/src/index.ts`

## File Scope

- `packages/mcp-cortex/src/db/connection-manager.ts` (new)
- `packages/mcp-cortex/src/db/schema.ts` (modified — split tables)
- `packages/mcp-cortex/src/db/global-schema.ts` (new)
- `packages/mcp-cortex/src/index.ts` (modified — dual DB init)
- `.gitignore` (modified — add .nitro/)
- `apps/cli/src/commands/init.ts` (modified — create .nitro/)

## Parallelism

Can run in parallel with most tasks. Depends on TASK_2026_222 for the full table set. Should run before TASK_2026_234 (launcher registry) and TASK_2026_235 (compatibility tracking) since those write to the global DB.
