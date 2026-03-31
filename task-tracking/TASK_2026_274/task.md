# Task: Enforce preferred_tier at Task Creation and Hard-Route in Supervisor


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Enforce preferred_tier at task creation and hard-route in the Supervisor. Currently, tasks without an explicit preferred_tier silently fall back to Sonnet. Two changes: (1) Task creator auto-sets preferred_tier from complexity at creation time (Simple→light, Medium→balanced, Complex→heavy) so no task enters the pipeline without a tier. (2) Supervisor routing is made strict — if preferred_tier is set, the Supervisor must honor it and cannot fall back to the session default model. A task with preferred_tier=light must spawn a light-tier worker even if the session is running Sonnet. NOTE TO USER: Test this on a small batch of 2-3 Simple tasks first to validate that light-tier workers (glm-4.7) can complete them correctly before enabling broadly.

## Dependencies

- None

## Acceptance Criteria

- [ ] Task creator auto-sets preferred_tier from complexity when the field is absent
- [ ] Supervisor hard-routes on preferred_tier — no silent fallback to session default model
- [ ] Supervisor logs an explicit error when a valid tier cannot be satisfied (e.g., provider unavailable)
- [ ] Test validation: run 2-3 Simple tasks with preferred_tier=light and verify completion quality before broad rollout

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/parallel-mode.md
- .claude/commands/nitro-create-task.md


## Parallelism

✅ Can run in parallel — no file scope overlap with active tasks
