# Code Logic Review — TASK_2026_052

## Summary

| Category | Status |
|----------|--------|
| Business Logic Correctness | PASS with minor concerns |
| Implementation Completeness | PASS |
| Stubs/Placeholders | NONE |
| Error Handling | NEEDS ATTENTION |

## Files Reviewed

- `packages/cli/src/utils/manifest.ts` (68 lines)
- `packages/cli/src/commands/init.ts` (additions ~80 lines)

---

## Business Logic Analysis

### Manifest Types (manifest.ts:5-22)
- **CoreFileEntry**: `checksum`, `installedVersion` — matches spec
- **GeneratedFileEntry**: `generatedAt`, `stack`, `generator: 'ai' | 'template'` — matches spec
- **Manifest**: `version`, `installedAt`, `updatedAt`, `coreFiles`, `generatedFiles` — matches spec

### readManifest (manifest.ts:28-38)
- Returns `Manifest | null` — correct signature
- Checks file existence before reading — correct
- Falls back to `null` on parse error — acceptable

### writeManifest (manifest.ts:44-49)
- Creates directory recursively — correct
- Writes JSON with 2-space indent and trailing newline — correct format

### computeChecksum (manifest.ts:54-58)
- Uses SHA-256 with `sha256:` prefix — matches spec
- Reads raw bytes (no encoding) for accurate hash — correct

### buildCoreFileEntry (manifest.ts:63-68)
- Computes checksum and pairs with version — correct

### buildAndWriteManifest (init.ts:284-324)
- Reads existing manifest for merge runs — **CORRECT** per acceptance criteria
- Preserves `installedAt` from existing manifest — **CORRECT**
- Updates `updatedAt` on every run — **CORRECT**
- Spreads existing entries before adding new ones — **CORRECT merge logic**
- Checks `existsSync` before computing checksums — guards against missing files

### init.ts Wire-in (Step 9, lines 447-467)
- Placed after scaffolding, before MCP config — correct ordering
- Scaffolded files passed as core files — **CORRECT**
- CLAUDE.md, anti-patterns.md treated as `template` generator — **CORRECT**
- AI-generated agents treated as `ai` generator — **CORRECT**

---

## Issues Found

### ISSUE 1: Empty catch block swallows errors silently
**Location**: `packages/cli/src/utils/manifest.ts:35-37`
**Severity**: Medium
**Description**: Empty `catch {}` block returns `null` without logging the error. If the manifest file exists but contains malformed JSON, the error is silently swallowed.
```typescript
try {
  const raw = readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as Manifest;
} catch {
  return null;  // No logging, no distinction between "file not found" and "parse error"
}
```
**Business Impact**: Debugging manifest issues becomes difficult since there's no indication that parsing failed vs file not existing.

---

### ISSUE 2: Empty catch block in getPackageVersion
**Location**: `packages/cli/src/commands/init.ts:29-31`
**Severity**: Low
**Description**: Empty `catch {}` falls back to `'0.0.0'` without logging. If `package.json` can't be read, manifest will record wrong version.
```typescript
} catch {
  // Fall through
}
return '0.0.0';
```
**Business Impact**: Low — fallback version is reasonable for development, but silent failure could mask real issues.

---

### ISSUE 3: No runtime validation of parsed manifest shape
**Location**: `packages/cli/src/utils/manifest.ts:34`
**Severity**: Medium
**Description**: `JSON.parse(raw) as Manifest` trusts the file contents without validation. If manifest.json has wrong shape (missing fields, wrong types), callers will get runtime errors when accessing fields like `.coreFiles`.
```typescript
return JSON.parse(raw) as Manifest;
```
**Business Impact**: If user manually edits manifest.json incorrectly, or if file is corrupted, init will crash with unhelpful error instead of graceful recovery.

---

### ISSUE 4: computeChecksum lacks I/O error handling
**Location**: `packages/cli/src/utils/manifest.ts:54-58`
**Severity**: Low (mitigated)
**Description**: `readFileSync` can throw if file doesn't exist or is unreadable. No try/catch wrapper.
**Mitigation**: Callers in `buildAndWriteManifest` check `existsSync` before calling `buildCoreFileEntry`.
**Business Impact**: Low due to mitigation, but direct calls to `computeChecksum` without existence check will throw.

---

### ISSUE 5: writeManifest lacks I/O error handling
**Location**: `packages/cli/src/utils/manifest.ts:44-49`
**Severity**: Medium
**Description**: `mkdirSync` and `writeFileSync` can throw (permissions, disk full). Unhandled exceptions will crash init without user-friendly error message.
```typescript
export function writeManifest(cwd: string, manifest: Manifest): void {
  const manifestPath = resolve(cwd, '.nitro-fueled', 'manifest.json');
  const dir = dirname(manifestPath);
  mkdirSync(dir, { recursive: true });  // Can throw
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');  // Can throw
}
```
**Business Impact**: If write fails, user sees cryptic Node.js error instead of actionable message.

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| `manifest.ts` exists with all four exports | PASS | `readManifest`, `writeManifest`, `computeChecksum`, `buildCoreFileEntry` exported |
| `init` writes manifest after scaffolding | PASS | Step 9 in init flow |
| Manifest includes core files with SHA-256 checksum | PASS | Uses `computeChecksum` with `sha256:` prefix |
| Manifest includes generated files with metadata | PASS | `stack` and `generator` recorded |
| Re-running init updates without losing entries | PASS | Spreads existing entries before adding new |
| `.nitro-fueled/` added to `.gitignore` | PASS | Step 6 calls `ensureGitignore` |
| TypeScript compiles cleanly | NOT VERIFIED | Build step not run in this review |

---

## Stubs/Placeholders

**NONE FOUND** — All functions have complete implementations.

---

## Edge Cases Analyzed

1. **First run (no existing manifest)**: `readManifest` returns `null`, new manifest created with `installedAt = now` — CORRECT
2. **Re-run (manifest exists)**: Existing manifest read, `installedAt` preserved, entries merged — CORRECT
3. **File removed between runs**: Stale entry preserved in manifest — ACCEPTABLE per spec ("without losing existing entries")
4. **Empty detectedStacks**: `stackLabel` may be empty string for generated file entries — ACCEPTABLE
5. **scaffoldedFiles empty on re-run**: Existing core file entries preserved, no crash — CORRECT

---

## Verdict

**PASS WITH RECOMMENDATIONS**

The implementation correctly fulfills all acceptance criteria. Business logic for manifest creation, merging, and versioning is sound. However, there are error handling gaps that should be addressed:

1. Add minimal error logging in empty catch blocks (Issues 1, 2)
2. Add runtime validation for parsed manifest shape (Issue 3)
3. Wrap `writeManifest` I/O in try/catch with user-friendly error (Issue 5)

These are not blockers but should be addressed in a follow-up or before production release.
