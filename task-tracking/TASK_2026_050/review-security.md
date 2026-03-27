# Security Review — TASK_2026_050

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 4                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `isManifest` validates top-level fields only — `coreFiles` entry shapes are not validated; a corrupt entry causes an unguarded field access at update.ts:99 |
| Path Traversal           | FAIL   | `resolve(cwd, relPath)` in update.ts:81 and update.ts:128 is never boundary-checked against `cwd`; no `startsWith(resolve(cwd) + sep)` assertion |
| Secret Exposure          | PASS   | No credentials or tokens found |
| Injection (shell/prompt) | PASS   | No shell execution, no eval; no user-controlled content reaches a dangerous API |
| Insecure Defaults        | FAIL   | `mkdirSync` (update.ts:48, manifest.ts:66) and `writeFileSync`/`copyFileSync` use default umask permissions (0o755/0o644), not explicit modes |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Missing Boundary Check on Destination Paths Built from `relPath`

- **File**: `packages/cli/src/commands/update.ts:81` and `update.ts:128`
- **Problem**: `destPath = resolve(cwd, relPath)` is called but the result is never checked to confirm it stays within `cwd`. The `relPath` values originate from `walkScaffoldFiles`, which derives them via `relative(scaffoldRoot, absPath)`. In normal operation these are safe. However, if the installed `packages/cli/scaffold/` directory is modified (e.g., a compromised npm package, a developer symlink pointing to a malicious tree, or a path-traversal entry slipping through the walk), `relPath` can contain `../` sequences that survive `resolve()` and produce an absolute path outside `cwd`. The same pattern applies in `updateManifestData` at line 128.
- **Impact**: A compromised scaffold (supply-chain attack on the npm package, or a developer who has modified the local scaffold) could overwrite files outside the project directory — up to any path the process can write.
- **Fix**: After computing `destPath`, assert `resolve(destPath).startsWith(resolve(cwd) + path.sep)`. Reject and log any `relPath` that fails this check before any `copyFileSync` or `buildCoreFileEntry` call.

### Issue 2: `isManifest` Does Not Validate `coreFiles` Entry Shapes

- **File**: `packages/cli/src/utils/manifest.ts:24–34` and `packages/cli/src/commands/update.ts:99`
- **Problem**: `isManifest` checks that `coreFiles` is an object but does not validate the shape of individual entries. When `manifest.coreFiles[relPath].checksum` is accessed in `update.ts:99`, if the entry is `null`, a non-object, or an object missing the `checksum` field (possible from schema drift, partial write, or hand-edit), the access throws an unhandled `TypeError` or silently returns `undefined`. When `checksum` is `undefined`, the comparison `currentChecksum === manifestChecksum` evaluates to `false` for every checksum, causing every file to be treated as user-modified and skipped — producing a silent no-op update with no error message.
- **Impact**: A hand-edited manifest where any `coreFiles` entry has a malformed structure causes the update command to silently skip all files without informing the user. The user believes the update ran successfully. Additionally, `update.ts:130` calls `buildCoreFileEntry(destPath, latestVersion)` for outcomes other than `skipped` — this path is safe, but the prior read at line 99 can crash with a `TypeError` before reaching it.
- **Fix**: Extend `isManifest` (or add a `isCoreFileEntry` guard called per entry) to verify that each value in `coreFiles` is an object with a `string` `checksum` field. Alternatively, access via optional chaining (`manifest.coreFiles[relPath]?.checksum ?? null`) and treat a missing or malformed entry as "not in manifest" rather than crashing.

---

## Minor Issues

### 1. Directory and File Permissions Use Umask Defaults

- **Files**: `packages/cli/src/commands/update.ts:48` (`ensureParentDir`), `packages/cli/src/utils/manifest.ts:66` (`writeManifest`)
- `mkdirSync(dir, { recursive: true })` without `mode` creates directories world-listable (typically 0o755 after umask). `copyFileSync` and `writeFileSync` without `mode` create files world-readable (0o644). The `.nitro-fueled/` directory holds a manifest that records file paths and version history of the project's internal structure. On shared or multi-user systems this metadata is exposed to all local users.
- **Fix**: Use `{ recursive: true, mode: 0o700 }` on `mkdirSync` calls for `.nitro-fueled/`. Use `{ mode: 0o600 }` on `writeFileSync` for `manifest.json`. Note that `writeFileSync` applies `mode` only on file creation; use `fs.chmodSync` after the write to enforce the mode on pre-existing files.

### 2. `console.error(err)` in `index.ts:41` Leaks Stack Traces

- **File**: `packages/cli/src/index.ts:41`
- `console.error(err)` prints the raw Error object, which includes Node.js stack frames with absolute file paths (the CLI's installation path, e.g., `/Users/alice/.nvm/versions/node/v20/lib/node_modules/nitro-fueled/...`). This is visible in terminal output and CI logs.
- **Fix**: Print `err instanceof Error ? err.message : String(err)` in non-verbose mode. Restrict full stack traces to a `--verbose` / `DEBUG` flag.

### 3. `err.message` Forwarded Verbatim in `manifest.ts:53` and `update.ts:26`

- **Files**: `packages/cli/src/utils/manifest.ts:53`, `packages/cli/src/commands/update.ts:26`
- Both catch blocks print `err.message` directly to the terminal. The sources here are local `readFileSync` / `JSON.parse` calls on local files, so the content is attacker-controlled only if the local file system is already compromised. The risk is low in this context, but it diverges from the established project pattern of capping error messages at a character limit.
- **Fix**: Apply the 200-character cap established in security.md: `(err.message ?? String(err)).slice(0, 200)` before printing.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Missing boundary check on `destPath = resolve(cwd, relPath)` — a compromised scaffold (supply-chain attack or local modification) could copy files to arbitrary locations outside the project directory. The fix is a one-line `startsWith` assertion that eliminates the path entirely.
