# Task: Tick-Mode Auto-Pilot Skill Prompt


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
| Worker Mode           | split |


## Description

Create a new auto-pilot reference document (.claude/skills/auto-pilot/references/tick-mode.md) that defines single-tick supervisor behavior for the CLI-mode auto-pilot. The tick-mode prompt instructs the Claude Code session to:

1. Read all state from cortex DB via MCP tools (tasks, workers, events, session config)
2. Make ONE round of decisions (spawn workers for unblocked tasks, reconcile finished/stuck workers, handle retries)
3. Write all decisions back to DB via MCP tools (claim tasks, log events, update statuses)
4. Exit cleanly with a structured JSON summary of actions taken

The prompt must be fully self-contained -- no context carries over from previous ticks. Each tick is a fresh Claude Code process with no memory of prior ticks. Update SKILL.md to reference tick-mode.md and add a 'tick' execution mode alongside the existing 'parallel' and 'sequential' modes. The dashboard-api tick scheduler (separate task) will invoke this prompt repeatedly on an interval.

## Dependencies

- TASK_2026_244 -- provides the supervisor_model field and WebSocket event wiring

## Acceptance Criteria

- [ ] .claude/skills/auto-pilot/references/tick-mode.md exists with complete single-tick prompt
- [ ] Prompt reads all state from MCP DB tools (no file reads, no carried-over context)
- [ ] Prompt makes exactly one round of decisions then exits
- [ ] Exit produces structured JSON summary (workers spawned, tasks completed, errors)
- [ ] SKILL.md updated to reference tick-mode and document the 'tick' execution mode

## References

- .claude/skills/auto-pilot/SKILL.md (existing skill)
- .claude/skills/auto-pilot/references/parallel-mode.md (existing parallel reference)
- apps/dashboard-api/src/auto-pilot/session-runner.ts (tick logic to mirror)

## File Scope

- .claude/skills/auto-pilot/references/tick-mode.md (new file)
- .claude/skills/auto-pilot/SKILL.md (add tick mode reference)


## Parallelism

Depends on TASK_2026_244. Can run in parallel with TASK_2026_243 and Wave 2 frontend tasks. Wave 2.
