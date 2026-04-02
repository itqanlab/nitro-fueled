# Task: Update All Internal References After nitro-* Rename


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
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

Part 2 of 2 — Update all internal references across .claude/ after the nitro-* rename (TASK_2026_279). Depends on Part 1 being complete. Changes: update all Skill tool invocations from skill: 'orchestration' to skill: 'nitro-orchestration', skill: 'auto-pilot' to skill: 'nitro-auto-pilot', and equivalent for all renamed skills. Update all file path references to anti-patterns.md → nitro-anti-patterns.md and review-lessons/ → nitro-review-lessons/ across agents, commands, and skill files. Verify zero broken references by running a grep audit after all changes. The full pipeline must run cleanly after this task completes.

## Dependencies

- TASK_2026_279

## Acceptance Criteria

- [ ] All skill invocations updated to nitro-* names across agents and commands
- [ ] All file path references to anti-patterns and review-lessons updated
- [ ] Grep audit confirms zero references to old unprefixed paths
- [ ] Full pipeline runs without broken skill or file references

## References

- task-tracking/task-template.md

## File Scope

- all .claude/agents/*.md
- all .claude/commands/*.md
- all .claude/skills/nitro-*/SKILL.md and references/


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_279 — depends on it. Wave 2, after TASK_2026_279 completes.
