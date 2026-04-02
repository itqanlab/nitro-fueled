# Task: Auto-Pilot Skill: Use stage_and_commit MCP Instead of Bash Git


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

The auto-pilot supervisor and its spawned workers currently use Bash git commands for commits. The cortex MCP has a stage_and_commit tool that should be used instead for consistency and to avoid shell escaping issues. Update the auto-pilot SKILL.md and worker prompt templates to instruct workers to use stage_and_commit MCP tool for all git operations. The supervisor itself should also use it when committing status file changes.

## Dependencies

- TASK_2026_254

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md references stage_and_commit MCP tool for all commit operations
- [ ] Worker prompt templates instruct workers to use stage_and_commit instead of bash git
- [ ] Supervisor uses stage_and_commit for its own commits (status files, registry)
- [ ] Bash git commands removed from skill instructions

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/worker-prompts.md
- .claude/skills/auto-pilot/references/parallel-mode.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_241 or TASK_2026_242 — same files
