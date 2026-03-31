# Task: Update Change Summary — AI-Powered Diff Explanation


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
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

When update runs, generate an AI-powered change summary explaining what changed between the installed scaffold version and the new version and why it matters. Read the diff between old and new scaffold files, send to AI with context about what each file does, and produce a human-readable summary displayed in terminal output. Shows which files were updated, what changed semantically (not just line counts), and whether any user action is recommended for skipped files. This helps users understand updates rather than blindly accepting them.

## Dependencies

- TASK_2026_284

## Acceptance Criteria

- [ ] Update command displays AI-generated change summary after file processing
- [ ] Summary explains semantic changes (not just file counts)
- [ ] Skipped files get a note explaining what changed in the new version
- [ ] Summary skipped when no files were updated or when --quiet flag is set

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/update.ts


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_284 — depends on manifest merge base from it.
