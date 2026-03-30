# Task: Nx Workspace Initialization

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | DEVOPS       |
| Priority   | P0-Critical  |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Add Nx to the workspace without changing any existing code. Install Nx packages at the root, create `nx.json` with project detection, caching configuration, and task runner options. Create a `project.json` in each of the 5 existing packages (cli, dashboard-service, dashboard-web, docs, session-orchestrator) that exposes build, test, and serve targets delegating to the existing npm scripts. The existing `package.json` workspaces config stays as-is — Nx runs on top of npm workspaces. No TypeScript files are modified in this task.

## Dependencies

- None

## Acceptance Criteria

- [ ] `nx.json` created at root with `defaultBase`, `cacheDirectory`, and task runner options configured
- [ ] `project.json` exists for all 5 packages with build/test/serve targets matching existing npm scripts
- [ ] `nx build <project>` works for all 5 packages without errors
- [ ] `nx affected` correctly computes the project dependency graph
- [ ] Existing `npm run build` still works with no regression

## References

- packages/cli/package.json
- packages/dashboard-service/package.json
- packages/dashboard-web/package.json
- packages/docs/package.json
- packages/session-orchestrator/package.json

## File Scope

- nx.json
- packages/cli/project.json
- packages/dashboard-service/project.json
- packages/dashboard-web/project.json
- packages/docs/project.json
- packages/session-orchestrator/project.json
- package.json
