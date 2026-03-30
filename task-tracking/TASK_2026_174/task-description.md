# TASK_2026_174: GLM-5 Reliability Investigation — Health Check Tuning

## Objective

Investigate the GLM-5 worker reliability issues called out in `RETRO_2026-03-30.md`, identify the dominant failure modes from 2026-03-27 through 2026-03-30 session evidence, and recommend routing and health-check changes that reduce wasted retries and fallback cost.

## Scope

- Review retrospective and session evidence for GLM-5 failures.
- Classify the observed failure modes.
- Compare failures against task type and complexity metadata.
- Recommend concrete operational changes for health checks, routing, and prompt design.
- Propose follow-on tasks if the recommendations require implementation work.

## Evidence Sources

- `task-tracking/retrospectives/RETRO_2026-03-30.md`
- `task-tracking/retrospectives/RETRO_2026-03-28_3.md`
- `task-tracking/sessions/SESSION_2026-03-28_03-27-33/`
- `task-tracking/sessions/SESSION_2026-03-28_11-13-12/`
- `task-tracking/sessions/SESSION_2026-03-28_13-58-21/`
- `task-tracking/sessions/SESSION_2026-03-28_16-12-00/`
- `task-tracking/sessions/SESSION_2026-03-28_16-39-39/`
- `task-tracking/sessions/SESSION_2026-03-30_03-40-31/`

## Deliverables

- Evidence-backed investigation report with failure taxonomy and counts.
- Recommendation set covering health checks, routing, and prompt changes.
- Follow-on task proposals for supervisor and routing updates.
