# Task: AI-Generated Project Artifacts from Init Analysis — Single-Pass Generation


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
| Worker Mode           | [single | split]                                                              |







## Description

Use the ProjectProfile from the new smart sampling to generate all project-specific artifacts in one AI pass. Currently CLAUDE.md is a mechanical template, anti-patterns.md is a tag filter from a master file, and agents are generated one-by-one via separate Claude CLI calls. New approach: feed the ProjectProfile into a single AI call that generates (1) CLAUDE.nitro.md under 200 lines with real project conventions (research confirms 150-200 instruction budget before compliance drops), (2) anti-patterns.md with project-specific patterns (not just generic framework patterns), (3) developer agent definitions written with knowledge of the actual codebase architecture and conventions. Update claude-md.ts to generate CLAUDE.nitro.md from profile, update anti-patterns.ts to use AI instead of tag filtering, update init.ts to orchestrate the single-pass generation.

## Dependencies

- TASK_2026_281

## Acceptance Criteria

- [ ] CLAUDE.nitro.md generated from ProjectProfile, under 200 lines, with real conventions
- [ ] anti-patterns.md generated with project-specific patterns from AI analysis
- [ ] Developer agents generated from profile in batch (not one-by-one Claude CLI calls)
- [ ] All artifacts generated in one or two AI calls total (not N calls for N agents)

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/utils/claude-md.ts
- apps/cli/src/utils/anti-patterns.ts
- apps/cli/src/commands/init.ts


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_281 — depends on ProjectProfile interface from it.
