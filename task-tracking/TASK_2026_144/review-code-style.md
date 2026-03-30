# Code Style Review — TASK_2026_144

## Score: 8/10

## Findings

### MINOR — dashboard-helpers.ts: single-element candidates array warrants a comment

**File**: `apps/cli/src/utils/dashboard-helpers.ts:14-19`

`findEntryScript()` now has a `candidates` array with exactly one element. The array loop pattern was designed to probe multiple fallback paths. With one entry the loop still works, but it signals future readers that additional paths may be added, which is fine — however the sibling `findWebDistPath()` retains two candidates with inline comments explaining each, while `findEntryScript()` has no such comment on its remaining candidate. Consistency is broken: one function documents its candidate, the other does not.

Recommendation: Add a comment on the remaining candidate in `findEntryScript()` matching the style already used in `findWebDistPath()`:

```ts
// Installed as a peer npm package
resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-service/dist/cli-entry.js'),
```

---

### MINOR — dashboard.ts: error message inconsistency between `dashboard.ts` and `run.ts`

**File**: `apps/cli/src/commands/dashboard.ts:93` vs `apps/cli/src/commands/run.ts:150`

`dashboard.ts` uses `console.error` with a multi-option message:

> `Install @nitro-fueled/dashboard-service or build the dashboard-api.`

`run.ts` uses `console.log` (not `console.error`) with a single-option message:

> `Install @nitro-fueled/dashboard-service to enable.`

The severity level difference (`console.error` vs `console.log`) is defensible since `run.ts` treats a missing dashboard as non-fatal and skips gracefully. The message wording divergence (`or build the dashboard-api` vs nothing) is the real inconsistency. Both paths should either mention or omit the `dashboard-api` build alternative so the user gets uniform guidance regardless of which command they ran.

---

### MINOR — dashboard.ts: warning message drops backtick quoting style

**File**: `apps/cli/src/commands/dashboard.ts:121`

Old message: `'Run \`npm run build:dashboard\` first to embed web assets.'`

New message: `'Install @nitro-fueled/dashboard-web or run the Angular dashboard build to embed web assets.'`

The original used inline backtick quoting around the runnable command, which aids readability in a terminal. The replacement drops this convention and uses a vague phrase (`the Angular dashboard build`) without a concrete command to run. This is a step backward in user-facing clarity. A user encountering this warning has no actionable command to copy-paste.

---

### INFO — package.json: `workspaces` still lists `apps/*` which includes the now-deleted app directories

**File**: `package.json:8-9`

```json
"workspaces": [
  "apps/*",
```

This is a glob so it resolves dynamically — deleted directories are simply absent. No stale reference remains. Confirmed non-issue, noted for completeness.

---

### INFO — No orphaned imports introduced

All imports in the modified files were checked. No unused import was introduced or left behind by the changes. `findEntryScript`, `findWebDistPath`, and all re-exported symbols remain in active use in both `dashboard.ts` and `run.ts`.

---

## Summary

The changes are mechanically correct. Two candidate paths are removed from `dashboard-helpers.ts`, three user-facing strings are updated in `dashboard.ts` and `run.ts`, and the `build:dashboard` npm script is removed from `package.json`. The scope is narrow and well-executed with no regressions.

The main style concern is the new warning message in `dashboard.ts` (line 121) that replaces an actionable command with vague prose — a minor regression in terminal UX. The inconsistency in `findEntryScript()` missing inline candidate comments is a low-friction fix that keeps the file consistent with its sibling function. Neither finding is blocking.
