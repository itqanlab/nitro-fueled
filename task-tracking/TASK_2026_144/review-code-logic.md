# Code Logic Review — TASK_2026_144

## Score: 7/10

## Review Summary

| Metric              | Value          |
| ------------------- | -------------- |
| Overall Score       | 7/10           |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 0              |
| Serious Issues      | 1              |
| Moderate Issues     | 2              |
| Failure Modes Found | 3              |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`package-lock.json` still contains entries for both `apps/dashboard-service` and `apps/dashboard-web` as workspace members (lines 109–169) and as virtual symlinks under `node_modules/@nitro-fueled/dashboard-service` and `node_modules/@nitro-fueled/dashboard-web` (lines 10356–10361). Until a developer runs `npm install`, the lock file describes a workspace that references directories that no longer exist. On a fresh `npm ci` this resolves to an error — npm will fail to find the workspace members it expects. This is acknowledged in the handoff but left unresolved in the commit, creating a silent trap for CI pipelines that run `npm ci` rather than `npm install`.

### 2. What user action causes unexpected behavior?

A user running `nitro-fueled dashboard` immediately after this task lands will receive:

```
Error: Dashboard service not found. Install @nitro-fueled/dashboard-service or build the dashboard-api.
```

The first instruction (`Install @nitro-fueled/dashboard-service`) points to the npm package that wraps the now-deleted legacy app. That package does not exist on npm yet (the npm packages are the future published form, not current). The second instruction (`build the dashboard-api`) is vague — there is no documented runnable command for this step.

Similarly, the web UI missing-path warning says:

```
Install @nitro-fueled/dashboard-web or run the Angular dashboard build to embed web assets.
```

"Run the Angular dashboard build" is not a copy-pasteable command. The actual command is `npx nx build dashboard` followed by `npm run copy-web-assets --workspace=apps/cli`. A user in a terminal receiving this warning has no actionable information.

The review-lessons file at `.claude/review-lessons/review-general.md` (line 509, TASK_2026_144 tag) already documents this exact failure pattern, meaning it was identified during the task but the implementation was not corrected before the commit.

### 3. What data makes this produce wrong results?

The `findEntryScript()` function now has exactly one candidate path:
```
resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-service/dist/cli-entry.js')
```

This path resolves correctly when the CLI is installed as an npm package into a target project (where `node_modules/@nitro-fueled/dashboard-service` can exist). It does not resolve during local monorepo development because the removed local dev path (`../../../dashboard-service/dist/cli-entry.js`) was the only path that worked when developing inside the monorepo itself.

This means anyone developing the CLI locally and testing `nitro-fueled dashboard` will always get "Dashboard service not found" — a dev-time regression. The handoff notes this is expected until TASK_2026_145, but no guard or dev-mode note is surfaced to developers.

### 4. What happens when dependencies fail?

Both `findEntryScript()` and `findWebDistPath()` use `existsSync` checks in loops over candidates, returning `null`/`undefined` on no match. The callers in both `dashboard.ts` and `run.ts` handle these `null`/`undefined` returns correctly — the dashboard command errors out, the run command logs a skip message and continues. No silent failures here; both paths are graceful.

The lock file staleness is the main dependency failure risk: `npm ci` on a CI machine that checks out this commit will fail because workspace member paths no longer exist. `npm install` will self-heal, but `npm ci` strictly refuses to modify the lock file.

### 5. What's missing that the requirements didn't mention?

The task requirements listed "No broken references in workspace config (nx.json, tsconfig paths)" as a criterion. The implementation correctly cleared nx.json and there is no tsconfig.base.json. However:

- `package-lock.json` is also workspace config and still references the deleted apps. This is a functional breakage for `npm ci`.
- The `.nx/workspace-data/project-graph.json` and `.nx/workspace-data/source-maps.json` caches still contain references to `copy-web-assets` targets from the old `packages/` layout (a different era of the repo). These are cache files that regenerate but could confuse nx graph output transiently.
- The stale worktree at `.claude/worktrees/agent-a2846407/` contains the old `package.json` with `build:dashboard` and both legacy app package.jsons. This worktree is at commit `ecbfbf1` on branch `worktree-agent-a2846407` — it is not on the `dev` branch and does not affect normal operation, but it should be cleaned up.

---

## Failure Mode Analysis

### Failure Mode 1: `npm ci` breaks on any CI machine after this commit

- **Trigger**: Running `npm ci` (strict lock file mode) after checking out this branch. CI systems commonly use `npm ci` rather than `npm install`.
- **Symptoms**: `npm ci` exits with an error because `apps/dashboard-service` and `apps/dashboard-web` are listed as workspace members in `package-lock.json` but their directories no longer exist on disk.
- **Impact**: CI pipeline fails completely; any automated publish or test run after this task is broken until someone manually runs `npm install` and commits the updated lock file.
- **Current Handling**: The handoff acknowledges this will "auto-resolve on next `npm install`" but does not include `npm install` in the commit or provide a follow-up task.
- **Recommendation**: Run `npm install` from the workspace root and include the regenerated `package-lock.json` in the implementation commit. This is a 30-second fix.

### Failure Mode 2: Vague error messages leave users with no actionable recovery path

- **Trigger**: Any user running `nitro-fueled dashboard` in a project that does not yet have the new NestJS dashboard-api wired to the CLI.
- **Symptoms**: Terminal output instructs the user to "build the dashboard-api" or "run the Angular dashboard build" — neither of which is a runnable command. The user must read source code or documentation to determine the actual steps.
- **Impact**: Developer experience regression; users who previously saw "run `npm run build:dashboard`" (a concrete command) now see vague instructions that require external research.
- **Current Handling**: The review-lessons file (line 509) already flagged this pattern as a lesson from this task, confirming awareness — but the implementation was committed without addressing it.
- **Recommendation**: Replace the vague prose with exact commands: `npx nx build dashboard && npm run copy-web-assets --workspace=apps/cli` for the web UI path, and `npx nx build dashboard-api` for the service path. If the commands are not yet stable, say "see docs/dashboard-setup.md" or leave a TODO comment with a GitHub issue reference rather than vague prose.

### Failure Mode 3: Local monorepo development of the CLI dashboard command is broken

- **Trigger**: A developer inside the nitro-fueled monorepo runs `nitro-fueled dashboard` or `nitro-fueled run` and the dashboard tries to start.
- **Symptoms**: "Dashboard service not found (skipping)" in `run.ts`, or "Dashboard service not found" error in `dashboard.ts`. The local development path (`../../../dashboard-service/dist/cli-entry.js`) was the only candidate that worked when developing the CLI locally, and it has been removed. The replacement path (the npm package path) will never resolve inside a monorepo checkout.
- **Impact**: Dashboard feature is entirely non-functional for local development until TASK_2026_145 wires the CLI to `dashboard-api`. This is a known and accepted consequence per the handoff, but it represents a permanent dev-loop gap with no ETA communicated in this task's artifacts.
- **Current Handling**: Acknowledged in handoff as "Known Risk." Not surfaced in any dev documentation or README.
- **Recommendation**: Add a note to `apps/cli/README.md` or the workspace root CLAUDE.md noting that `nitro-fueled dashboard` is non-functional until TASK_2026_145 completes, so future agents do not waste time debugging the startup path.

---

## Critical Issues

None.

---

## Serious Issues

### Issue 1: Stale `package-lock.json` breaks `npm ci`

- **File**: `package-lock.json` (workspace root)
- **Scenario**: Any CI run, `npm ci` invocation, or fresh checkout after this commit
- **Impact**: Full CI failure on package install step; blocks automated publish pipeline
- **Evidence**: `package-lock.json` lines 109–169 list `apps/dashboard-service` and `apps/dashboard-web` as workspace packages; lines 10356–10361 list them as virtual symlinks. Both directories were deleted in commit 5e723f3.
- **Fix**: Run `npm install` at workspace root and include updated `package-lock.json` in a follow-up commit.

---

## Moderate Issues

### Issue 2: Vague warning message for missing web UI dist (no runnable command)

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/dashboard.ts` line 121
- **Scenario**: User runs `nitro-fueled dashboard` and `findWebDistPath()` returns undefined
- **Impact**: User sees instruction to "run the Angular dashboard build" — no exact command provided; cannot self-serve
- **Evidence**: `console.warn('Install @nitro-fueled/dashboard-web or run the Angular dashboard build to embed web assets.');` — the Angular dashboard build command is `npx nx build dashboard && npm run copy-web-assets --workspace=apps/cli`
- **Fix**: Replace with: `Install @nitro-fueled/dashboard-web or build web assets: npx nx build dashboard && npm run copy-web-assets --workspace=apps/cli`

### Issue 3: Error message for missing service conflates two unrelated install paths

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/dashboard.ts` line 93
- **Scenario**: User runs `nitro-fueled dashboard`, no entry script found
- **Impact**: "Install @nitro-fueled/dashboard-service or build the dashboard-api" — the first option is the legacy npm package (does not exist yet), the second is the new NestJS path (not yet wired). Both options are currently non-functional, but the message implies at least one works.
- **Evidence**: Line 93 of `dashboard.ts`; `findEntryScript()` has one candidate (`@nitro-fueled/dashboard-service` npm path) that won't resolve until that package is published.
- **Fix**: During TASK_2026_145, replace this message with the actual wiring. Until then, the message should be honest: "Dashboard service not available. The NestJS dashboard-api integration is pending (TASK_2026_145)."

---

## Data Flow Analysis

```
nitro-fueled dashboard
  -> Dashboard.run()
  -> checkExistingService(portFilePath)            [existsSync + fetch health]
  -> tryAcquireLock(lockPath)                      [atomic file create]
  -> findEntryScript()
       candidates[0]: ../../node_modules/@nitro-fueled/dashboard-service/dist/cli-entry.js
                      NEVER resolves in monorepo dev; may resolve in published consumers
       returns: null  (in current state — no npm package exists yet)
  -> console.error(vague message)
  -> process.exitCode = 1
  -> MISSING: lock not released on this early exit path
```

Wait — checking the early exit on `entryScript === null`: the `try` block catches the error-free return path. The `releaseLock` in the `catch` block only runs if an exception is thrown. For the normal `entryScript === null` return path, does the lock get released?

Looking at `dashboard.ts` lines 90-96:
```typescript
try {
  const entryScript = findEntryScript();
  if (entryScript === null) {
    console.error('...');
    process.exitCode = 1;
    return;   // <-- returns inside try block, bypasses catch
  }
```

And lines 133-138 show the lock is released via:
- `process.once('SIGINT', ...)` — signal-based
- `process.once('SIGTERM', ...)` — signal-based
- `process.once('exit', releaseStartupLock)` — process exit

The `return` inside the `try` block does NOT release the lock explicitly, but `process.once('exit', releaseStartupLock)` is registered only AFTER the child is spawned (line 149). For the early return at line 95, neither the signal handlers nor the exit handler have been registered yet.

However: `process.exitCode = 1; return;` — this returns out of `run()`, then the process exits normally, triggering the `process.once('exit', ...)` registered earlier? No — the `process.once('exit', releaseStartupLock)` is at line 149 and is never reached in the early return path.

The lock is acquired at line 74 (`tryAcquireLock`) and the early return at line 95 exits without releasing it. The `LOCK_FILE_NAME` (`.dashboard-start.lock`) file will remain on disk until the next invocation times out and calls `releaseLock(lockPath)` on line 83 (the stale lock recovery path).

This is a **lock leak on the early exit path**.

### Gap Points Identified:

1. Lock file leak: `tryAcquireLock` succeeds at line 74 but `releaseLock` is never called in the `entryScript === null` early return path (lines 91-96).
2. `package-lock.json` out of sync with filesystem — breaks `npm ci`.
3. Warning messages provide no actionable commands for recovery.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| `apps/dashboard-service/` deleted | COMPLETE | Confirmed: directory absent from filesystem |
| `apps/dashboard-web/` deleted | COMPLETE | Confirmed: directory absent from filesystem |
| No broken references in workspace config (nx.json, tsconfig paths) | PARTIAL | nx.json: clean. tsconfig.base.json: does not exist. `package-lock.json`: still references deleted apps — breaks `npm ci`. |
| `npx nx graph` runs without errors | COMPLETE | `npx nx show projects` confirms neither deleted app appears in project list |
| No imports referencing deleted apps in remaining codebase | COMPLETE | All remaining references in `dashboard-api/src/` are migration-history comments, not functional imports |

### Implicit Requirements NOT Addressed:

1. **`package-lock.json` is workspace config.** The task said "no broken references in workspace config" but scoped its checklist to `nx.json` and `tsconfig paths`. The lock file is also workspace config and is now broken.
2. **Dev-time CLI workflow documentation.** Removing the local monorepo dev path from `findEntryScript()` breaks the CLI dashboard command for all developers in this repo until TASK_2026_145. No dev documentation update was made.
3. **Lock file cleanup on early CLI exit.** Pre-existing issue surfaced by this analysis: the `tryAcquireLock` / early-return path does not call `releaseLock`. This was not introduced by this task but is exposed because the early return path (no entry script found) is now the permanent state until TASK_2026_145.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| `findEntryScript()` returns null | YES | Error message + exitCode=1 | Lock leak — lock not released before return |
| `findWebDistPath()` returns undefined | YES | Warning message + continues headless | Warning text is vague, no runnable command |
| Concurrent `nitro-fueled dashboard` invocations | YES | Startup lock with TOCTOU guard (O_EXCL) | OK |
| `npm ci` after this commit | NO | Not handled | `package-lock.json` still lists deleted workspace members — breaks npm ci |
| Local monorepo dev | NO | Path removed | No error surfaced; just "not found" which obscures the root cause for contributors |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| `npm ci` in CI | HIGH (until lock file fixed) | Blocks all automated pipelines | Run `npm install` and commit updated lock file |
| `nitro-fueled dashboard` in local dev | HIGH (until TASK_2026_145) | Non-functional feature | Document in CLAUDE.md |
| `npx nx show projects` / `nx graph` | LOW | None — verified clean | None needed |
| CLI consumers (published npm) | LOW | npm package paths used are future-forward | Acceptable — `findEntryScript` returns null gracefully |

---

## Acceptance Criteria

- [x] `apps/dashboard-service/` deleted
- [x] `apps/dashboard-web/` deleted
- [ ] No broken references in workspace config — `package-lock.json` still references deleted apps; breaks `npm ci`
- [x] `npx nx show projects` works without the deleted apps (dashboard-service and dashboard-web absent from output)
- [x] No functional imports referencing deleted apps in remaining codebase (dashboard-api references are migration-history comments only)

---

## Summary

The core deletions are correct and complete. Both legacy app directories are gone, nx.json is clean, and no functional imports remain. The `findEntryScript()` and `findWebDistPath()` candidate lists are correctly trimmed to remove the now-invalid local monorepo paths, and callers handle `null`/`undefined` returns gracefully.

Three issues prevent a clean APPROVE:

1. **Serious — stale `package-lock.json`**: The lock file still lists the deleted workspace members. `npm ci` will fail. Fix: run `npm install` and commit the updated lock file.

2. **Moderate — vague error messages**: The replacement warning text in `dashboard.ts` line 121 tells users to "run the Angular dashboard build" without specifying the actual command (`npx nx build dashboard && npm run copy-web-assets --workspace=apps/cli`). This was already noted in the review-lessons file as a lesson from this task, but the implementation was not corrected before commit.

3. **Moderate — lock leak on early CLI exit (pre-existing, now chronic)**: When `findEntryScript()` returns null, the startup lock acquired at line 74 of `dashboard.ts` is not released before `return` at line 95. This was a latent bug but is now the permanent runtime path until TASK_2026_145 wires the new API. Each failed `nitro-fueled dashboard` invocation will leave a stale lock file requiring the next invocation's timeout recovery.

The `package-lock.json` issue should be fixed before merging.

**Recommendation**: REVISE — fix `package-lock.json` via `npm install` at workspace root, and improve the vague warning message on line 121 of `dashboard.ts`.
