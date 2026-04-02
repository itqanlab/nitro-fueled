# Task: Wire auto-pilot supervisor to log session metadata, phases, and reviews


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Part 2 of 2 — original request: Fix session telemetry gaps. Depends on TASK_2026_271.

Update the auto-pilot supervisor skill (.claude/skills/auto-pilot/SKILL.md) to call the MCP telemetry tools at the right points in the supervisor loop:

1. On session start: call update_session with supervisor_model (the model running the supervisor) and mode ('auto-pilot')
2. On session end: call update_session with total_cost computed by summing cost_json.total_usd across all workers for the session (query via get_worker_stats or list_workers)
3. After each build/implement worker completes: call log_phase with worker_run_id, task_id, phase (derived from worker_type), model, spawn_time as start, completion time as end, duration_minutes, input/output tokens from tokens_json, and outcome
4. After each review worker completes: call log_review with task_id, review_type='code-logic', score and findings_count parsed from the worker's review_result JSON field, and model fields

## Dependencies

- TASK_2026_271

## Acceptance Criteria

- [ ] Supervisor calls update_session with supervisor_model and mode on session start
- [ ] Supervisor calls update_session with total_cost on session end
- [ ] log_phase is called after each build/implement worker completes with correct token and timing fields
- [ ] log_review is called after each review worker completes with score and model fields
- [ ] New sessions show non-null cost, mode, supervisor model, task duration, and review scores in the dashboard

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_271 — depends on it. Wave 2, after TASK_2026_271 completes.
