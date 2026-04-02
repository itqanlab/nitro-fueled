# Task: Dependency Resolver Module — Task Graph & Priority Sorting


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P0-Critical |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Build a pure TypeScript module at `packages/mcp-cortex/src/supervisor/resolver.ts` that constructs a dependency graph from task arrays and returns unblocked tasks sorted by priority.

The module provides pure functions (no DB calls): build adjacency list from task.dependencies JSON, detect cycles via DFS, filter tasks to only those whose dependencies are all COMPLETE/CANCELLED, and sort by priority (P0 > P1 > P2 > P3). Also includes a helper to re-evaluate which tasks became unblocked after a specific task completed.

References: Current AI logic in `.claude/skills/nitro-auto-pilot/references/parallel-mode.md` Step 3. Task schema in `packages/mcp-cortex/src/db/schema.ts`.

## Dependencies

- None

## Acceptance Criteria

- [ ] resolveUnblockedTasks returns only tasks with all deps COMPLETE/CANCELLED, sorted by priority
- [ ] detectCycles correctly identifies circular dependencies
- [ ] markNewlyUnblocked returns task IDs unblocked after a task completed
- [ ] Unit tests cover: no deps, linear chain, diamond deps, cycle, mixed statuses

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/resolver.ts (new)
- packages/mcp-cortex/src/supervisor/resolver.spec.ts (new)


## Parallelism

Wave 1 — parallel with 330, 331, 332. No shared files.
