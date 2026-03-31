# Task: Auto-Pilot Skill: Respect Supervisor Model from Session Config


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Update the auto-pilot skill (SKILL.md and supporting references) to read the supervisor_model from session config when the supervisor is launched via the dashboard API. Currently the auto-pilot skill runs as a Claude Code session with whatever model was specified at launch time. This task ensures that when the dashboard spawns a supervisor process, it passes the configured supervisor_model (e.g., haiku) as the --model flag, and the skill's worker spawn logic continues to use per-task model settings from task metadata independently. The skill itself does not need code changes -- this is primarily about ensuring the session-runner in the dashboard-api correctly wires the supervisor_model to the Claude CLI --model flag, and documenting the model separation in the skill reference files.

## Dependencies

- TASK_2026_244 -- provides the supervisor_model field in SupervisorConfig and session spawn logic

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md documents that the supervisor model is controlled by session config, not hardcoded
- [ ] Worker prompts reference confirms workers use per-task model, not supervisor model
- [ ] Session-runner spawns supervisor Claude process with --model flag from config.supervisor_model
- [ ] No regression in existing auto-pilot behavior when supervisor_model is not provided (defaults to haiku)

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md (documentation update)
- .claude/skills/auto-pilot/references/parallel-mode.md (model separation docs)
- apps/dashboard-api/src/auto-pilot/session-runner.ts (verify --model flag wiring)


## Parallelism

Must run after TASK_2026_244. Can run in parallel with TASK_2026_243 and TASK_2026_246. Wave 2.
