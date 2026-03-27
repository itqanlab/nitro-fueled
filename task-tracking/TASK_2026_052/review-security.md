# Security Review — TASK_2026_052

**Reviewer:** code-security-reviewer
**Date:** 2026-03-27
**Scope:** `packages/cli/src/utils/manifest.ts`, `packages/cli/src/commands/init.ts`
**Status:** COMPLETE

---

## Summary

No critical or high-severity vulnerabilities found. The manifest stores only non-sensitive data (checksums, version strings, relative paths) and is gitignored. The main findings are: unvalidated JSON deserialization with an unsafe type assertion, a TOCTOU race condition on file reads, and unhandled errors in the manifest write path that would produce an unclean failure rather than a graceful message.

---

## Findings

### [MEDIUM] Unvalidated JSON deserialization — `readManifest`

**File:** `packages/cli/src/utils/manifest.ts:34`

```ts
return JSON.parse(raw) as Manifest;
```

`JSON.parse` returns `unknown` at runtime; the `as Manifest` cast is purely a compile-time assertion with no runtime enforcement. If `manifest.json` is corrupt, hand-edited, or written by a different tool version, the parsed object may deviate from the `Manifest` shape. Downstream spreads in `buildAndWriteManifest` propagate whatever the file contains:

```ts
coreFiles: { ...(existing?.coreFiles ?? {}) },
generatedFiles: { ...(existing?.generatedFiles ?? {}) },
```

If a field (e.g. `coreFiles`) is not a plain object in the JSON (e.g., it is an array or a string), the spread silently produces unexpected output. If `installedAt` is missing or non-string, the nullish coalescing on line 297 of `init.ts` still passes the bad value through.

**Risk:** Corrupt or tampered `manifest.json` can cause runtime errors downstream or produce a malformed re-written manifest. No code-execution risk; impact is limited to manifest data integrity.

**Recommendation:** Add a lightweight runtime type guard in `readManifest` before returning, checking that the parsed value is an object with expected field types, returning `null` on mismatch.

---

### [LOW] TOCTOU race condition — `buildAndWriteManifest` → `computeChecksum`

**File:** `packages/cli/src/commands/init.ts:305-307` / `packages/cli/src/utils/manifest.ts:55`

```ts
// init.ts
if (!existsSync(absPath)) continue;
const relPath = relative(cwd, absPath);
manifest.coreFiles[relPath] = buildCoreFileEntry(absPath, version);  // calls readFileSync

// manifest.ts
export function computeChecksum(filePath: string): string {
  const content = readFileSync(filePath);  // can throw if file removed between check and here
```

The `existsSync` guard and the `readFileSync` inside `computeChecksum` are not atomic. On a slow or contested filesystem (or during a concurrent `init` run), a file removed between the check and the read will throw an unhandled exception.

**Risk:** Low in practice (local dev tool, not a server). If triggered, the thrown error propagates up through `buildAndWriteManifest` to the Commander `.action()` handler, which has no catch block — resulting in an unhandled rejection rather than a clean CLI error message.

**Recommendation:** Wrap `computeChecksum` (or the call site) in try/catch so a missing file skips the entry and logs a warning rather than crashing.

---

### [LOW] Unhandled errors in manifest write path

**File:** `packages/cli/src/commands/init.ts:284-323`

`buildAndWriteManifest` calls `buildCoreFileEntry` (which calls `readFileSync` and can throw) and `writeManifest` (which calls `mkdirSync` and `writeFileSync`, both can throw on permissions or disk-full conditions). Neither is wrapped in a try/catch. Because the calling `.action()` handler also lacks a catch, any I/O failure in step 9 produces an unhandled exception instead of a clear error message.

This is a reliability/UX concern that also has a minor security implication: a failure here leaves the init run in a partially-complete state (scaffolding done, manifest absent) with no user-visible error, which could confuse downstream `update` checks that depend on the manifest.

**Recommendation:** Wrap `buildAndWriteManifest` in try/catch in the `.action()` handler and emit a user-facing error message on failure, consistent with the pattern used in steps 3 and 4.

---

### [LOW] `as` type assertion in `getPackageVersion` — convention violation

**File:** `packages/cli/src/commands/init.ts:26`

```ts
const v = (pkg as Record<string, unknown>)['version'];
```

Project convention states: **No `as` type assertions — use type guards or generics.** The surrounding type guard already confirms `'version' in pkg`, but the `as Record<string, unknown>` cast is used to access the property. This is a minor convention violation; functionally safe since the guard runs before the cast.

**Recommendation:** Use `Object.prototype.hasOwnProperty` or destructure via `Reflect.get(pkg, 'version')` to avoid the cast, keeping consistent with the no-`as` rule.

---

### [INFORMATIONAL] Potential out-of-`cwd` path in manifest keys

**File:** `packages/cli/src/commands/init.ts:306`

```ts
const relPath = relative(cwd, absPath);
```

If `absPath` were ever outside `cwd` (e.g. `/some/other/dir/file.md`), `relative()` would produce a key like `../../some/other/dir/file.md` in the manifest JSON. Currently all `absPath` values come from `resolve(cwd, ...)` calls in scaffold functions, so this cannot happen in practice. The manifest keys are not subsequently used for file I/O in this code, so there is no read/write path traversal risk. Noted for completeness.

---

### [INFORMATIONAL] Default file permissions on `manifest.json`

**File:** `packages/cli/src/utils/manifest.ts:48`

```ts
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
```

No explicit `mode` is set. Default is `0o666` before umask. The manifest contains no credentials — only checksums (SHA-256 hashes of source file contents), version strings, and relative file paths. Default mode is acceptable. The `.nitro-fueled/` directory is gitignored, preventing accidental inclusion in commits.

---

## Risk Matrix

| ID | Severity | File | Location | Issue |
|----|----------|------|----------|-------|
| S1 | MEDIUM | manifest.ts | L34 | Unvalidated JSON deserialization — `as Manifest` with no runtime type check |
| S2 | LOW | init.ts / manifest.ts | L305-307 / L55 | TOCTOU between `existsSync` and `readFileSync` in checksum path |
| S3 | LOW | init.ts | L284-323 | No try/catch around `buildAndWriteManifest` — unhandled I/O errors |
| S4 | LOW | init.ts | L26 | `as` type assertion in `getPackageVersion` violates project convention |
| I1 | INFO | init.ts | L306 | `relative()` would produce traversal-style keys if absPath is outside cwd |
| I2 | INFO | manifest.ts | L48 | Default file mode — acceptable given manifest contains no secrets |

---

## Verdict

**Pass with recommendations.** No blockers. The MEDIUM finding (S1) is the most actionable: adding a runtime type guard to `readManifest` would prevent a class of subtle bugs on re-runs with a malformed or version-skewed manifest. The LOW findings are worth addressing before the `update` command (TASK_2026_050) ships, since that command will rely on the manifest for upgrade decisions.
