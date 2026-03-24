# Task: Dashboard CLI Command + Service Integration

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | FEATURE    |
| Priority   | P2-Medium  |
| Complexity | Medium     |

## Description

Wire the Data Service and Web Client into the existing CLI, and integrate with the Supervisor so the dashboard is available during auto-pilot runs.

This task connects the pieces from TASK_2026_022 (data service) and TASK_2026_023 (web client) into a cohesive developer experience.

### CLI Command

Add `dashboard` command to `packages/cli/src/commands/`:

```bash
npx nitro-fueled dashboard              # Start data service + serve web UI + open browser
npx nitro-fueled dashboard --service    # Start data service only (headless, for external clients)
npx nitro-fueled dashboard --port 4200  # Custom port (default: auto-assign)
npx nitro-fueled dashboard --no-open    # Start but don't open browser
```

### Supervisor Integration

When the Supervisor starts via `/auto-pilot` or `npx nitro-fueled run`:
1. Auto-start the Data Service in the background (if not already running)
2. Print the dashboard URL in the Supervisor startup log
3. Dashboard stays running for the duration of the auto-pilot session
4. Graceful shutdown when Supervisor stops

This means the Product Owner can open the dashboard URL at any time during an auto-pilot run and see live worker activity without running a separate command.

### Service Discovery

The Data Service writes a `.dashboard-port` file to `task-tracking/` on startup containing the port number. This allows:
- The CLI to detect if a service is already running (avoid double-start)
- External tools to discover the service port
- The Supervisor integration to find and reuse an existing service

### Package Integration

```
packages/
├── cli/                      # Existing CLI
│   └── src/commands/
│       └── dashboard.ts      # New command — starts service + serves web
├── dashboard-service/        # From TASK_2026_022
└── dashboard-web/            # From TASK_2026_023
    └── dist/                 # Built static files
```

The CLI's `dashboard` command:
1. Imports and starts the data service
2. Configures it to serve the web client's `dist/` as static files
3. Opens the browser to `http://localhost:<port>`

### Build Pipeline

Add npm scripts to build the full dashboard:

```json
{
  "scripts": {
    "build:dashboard": "npm run build --workspace=packages/dashboard-web && npm run build --workspace=packages/dashboard-service",
    "dashboard": "node packages/cli/dist/index.js dashboard"
  }
}
```

The web client must be built before the CLI package is published so the static files are included.

## Dependencies

- TASK_2026_022 — Dashboard Data Service
- TASK_2026_023 — Dashboard Web Client

## Acceptance Criteria

- [ ] `npx nitro-fueled dashboard` starts the data service, serves the web UI, and opens the browser
- [ ] `--service` flag starts headless data service only
- [ ] `--port` flag allows custom port selection
- [ ] `--no-open` flag prevents browser auto-open
- [ ] Service writes `.dashboard-port` file for discovery
- [ ] CLI detects and reuses already-running service (no double-start)
- [ ] Supervisor auto-starts data service on `/auto-pilot` or `npx nitro-fueled run`
- [ ] Dashboard URL printed in Supervisor startup log
- [ ] Graceful shutdown when Supervisor stops or CLI exits (SIGINT/SIGTERM)
- [ ] `.dashboard-port` file cleaned up on shutdown
- [ ] Build pipeline produces a self-contained CLI package with embedded web assets

## References

- Existing CLI: `packages/cli/`
- Data Service: TASK_2026_022
- Web Client: TASK_2026_023
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
