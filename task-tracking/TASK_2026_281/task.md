# Task: Smart Codebase Sampling for Init — Hybrid Signal Collection


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

Replace shallow stack detection with hybrid codebase sampling for init. Current approach reads only config files (package.json, tsconfig.json etc.) and proposes agents from a static map. New approach: (1) Read README.md + existing config files. (2) Run git log --name-only to find top 10 most-changed files (activity signal). (3) Detect entry points (main.ts, app.ts, index.ts or framework equivalents). (4) Read 2-3 sample source files from the most-changed list. (5) Send all collected signals to one AI call that returns a structured project profile: stack, architecture patterns, naming conventions, folder organization, anti-patterns to avoid, test patterns, and agent proposals. Update collectWorkspaceSignals() in workspace-signals.ts and runAIAnalysis() in stack-detect.ts. The AI prompt must be structured to return JSON matching a ProjectProfile interface. Based on research: aider uses PageRank on symbols, Cline follows imports like a developer, Claude Code's /init reads configs. Our hybrid approach combines the best of all three without the complexity of embedding or indexing.

## Dependencies

- None

## Acceptance Criteria

- [ ] collectWorkspaceSignals reads README.md, git log top 10 files, and entry point source files
- [ ] runAIAnalysis sends enriched signals and returns a full ProjectProfile (not just agent proposals)
- [ ] ProjectProfile interface defined with stack, conventions, architecture, anti-patterns, agents fields
- [ ] Sampling stays under 20KB total to fit AI context budget

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/utils/workspace-signals.ts
- apps/cli/src/utils/stack-detect.ts


## Parallelism

✅ Can run in parallel — unique file scope, no overlap with active tasks
