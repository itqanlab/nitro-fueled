# Task: Compatibility Tracking — Record Execution Outcomes

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

Instrument the supervisor (both modes) to record execution outcomes in the compatibility table (from TASK_2026_222) after every worker completes. This is the data collection step for the intelligence layer.

**What to record per worker completion:**

- `launcher_type` — which launcher ran the worker
- `model` — which model was used
- `task_type` — FEATURE, BUGFIX, REFACTORING, etc.
- `workflow_phase` — pm, architect, dev, qa, review
- `outcome` — success, failed, killed
- `duration_ms` — how long the worker ran
- `cost_estimate` — estimated cost in USD
- `review_pass` — did the review pass on first try (boolean)
- `project_stack` — detected tech stack (angular, react, nestjs, etc.) — for cross-project learning

**Both supervisor modes** (session and server) write to the same compatibility table. The data accumulates over time and becomes the basis for auto-routing in TASK_2026_236.

## Dependencies

- TASK_2026_222 — Compatibility table in Cortex DB
- TASK_2026_230 — Telemetry instrumentation (provides the raw data)

## Acceptance Criteria

- [ ] Every worker completion writes a row to the compatibility table
- [ ] All fields populated from telemetry data
- [ ] Works in both session-mode and server-mode supervisors
- [ ] Data queryable via MCP compatibility tools from TASK_2026_222

## References

- Compatibility table: TASK_2026_222
- Telemetry data: TASK_2026_229, TASK_2026_230

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` (modified — add compatibility write)
- `apps/dashboard-api/src/supervisor/supervisor.service.ts` (modified — add compatibility write)

## Parallelism

Conflicts with TASK_2026_226 and TASK_2026_230 (all modify auto-pilot). Run in a later wave after both complete.
