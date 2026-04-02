# Task: Workspace Management — Register, Switch, List Projects

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

Part 2 of 3 — original request: Move server, webapp, and DB to user scope. Run from anywhere, switch between projects/workspaces.

Build the workspace management layer. A workspace is a registered project that the global server manages. Each workspace gets its own project DB.

**CLI commands:**

1. `nitro-fueled workspace add [path]` — register a project directory as a workspace:
   - Scan project for tech stack (package.json, angular.json, etc.)
   - Create `.nitro/config.json` in the project directory (links to global server)
   - Create project DB at `~/.nitro-fueled/workspaces/<workspace-name>.db`
   - Initialize DB with schema
   - Output: "Workspace 'my-app' registered"

2. `nitro-fueled workspace remove <name>` — unregister a workspace:
   - Remove project DB (with confirmation)
   - Remove `.nitro/config.json` from project
   - Keep `.claude/` files (those belong to Claude Code)

3. `nitro-fueled workspace list` — show all registered workspaces:
   - Name, path, tech stack, task count, last active

4. `nitro-fueled workspace switch <name>` — set active workspace for CLI context:
   - All subsequent commands target this workspace
   - Auto-detected from CWD if inside a registered project

5. **Auto-detection** — when running any CLI command inside a registered project directory, automatically use that workspace. No explicit switch needed.

**`.nitro/config.json` format:**
```json
{
  "workspace": "my-angular-app",
  "registeredAt": "2026-03-31T...",
  "serverUrl": "http://localhost:4200",
  "stack": ["angular", "nestjs", "typescript"]
}
```

**Server-side workspace registry:**
- Global DB `workspaces` table: id, name, path, stack (JSON), created_at, last_active_at
- API: `GET /api/workspaces`, `POST /api/workspaces`, `DELETE /api/workspaces/:id`

## Dependencies

- TASK_2026_238 — Global install + user-scope server

## Acceptance Criteria

- [ ] `workspace add` registers a project and creates project DB
- [ ] `workspace remove` unregisters and cleans up
- [ ] `workspace list` shows all registered workspaces with metadata
- [ ] Auto-detection works from CWD inside registered project
- [ ] `.nitro/config.json` created in project directory
- [ ] Server API endpoints for workspace CRUD

## References

- CLI commands: `apps/cli/src/commands/`
- Global DB: TASK_2026_237

## File Scope

- `apps/cli/src/commands/workspace.ts` (new)
- `apps/cli/src/utils/workspace-detector.ts` (new)
- `apps/dashboard-api/src/workspaces/workspaces.controller.ts` (new)
- `apps/dashboard-api/src/workspaces/workspaces.service.ts` (new)
- `apps/dashboard-api/src/workspaces/workspaces.module.ts` (new)

## Parallelism

Can run in parallel — all new files. Depends on TASK_2026_238.
