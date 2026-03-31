# Task: Autopilot: Prompt Adapter Layer + Supervisor Codex Launcher Routing


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

Build the prompt adapter layer and wire Codex launcher routing into the Supervisor. Depends on TASK_2026_270 (launcher-aware spawn_worker + provider entries). Two changes required: (1) Prompt adapter layer — before a worker prompt is sent to a Codex launcher, rewrite Claude-specific tool references (Agent tool, Read tool, Edit tool, Write tool, Bash tool) to their Codex-compatible equivalents. This is a translation table applied at spawn time. (2) Supervisor routing — when selecting a provider for a worker, read the launcher field from the provider entry (returned by get_available_providers). If launcher != "claude-code", apply the prompt adapter before calling spawn_worker. This is the orchestration layer; it enables the PR Review Worker (and any other worker type) to be dispatched to Codex. Document the adapter mapping in worker-prompts.md.

## Dependencies

- TASK_2026_270

## Acceptance Criteria

- [ ] Prompt adapter rewrites all Claude-specific tool names to Codex equivalents before spawn
- [ ] Supervisor reads launcher field from provider entry and applies adapter when launcher != claude-code
- [ ] Existing Claude workers receive no adapter transformation (no regression)
- [ ] Adapter mapping is documented in worker-prompts.md
- [ ] A Review+Fix Worker can be dispatched to Codex and complete a cycle end-to-end

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/worker-prompts.md
- .claude/skills/auto-pilot/references/parallel-mode.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_270 — depends on it. Wave 2, after TASK_2026_270 completes.
