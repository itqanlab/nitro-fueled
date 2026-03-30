# Task: Workspace Folder Restructure (packages → apps + libs)

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P0-Critical  |
| Complexity | Simple       |
| Model      | default      |
| Testing    | skip         |

## Description

Physically move the 5 package directories from `packages/` into `apps/` — all 5 are runnable applications. Create an empty `libs/` directory with a `.gitkeep` placeholder. Update the root `package.json` workspaces glob from `"packages/*"` to `["apps/*", "libs/*"]`. Update `nx.json` if it references `packages/` paths. Cross-package imports use npm package names (not relative paths), so no import statements need to change — this is a pure structural move.

## Dependencies

- TASK_2026_072 — provides the Nx configuration to update after the move

## Acceptance Criteria

- [ ] All 5 packages moved: `apps/cli`, `apps/dashboard-service`, `apps/dashboard-web`, `apps/docs`, `apps/session-orchestrator`
- [ ] Root `package.json` workspaces updated to `["apps/*", "libs/*"]`
- [ ] `libs/` directory exists with `.gitkeep`
- [ ] `npm install` runs cleanly from root after the move
- [ ] `nx build cli` and `nx build session-orchestrator` succeed from root

## References

- package.json
- nx.json

## File Scope

- package.json
- nx.json
- apps/ (directory creation, 5 package moves)
- libs/ (directory creation)
