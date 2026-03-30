# Security Review — TASK_2026_073

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Task:** Workspace Folder Restructure (packages → apps + libs)
**Commit:** `25fa0d4`

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKING | 0 |
| MAJOR    | 0 |
| MINOR    | 1 |
| INFO     | 2 |

No blocking or major security issues found. The refactoring is structural — no new attack surface is introduced. One minor path traversal risk exists in a pre-existing function (`scaffoldSubdir`) that is now reachable via the updated path resolution.

---

## Findings

### MINOR-1 — Unvalidated `subdir` parameter in `scaffoldSubdir` (CWE-22 Path Traversal)

**File:** `apps/cli/src/utils/scaffold.ts:133-142`

```typescript
export function scaffoldSubdir(
  scaffoldRoot: string,
  targetRoot: string,
  subdir: string,    // ← not validated
  overwrite: boolean
): CopyResult {
  const src = resolve(scaffoldRoot, subdir);
  const dest = resolve(targetRoot, subdir);
  return copyDirRecursive(src, dest, overwrite);
}
```

`resolve()` normalizes path segments, so a `subdir` value of `../../etc/passwd` would silently escape both `scaffoldRoot` and `targetRoot`. If a caller ever sources `subdir` from user input or an external config file, this becomes a write-outside-sandbox vulnerability.

**Current risk:** Low — callers in this package appear to pass hardcoded subdir values (`.claude`, etc.). Not exploitable as written today.
**Risk vector:** Becomes exploitable if a future caller passes untrusted `subdir` input.
**Recommended fix (do not apply — report only):** Validate that the resolved `dest` path starts with `targetRoot` before invoking `copyDirRecursive`.

---

### INFO-1 — Wildcard workspace glob `libs/*` auto-discovers future directories

**File:** `package.json:10`

```json
"workspaces": ["apps/*", "libs/*"]
```

Any directory placed under `libs/` is automatically registered as an npm workspace package. If a malicious or accidental directory is created under `libs/`, npm will attempt to link it as a workspace member. This is standard npm workspace behavior, but worth noting for supply-chain hygiene when the package is consumed via `npx @itqanlab/nitro-fueled init` — the installer must not write into `libs/` of the target project.

**Severity:** INFO — standard behavior, no immediate vulnerability.

---

### INFO-2 — Symlink skipping is correctly implemented

**File:** `apps/cli/src/utils/scaffold.ts:69-70, 113-114`

Both `copyDirRecursive` and `walkScaffoldFiles` explicitly skip symbolic links:

```typescript
if (entry.isSymbolicLink()) {
  continue;
}
```

This correctly prevents symlink-following attacks (CWE-61) where a symlink in the scaffold source could cause the installer to write to or read from arbitrary locations outside the scaffold tree. Noted as a positive security control.

---

## Files Reviewed

| File | Security Status |
|------|----------------|
| `package.json` | Clean |
| `nx.json` | Clean |
| `apps/cli/project.json` | Clean |
| `apps/dashboard-web/project.json` | Clean |
| `apps/dashboard-service/project.json` | Clean |
| `apps/docs/project.json` | Clean |
| `apps/session-orchestrator/project.json` | Clean |
| `apps/cli/src/utils/scaffold.ts` | 1 minor finding (MINOR-1) |
| `libs/.gitkeep` | Clean |

---

## OWASP Coverage

| Category | Checked | Finding |
|----------|---------|---------|
| A01 Broken Access Control | Yes | None |
| A02 Cryptographic Failures | Yes | None (no crypto in scope) |
| A03 Injection | Yes | None (no shell exec, no SQL, no template rendering) |
| A05 Security Misconfiguration | Yes | None |
| A06 Vulnerable Components | Yes | Not in scope (dependency versions not changed) |
| A08 Software Integrity Failures | Yes | INFO-1 (wildcard workspace glob) |
| CWE-22 Path Traversal | Yes | MINOR-1 (scaffoldSubdir) |
| CWE-61 Symlink Following | Yes | Correctly mitigated |

---

## Verdict

**APPROVED with minor note.** The structural refactoring introduces no new security vulnerabilities. MINOR-1 is a pre-existing code pattern surfaced by the path update; it is not exploitable in the current call graph. No blocking issues.
