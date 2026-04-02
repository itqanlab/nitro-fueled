# Task: Scaffold Source Restructure — Replace scaffold/.claude/ with scaffold/nitro/ and scaffold/nitro-root/


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

Restructure the scaffold source directory. Currently apps/cli/scaffold/.claude/ is a confusing clone of the repo's .claude/ directory. Replace it with two clearly named source dirs: scaffold/nitro/ for files that land in .claude/ in the target project, and scaffold/nitro-root/ for files that land in .nitro/ in the target project. Update init.ts to map scaffold/nitro/ → .claude/ and scaffold/nitro-root/ → .nitro/. Update update.ts and scaffold.ts path resolution to use the new layout. Update resolveScaffoldRoot() to find the new directories.

## Dependencies

- None

## Acceptance Criteria

- [ ] apps/cli/scaffold/.claude/ removed, replaced by scaffold/nitro/ and scaffold/nitro-root/
- [ ] init.ts maps scaffold/nitro/ → .claude/ and scaffold/nitro-root/ → .nitro/
- [ ] update.ts and scaffold.ts resolve paths correctly from new layout
- [ ] resolveScaffoldRoot() updated for new directory structure
- [ ] npx nitro-fueled init on a fresh project produces identical result to before restructure

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/scaffold/ (restructured)
- apps/cli/src/utils/scaffold.ts
- apps/cli/src/commands/init.ts
- apps/cli/src/commands/update.ts


## Parallelism

✅ Can run in parallel — unique file scope, no overlap with active tasks
