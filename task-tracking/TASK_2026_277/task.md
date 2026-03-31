# Task: CLAUDE.md Split — Introduce .nitro/CLAUDE.nitro.md as Nitro's System Prompt


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

Split CLAUDE.md into user-owned and nitro-owned files. Introduce .nitro/CLAUDE.nitro.md as nitro-fueled's managed system prompt. Change init behavior: when CLAUDE.md already exists, append a single import line (@./.nitro/CLAUDE.nitro.md) instead of overwriting. When CLAUDE.md does not exist, create it with only the import line. Write nitro's conventions to .nitro/CLAUDE.nitro.md. Change update behavior: only update .nitro/CLAUDE.nitro.md, never touch CLAUDE.md. Update manifest to track CLAUDE.nitro.md as a coreFile and remove CLAUDE.md from generatedFiles.

## Dependencies

- None

## Acceptance Criteria

- [ ] init appends @./.nitro/CLAUDE.nitro.md to existing CLAUDE.md without overwriting
- [ ] init creates .nitro/CLAUDE.nitro.md with nitro conventions
- [ ] update only touches .nitro/CLAUDE.nitro.md, never CLAUDE.md
- [ ] manifest tracks CLAUDE.nitro.md as coreFile, CLAUDE.md removed from generatedFiles
- [ ] Existing projects upgrading get the import line added non-destructively

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/init.ts
- apps/cli/src/commands/update.ts
- apps/cli/src/utils/claude-md.ts
- apps/cli/src/utils/manifest.ts
- apps/cli/scaffold/nitro-root/CLAUDE.nitro.md


## Parallelism

✅ Can run in parallel — unique file scope, no overlap with active tasks
