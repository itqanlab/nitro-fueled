# Code Style Review — TASK_2026_073

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit:** `25fa0d4` — `refactor(workspace): move packages/ to apps/, add libs/`

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Minor    | 1 |
| Info     | 0 |

No blocking style violations. One minor semantic inconsistency in project.json files.

---

## Findings

### MINOR — `projectType: "library"` on runnable applications

**Files:**
- `apps/cli/project.json` (line 5)
- `apps/dashboard-service/project.json` (line 5)
- `apps/session-orchestrator/project.json` (line 5)

**Observation:**
Three of the five apps have `"projectType": "library"`. The project convention (CLAUDE.md) explicitly states that `apps/` is for **runnable applications**, not libraries. The other two apps in the same directory (`dashboard-web`, `docs`) correctly use `"projectType": "application"`.

This inconsistency was carried over from the `packages/` move — it is a pre-existing issue, not introduced by this task. The move is a structural change and did not modify this field.

**Expected:**
```json
"projectType": "application"
```

**Affected apps and their runtimes:**
- `apps/cli` — runnable Node CLI
- `apps/dashboard-service` — runnable Node server
- `apps/session-orchestrator` — runnable MCP server

**Recommendation:** Update all three to `"application"` in a follow-up task.

---

## File-by-File Verdict

### `package.json` — PASS

- Workspace glob updated correctly to `["apps/*", "libs/*"]` (array form, both entries).
- `build:dashboard` script paths updated to `apps/dashboard-web`, `apps/dashboard-service`, `apps/cli`.
- `dashboard` script path updated to `apps/cli/dist/index.js`.
- Consistent formatting, no trailing commas, clean JSON.

### `nx.json` — PASS

No path references to `packages/`; no changes were needed and none were made. File is clean.

### `apps/cli/project.json` — PASS (with minor note above)

- `$schema` path `../../node_modules/nx/schemas/project-schema.json` resolves correctly from `apps/cli/` depth.
- `sourceRoot` correctly points to `apps/cli/src`.
- Target names follow camelCase (`build`, `serve`, `start`, `test`).

### `apps/dashboard-service/project.json` — PASS (with minor note above)

- `$schema` path correct.
- `sourceRoot` correct.
- Targets consistent with peer project.json files.

### `apps/dashboard-web/project.json` — PASS

- `projectType: "application"` — correct.
- All paths and targets consistent.

### `apps/docs/project.json` — PASS

- `projectType: "application"` — correct.
- All paths and targets consistent.

### `apps/session-orchestrator/project.json` — PASS (with minor note above)

- `$schema` path correct.
- `sourceRoot` correct.

### `apps/cli/src/utils/scaffold.ts` — PASS

- **File size:** 142 lines — within 200-line limit.
- **Naming:** All exported functions are camelCase (`resolveScaffoldRoot`, `copyDirRecursive`, `listFiles`, `walkScaffoldFiles`, `scaffoldSubdir`). Interface `CopyResult` is PascalCase. File name is kebab-case.
- **Types:** No `any` usage. No `as` type assertions. All types explicit.
- **Imports:** All six imports (`existsSync`, `mkdirSync`, `readdirSync`, `copyFileSync`, `resolve`, `join`, `relative`, `fileURLToPath`) are used.
- **Error handling:** `resolveScaffoldRoot` throws a descriptive `Error` when neither scaffold location is found — not swallowed.
- **Path logic:** Dev fallback traversal (`..`, `..`, `..`, `..`, `..` from `apps/cli/src/utils/scaffold.ts`) correctly resolves to repo root, then descends into `apps/cli/scaffold`. Consistent with new directory layout.

### `libs/.gitkeep` — PASS

Empty placeholder file. No content to review.

---

## Conclusion

The refactor is clean. All path references updated consistently. No TypeScript style violations, no naming violations, no unused imports, no swallowed errors. The single minor finding (`projectType` mismatch) is a pre-existing issue carried over from before the move and should be tracked as a follow-up.
