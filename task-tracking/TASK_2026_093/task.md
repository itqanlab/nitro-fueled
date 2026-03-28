# Task: Deprecate old packages — remove packages/ after cutover

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P2-Medium    |
| Complexity | Simple       |
| Model      | default      |
| Testing    | skip         |

## Description

After TASK_2026_092 confirms the full pipeline works end-to-end, remove the legacy package directories that have been superseded by their apps/ counterparts. Delete `packages/dashboard-service` (superseded by `apps/dashboard-api`), `packages/dashboard-web` (superseded by `apps/dashboard`), and `packages/cli` (superseded by new `apps/cli`). The `packages/docs` and `packages/session-orchestrator` directories were already moved to apps/ in TASK_2026_073 — verify they are not still present. If `packages/` is now empty, remove it. Update root `package.json` to remove any remaining `packages/` references. Update CLAUDE.md project structure section and README.md to reflect the final `apps/` + `libs/` layout.

## Dependencies

- TASK_2026_092 — confirms full pipeline is operational before any deletion

## Acceptance Criteria

- [ ] `packages/dashboard-service`, `packages/dashboard-web`, `packages/cli` directories deleted
- [ ] `packages/` directory removed if empty after deletions
- [ ] Root `package.json` contains no references to `packages/`
- [ ] `npm install` from root succeeds with clean workspace after removal
- [ ] CLAUDE.md project structure section updated to reflect `apps/` + `libs/` layout
- [ ] `nx build --all` succeeds after removal with no broken references

## References

- package.json
- CLAUDE.md
- README.md

## File Scope

- package.json
- CLAUDE.md
- README.md
