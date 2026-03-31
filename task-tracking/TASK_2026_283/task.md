# Task: Multi-Tool Context File Generation — .cursorrules, copilot-instructions, .clinerules


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

On init, generate context files for other AI coding tools alongside CLAUDE.nitro.md. Using the same ProjectProfile already computed, generate .cursorrules (for Cursor), .github/copilot-instructions.md (for GitHub Copilot), and .clinerules (for Cline). Each file gets the same project conventions adapted to the tool's expected format. Research confirms all tools use markdown for instructions. One AI pass produces all outputs (or reuse CLAUDE.nitro.md content and reformat since the convention content is the same). Track these as generatedFiles in the manifest so they are not auto-updated. On update, regenerate only if --regen is passed. This is a free win — same content, multiple files, users who switch tools still get project context.

## Dependencies

- TASK_2026_282

## Acceptance Criteria

- [ ] init generates .cursorrules, .github/copilot-instructions.md, and .clinerules
- [ ] All three files contain project conventions matching CLAUDE.nitro.md content
- [ ] Files tracked as generatedFiles in manifest (not auto-updated)
- [ ] Existing files not overwritten unless --overwrite is passed

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/init.ts
- apps/cli/src/utils/manifest.ts


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_282 — depends on CLAUDE.nitro.md generation from it.
