# Task: Launcher Registry + Dashboard Configuration

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Simple      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Build the launcher registry that discovers and manages available launchers, plus a dashboard UI for configuring launcher preferences.

**Registry (server-side):**

1. On startup, scan for available launchers:
   - Check if `claude` CLI is available (Claude Code adapter)
   - Check if `codex` CLI or API key is available (Codex adapter)
   - Check for other configured adapters
2. Register available launchers in Cortex DB (launchers table from TASK_2026_222)
3. Expose via API: `GET /api/launchers` (list), `PATCH /api/launchers/:id` (update config/status)

**Dashboard UI:**

1. Launchers settings page at `/settings/launchers`
2. Show registered launchers with status (active/inactive/unavailable)
3. Per-launcher config: enable/disable, set as default, model preferences
4. "Test Connection" button — spawns a minimal test worker to verify the launcher works

**User preferences:**
- Default launcher for new workers
- Per-task-type launcher preferences ("use Codex for BUGFIX, Claude for FEATURE")
- These preferences stored in Cortex DB, read by supervisor when routing

## Dependencies

- TASK_2026_222 — Cortex launchers table
- TASK_2026_221 — At least one adapter to register

## Acceptance Criteria

- [ ] Launcher discovery runs on server startup
- [ ] Available launchers registered in DB
- [ ] API endpoints for listing and configuring launchers
- [ ] Dashboard page shows launcher status and config
- [ ] User can set per-task-type launcher preferences

## References

- Launchers DB table: TASK_2026_222
- Dashboard patterns: `apps/dashboard/src/app/views/`

## File Scope

- `apps/dashboard-api/src/launchers/launcher-registry.service.ts` (new)
- `apps/dashboard-api/src/launchers/launchers.controller.ts` (new)
- `apps/dashboard-api/src/launchers/launchers.module.ts` (new)
- `apps/dashboard/src/app/views/settings/launchers/` (new)

## Parallelism

Can run in parallel — entirely new files. No conflicts.
