# Task: Write progress snapshot to handoffs on worker kill for retry recovery


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P3-Low |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

When a GLM or other worker is killed mid-task, the retry worker (usually Claude) starts from scratch, redoing all completed work. Fix this by writing a minimal progress snapshot before killing.

## What to change
1. Before calling kill_worker(), supervisor reads the worker's last progress snapshot (message count, files changed, tool calls)
2. Calls write_handoff() with a 'partial' flag and a brief summary of what was completed
3. Retry worker prompt updated in orchestration SKILL.md: 'If a partial handoff exists for this task, read it first and skip already-completed steps'

## Acceptance Criteria
- Supervisor writes partial handoff before killing a worker
- Partial handoff includes: phases completed, files changed, key decisions made
- Retry worker reads partial handoff and skips completed steps

## Dependencies

- TASK_2026_328

## Acceptance Criteria

- [ ] Supervisor writes partial handoff before kill_worker()
- [ ] Partial handoff contains phases completed and files changed
- [ ] Retry worker checks for partial handoff and skips completed steps

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/orchestration/SKILL.md
- packages/mcp-cortex/src/tools/handoffs.ts


## Parallelism

Independent. Low priority — can run after higher priority items.
