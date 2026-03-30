# Task: Update Supervisor spawn logic for split worker mode routing


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






## Description

Update the auto-pilot Supervisor to route tasks through Prep → Implement → Review when Worker Mode is 'split', preserving existing Build → Review for 'single' mode.

1. **State classification**: Add READY_FOR_PREP, PREPPING, READY_FOR_IMPLEMENT, IMPLEMENTING to Step 3 dependency graph.
2. **Spawn routing**: split mode: CREATED→Prep Worker, PREPPED→Implement Worker, IMPLEMENTED→Review Worker. single mode: unchanged.
3. **Auto-selection**: When Worker Mode absent, Simple→single, Medium/Complex→split.
4. **Model routing**: Prep Workers default to sonnet; Implement Workers use task's Model field.
5. **Worker prompt injection**: Spawn correct prompt template per worker type.

## Dependencies

- TASK_2026_204 — needs new statuses in cortex
- TASK_2026_205 — needs Prep Worker prompt
- TASK_2026_206 — needs Implement Worker prompt

## Acceptance Criteria

- [ ] Supervisor routes split-mode tasks through Prep → Implement → Review
- [ ] Supervisor routes single-mode tasks through Build → Review (unchanged)
- [ ] Auto-selection defaults Simple→single, Medium/Complex→split
- [ ] Prep Workers spawn with sonnet model by default
- [ ] Dry-run output shows correct worker pipeline per task

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/auto-pilot/references/worker-prompts.md
- .claude/skills/auto-pilot/references/parallel-mode.md
- .claude/skills/auto-pilot/references/cortex-integration.md


## Parallelism

✅ Can run in parallel with other tasks once dependencies are met (Wave 2)
