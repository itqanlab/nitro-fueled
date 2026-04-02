# Task: Global Install + User-Scope Server Architecture

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

Part 1 of 3 — original request: Move server, webapp, and DB to user scope (`~/.nitro-fueled/`). Run from anywhere, switch between projects/workspaces.

Restructure the package so it installs globally and runs the server + dashboard from `~/.nitro-fueled/` instead of from inside each project.

**Changes:**

1. **Global install target** — `npm install -g @itqanlab/nitro-fueled` installs the server, dashboard, and cortex as a single global package.

2. **`~/.nitro-fueled/` directory structure:**
   ```
   ~/.nitro-fueled/
     server/           ← bundled NestJS server + dashboard
     global.db         ← launchers, compatibility, user prefs
     workspaces/       ← per-workspace project DBs
     config.json       ← global config (port, default workspace, etc.)
   ```

3. **`nitro-fueled start`** — starts the server from `~/.nitro-fueled/server/`. Runs as a background process (or foreground with `--foreground`). Serves both API and dashboard webapp on a single port (default 4200).

4. **`nitro-fueled stop`** — stops the running server.

5. **`nitro-fueled status`** — shows server status, active workspaces, running workers (works from any directory).

6. **Build pipeline** — update Nx build to produce a distributable bundle that gets installed to `~/.nitro-fueled/server/` on global install.

## Dependencies

- TASK_2026_237 — Hybrid DB architecture (project DB + global DB split)

## Acceptance Criteria

- [ ] `npm install -g @itqanlab/nitro-fueled` installs server + dashboard globally
- [ ] `~/.nitro-fueled/` directory created with correct structure on first run
- [ ] `nitro-fueled start` runs server from user scope, accessible at localhost
- [ ] `nitro-fueled stop` cleanly shuts down the server
- [ ] `nitro-fueled status` works from any directory
- [ ] Server serves both API and dashboard webapp

## References

- Current CLI: `apps/cli/src/`
- Current dashboard-api: `apps/dashboard-api/src/`
- Current dashboard: `apps/dashboard/src/`

## File Scope

- `apps/cli/src/commands/start.ts` (modified)
- `apps/cli/src/commands/stop.ts` (new)
- `apps/cli/src/utils/server-manager.ts` (new)
- `apps/cli/src/utils/paths.ts` (new — ~/.nitro-fueled/ path constants)
- `project.json` or `package.json` (modified — build bundling)

## Parallelism

Can run in parallel — new files mostly. Depends on TASK_2026_237.
