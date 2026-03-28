# Code Style Review — TASK_2026_072

**Reviewer:** nitro-code-style-reviewer
**Commit:** 23bc0d4 — feat(devops): add Nx workspace initialization
**Files reviewed:** nx.json, package.json, packages/*/project.json (5 files)
**Date:** 2026-03-28

---

## Summary

Overall style quality is **good**. All JSON files are consistently formatted with 2-space indentation, valid JSON syntax, and follow Nx schema conventions. Two issues are flagged below — one naming inconsistency and one field ordering deviation.

---

## Issues Found

### STYLE-1 — Inconsistent project name scoping in `packages/session-orchestrator/project.json`

**Severity:** Minor
**File:** `packages/session-orchestrator/project.json:4`

All other project.json files use scoped package names:
- `@itqanlab/nitro-fueled` (cli)
- `@nitro-fueled/dashboard-service`
- `@nitro-fueled/dashboard-web`
- `@nitro-fueled/docs`

`session-orchestrator` uses a bare, unscoped name:
```json
"name": "session-orchestrator"
```

This breaks the naming convention pattern established by all other packages. Nx uses the project `name` field for `nx build <name>`, `nx run <name>:target`, and affected computation — an unscoped name is harder to discover and does not match the `@nitro-fueled/*` namespace.

**Expected:** `"name": "@nitro-fueled/session-orchestrator"` (or `"name": "session-orchestrator"` if this project intentionally lives outside the `@nitro-fueled` scope — but that intent should be documented).

---

### STYLE-2 — Non-standard field ordering in `package.json`

**Severity:** Low
**File:** `package.json:15-17`

The `devDependencies` field appears **after** `engines`:

```json
"engines": {
  "node": ">=18.0.0"
},
"devDependencies": {
  "nx": "^20.0.0"
}
```

The conventional npm field ordering places dependency fields (`dependencies`, `devDependencies`, `peerDependencies`) before metadata fields like `engines`. The addition of `devDependencies` at the end of the file instead of before `engines` deviates from this convention and from typical `npm init` output order.

**Expected order:** `...scripts → workspaces → devDependencies → engines`

---

## No Issues Found

The following were checked and are clean:

| Check | Result |
|-------|--------|
| JSON formatting (2-space indent) | Pass — all files |
| Trailing commas | Pass — none present |
| `$schema` field placement (first) | Pass — all project.json files |
| Field ordering within project.json | Pass — consistent: `$schema → name → sourceRoot → projectType → targets` |
| Target ordering within each project | Pass — libraries: `build → serve → start → test`; apps: `build → serve → preview → test` |
| Consistent executor names (`nx:run-script`, `nx:run-commands`) | Pass — consistent pattern: script-backed targets use `nx:run-script`, placeholder test uses `nx:run-commands` |
| `nx.json` structure and field names | Pass — follows Nx schema conventions |
| `neverRequest` placement and value | Pass — correctly disables Nx Cloud prompts |
| `cacheDirectory` and `defaultBase` | Pass — valid values |
| `targetDefaults` cache flags | Pass — `serve` and `preview` correctly set `cache: false` |

---

## Verdict

**Approve with minor notes.** STYLE-1 (unscoped name) is the more meaningful issue — it creates a naming inconsistency that affects `nx run` discoverability. STYLE-2 is cosmetic. Neither blocks merge.
