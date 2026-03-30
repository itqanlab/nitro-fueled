# Security Review — TASK_2026_144

## Score: 9/10

## Findings

### INFO — Path candidates are publish-time npm paths only (no traversal risk)

**File**: `apps/cli/src/utils/dashboard-helpers.ts` lines 14-16, 26-29

The three removed path candidates were hardcoded relative paths pointing into the local monorepo directories (`../../../dashboard-service/dist/...`, `../../../dashboard-web/dist`). The remaining candidates all resolve via `node_modules/@nitro-fueled/...` or `../../dashboard-assets` — both under the CLI package tree, not user-supplied. No path traversal risk was introduced or removed by this change; the deletion improves the surface by eliminating filesystem probing outside the npm package boundary.

**Severity**: INFO — no actionable issue.

---

### INFO — Updated error messages do not leak internal paths

**File**: `apps/cli/src/commands/dashboard.ts` line 93, 121
**File**: `apps/cli/src/commands/run.ts` line 150

The old messages referenced the local monorepo build pipeline (`Build dashboard-service package first`, `npm run build:dashboard`). The new messages reference only public npm package names (`@nitro-fueled/dashboard-service`, `@nitro-fueled/dashboard-web`). This is a net improvement: no internal directory structure or build toolchain layout is disclosed in error output seen by end users.

**Severity**: INFO — improvement confirmed.

---

### INFO — Deleted apps contained no credentials or secrets

The 82 deleted files (`apps/dashboard-service/`, `apps/dashboard-web/`) were scanned in the implementation commit diff for credential patterns (`token`, `secret`, `password`, `api_key`, `Bearer`, `sk-`, `AUTH`). No matches were found. The files contained only TypeScript source, Vite/TS config, and React/Node.js business logic with no hardcoded secrets.

**Severity**: INFO — clean deletion.

---

### MINOR — `openBrowser` passes URL to `execFile` — URL is fully controlled by the CLI (safe in current form, warrants a note)

**File**: `apps/cli/src/utils/dashboard-helpers.ts` lines 37-43

`openBrowser(url)` calls `execFile(cmd, args)` with `url` as one of the args. In the current call sites, `url` is always constructed as `http://localhost:<port>` where `port` is an integer validated in the range 0-65535. Because `execFile` (not `exec`) is used, arguments are passed directly to `execve` without shell interpretation — metacharacters are inert. The risk is low, but if a future caller passes an attacker-controlled URL (e.g., from a config file or environment variable), the argument could contain shell-special characters that are harmless to `execFile` but could still open a malicious URL in the user's browser. No change is introduced by this task; the function pre-existed unchanged. Documented as a defense-in-depth note.

**Severity**: MINOR — pre-existing, not introduced by this task's changes.

---

### MINOR — `package.json` `build:dashboard` script removed cleanly

**File**: `package.json` line 7 (deleted)

The removed script `build:dashboard` referenced workspace names for deleted apps. Its removal is clean. No secrets, tokens, or credentials were present in the removed line. No security regression.

**Severity**: INFO.

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | Port and task ID validation unchanged; no new unvalidated inputs introduced |
| Path Traversal           | PASS   | Hardcoded local monorepo paths removed; remaining candidates are npm package paths under the CLI package tree |
| Secret Exposure          | PASS   | Deleted apps contained no credentials; error messages updated to remove internal build paths |
| Injection (shell/prompt) | PASS   | `execFile` used (not `exec`); URL is constructed from validated integer port; no shell injection surface |
| Insecure Defaults        | PASS   | No new defaults introduced; existing defaults unchanged |

---

## Summary

This is a cleanup refactoring that deletes two legacy apps and updates three small string literals. The security posture improves marginally: internal monorepo path candidates are removed from `findEntryScript`/`findWebDistPath`, and error messages no longer disclose the local build pipeline structure to end users. No credentials, tokens, or sensitive data were present in the deleted files. No new attack surface was introduced.

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: No significant risks found.
