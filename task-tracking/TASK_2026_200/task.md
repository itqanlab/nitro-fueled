# Task: Session Run Configuration Panel + Queue Empty State

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | FEATURE                      |
| Priority              | P1-High                      |
| Complexity            | Medium                       |
| Preferred Tier        | balanced                     |
| Model                 | default                      |
| Testing               | optional                     |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

Two tightly coupled improvements to the auto-pilot trigger flow in the dashboard:

### 1. Session Run Configuration Panel

Before launching an auto-pilot session, the user must be able to configure session limits via the dashboard UI. Currently `StartAutoPilotOptions` only has `dryRun: boolean`. This task expands that to expose all meaningful session knobs:

- **Max Retries** (0–5, default 2) — how many times to retry a failed worker before marking the task FAILED
- **Max Compactions** (0–10, default 3) — kill a worker if it compacts this many times (runaway context signal)
- **Poll Interval** (10s–5m, default 30s) — how often the supervisor polls for worker state changes
- **Concurrency** (1–10, default 3) — max parallel workers at once
- **Dry Run** (boolean, default false) — simulate without spawning real workers

The panel appears as a collapsible "Advanced Options" section in the Launch Auto-Pilot modal/dialog. Default values are pre-filled. The panel persists last-used values to localStorage so users don't re-enter each time.

**Backend changes required:**
- Expand `StartAutoPilotOptions` in `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts`
- Wire new options through `AutoPilotService` to the CLI `run` command invocation
- Expand the API DTO in `apps/dashboard-api/src/auto-pilot/dto/` (or equivalent)

**Frontend changes required:**
- Add form controls for all new options in the launch dialog
- Validate ranges (e.g., concurrency 1–10, poll interval 10s–300s)
- Persist last-used config to localStorage key `nitro.autopilot.lastConfig`
- Show current config summary in the session header once running

### 2. Queue Empty State + Re-Run Affordance

When all tasks in queue are processed (no CREATED or IN_PROGRESS tasks remain), the dashboard must handle this gracefully:

- **Empty queue banner** — replaces the session progress area with a clear "Queue empty — nothing left to run" state (not an error)
- **Re-run button** — "Launch New Session" CTA that opens the config panel to start a new auto-pilot run
- **Stats summary** — shows a quick recap: X tasks completed, Y failed, Z cancelled, session duration
- **Distinction from error states** — queue empty is a success state (green/neutral), not an error (red)

The current UI likely shows a blank/loading state or error when the queue drains — this replaces that with intentional UX.

## Dependencies

- None

## Acceptance Criteria

- [ ] `StartAutoPilotOptions` backend model includes `maxRetries`, `maxCompactions`, `pollIntervalSeconds`, `concurrency`, and `dryRun`
- [ ] All new options are wired through `AutoPilotService` to the underlying CLI invocation
- [ ] Dashboard launch dialog shows "Advanced Options" collapsible section with all 5 config fields
- [ ] Fields have correct validation: concurrency 1–10, poll interval 10–300s, max retries 0–5, max compactions 0–10
- [ ] Last-used config is persisted to localStorage and restored on next open
- [ ] When queue is empty (no CREATED/IN_PROGRESS tasks), an explicit "Queue empty" state is shown — not a blank/error state
- [ ] A "Launch New Session" CTA is visible in the empty queue state and opens the config panel
- [ ] Empty queue state shows a stats summary (completed, failed, cancelled counts, session duration)
- [ ] Dry run mode is visually distinguished (e.g., banner or badge) when active

## References

- `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` — `StartAutoPilotOptions` (currently only `dryRun`)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` — session launch logic
- `apps/dashboard/src/app/views/project/` — current auto-pilot trigger area
- `apps/dashboard/src/app/services/api.service.ts` — frontend API calls
- TASK_2026_164 — Auto-Pilot Dashboard (existing session monitor; this task extends it, not replaces it)

## Parallelism

✅ Can run in parallel — touches different files from TASK_2026_199. The only potential conflict is `apps/dashboard/src/app/views/project/` if another task modifies the project view; check file scope before running concurrently.

Suggested execution wave: Wave 1 (alongside TASK_2026_199).

## File Scope

- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (modified — expand StartAutoPilotOptions)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (modified — wire new options to CLI)
- apps/dashboard/src/app/views/project/project.component.ts (modified — launch dialog + empty state)
- apps/dashboard/src/app/views/project/project.component.html (modified — config panel + empty state UI)
- apps/dashboard/src/app/services/api.service.ts (modified — pass new options in POST body)
