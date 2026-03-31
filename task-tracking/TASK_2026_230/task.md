# Task: Instrument Worker Lifecycle — Emit Telemetry Events

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Simple      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Instrument both supervisor modes (session and server) to emit telemetry data at every stage of the worker lifecycle. This ensures the telemetry fields from TASK_2026_229 are actually populated.

**Instrumentation points:**

1. **Worker spawn** — record: launcher_type, model_used, spawn timestamp, retry_number, workflow_phase
2. **First output detected** — record: spawn_to_first_output_ms
3. **Health check** — record: health state transitions (already partially done)
4. **Worker complete** — record: total_duration_ms, exit code, files_changed (from git diff), estimated_cost_usd
5. **Review complete** — record: review_result, review_findings_count
6. **Worker killed/failed** — record: failure reason, duration at time of kill

**For session mode:** Update auto-pilot skill to call `upsert_task` / worker update MCP tools with telemetry data at each point.

**For server mode:** Supervisor service emits telemetry via direct DB writes (same Cortex DB).

Both modes write to the same telemetry fields — reporting doesn't care which mode produced the data.

## Dependencies

- TASK_2026_229 — Telemetry schema must exist first

## Acceptance Criteria

- [ ] All 6 lifecycle points emit telemetry data
- [ ] Session-mode auto-pilot populates telemetry via MCP
- [ ] Server-mode supervisor populates telemetry via DB
- [ ] Telemetry data queryable via MCP tools from TASK_2026_229

## References

- Telemetry schema: TASK_2026_229
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Supervisor service: TASK_2026_224

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` (modified — add telemetry calls)
- `apps/dashboard-api/src/supervisor/supervisor.service.ts` (modified — add telemetry)

## Parallelism

Depends on TASK_2026_229. Conflicts with TASK_2026_226 (both modify auto-pilot) — run after 226.
