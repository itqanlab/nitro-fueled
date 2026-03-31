# Task: AI-Assisted Three-Way Merge on Update (--ai-merge)


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

Add AI-assisted three-way merge to the update command for files where the user has customised a managed file and a new scaffold version ships. Currently these files are skipped entirely. New approach: (1) Store the original scaffold content hash AND full content path in the manifest at install time (merge base). (2) On update, when checksum differs (user modified), attempt standard three-way text merge first using the stored base, user version, and new version. (3) If text merge has conflicts, and --ai-merge flag is set, invoke AI with the three versions plus surrounding project context (what imports this file, what it's used for). (4) AI produces a merged result preserving user customisations while applying new scaffold changes. (5) Show merge results clearly: auto-merged, AI-merged, or conflict (manual needed). Based on merde.ai research: naive AI merge scores single digits. Providing surrounding context pushes accuracy to ~50%. When it fails, it fails obviously rather than subtly.

## Dependencies

- None

## Acceptance Criteria

- [ ] Manifest stores original scaffold content path as merge base alongside checksum
- [ ] Standard three-way text merge attempted first for modified files
- [ ] --ai-merge flag invokes AI fallback for conflict resolution with surrounding context
- [ ] Clear output: auto-merged / AI-merged / conflict per file

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/update.ts
- apps/cli/src/utils/manifest.ts


## Parallelism

✅ Can run in parallel — update.ts has no overlap with init-focused tasks
