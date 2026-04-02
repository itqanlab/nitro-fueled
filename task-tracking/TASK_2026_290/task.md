# Task: Supervisor: Drop File-Based Fallback Paths, DB-Only Mode


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
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

Update Supervisor SKILL.md and auto-pilot references to remove all file-based fallback paths. The allowFileFallback config option is removed — DB is the only path. Remove: sync_tasks_from_files() call at startup (no files to sync), reconcile_status_files() call (no status files exist), all Read registry.md references, all file-based task state checks. The Supervisor startup sequence becomes: create_session → get_tasks(compact: true) → build dependency graph → spawn workers. If cortex DB is unavailable, FATAL and exit (no degraded mode). Update references/parallel-mode.md, references/session-lifecycle.md, and references/cortex-integration.md to reflect DB-only architecture.

## Dependencies

- TASK_2026_289
- TASK_2026_290

## Acceptance Criteria

- [ ] Supervisor SKILL.md has zero file-based fallback paths
- [ ] allowFileFallback config option removed
- [ ] Startup sequence: create_session → get_tasks → dependency graph → spawn
- [ ] Cortex unavailable = FATAL exit (no degraded mode)

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/parallel-mode.md
- .claude/skills/auto-pilot/references/session-lifecycle.md
- .claude/skills/auto-pilot/references/cortex-integration.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_289 — depends on worker prompts being MCP-only first.
