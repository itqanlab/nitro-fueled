# Code Logic Review -- TASK_2026_008

## Summary

The CLI scaffold for `nitro-fueled` is well-structured and meets the acceptance criteria. TypeScript compiles cleanly, all four commands register correctly with Commander.js, `--help` and `--version` produce correct output, and each stub prints "not yet implemented" as required. The ESM setup with Node16 module resolution is correct and the shebang line survives compilation.

This is a scaffold task so the bar is "correct structure, compiles, stubs work." It clears that bar. The findings below are things that should be addressed before this scaffold is built upon.

## Findings

### Finding 1: Version is duplicated across two files

- **Severity**: SERIOUS
- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/package.json` (line 3) and `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/index.ts` (line 14)
- **Issue**: The version string `"0.1.0"` is hardcoded in both `package.json` and the `.version('0.1.0')` call in `index.ts`. When the version is bumped in `package.json`, the CLI will still report the old version unless someone remembers to update `index.ts` too. This is a guaranteed future bug.
- **Fix**: Read the version dynamically from `package.json` at runtime. With ESM + Node16 this can be done via:
  ```typescript
  import { readFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  import { dirname, join } from 'node:path';

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  program.version(pkg.version);
  ```
  Alternatively, use `createRequire(import.meta.url)` to load the JSON.

### Finding 2: Stub commands exit with code 0 (success)

- **Severity**: MINOR
- **File**: All command files under `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/`
- **Issue**: Each stub prints "not yet implemented" but exits with code 0. If anyone uses these commands in a script or CI pipeline, the script will continue as if the command succeeded. The stubs should signal failure.
- **Fix**: Add `process.exitCode = 1;` after the console.log in each stub, or use `process.exit(1)`. This makes it clear the command did not actually do anything. Example:
  ```typescript
  .action(() => {
    console.log('nitro-fueled init: not yet implemented');
    process.exitCode = 1;
  });
  ```

### Finding 3: No `files` field in package.json for publish hygiene

- **Severity**: MINOR
- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/package.json`
- **Issue**: When this package is eventually published to npm, without a `files` field the entire package directory (minus `.gitignore`d paths) will be included. The `src/` directory, `tsconfig.json`, and other development files would ship to users unnecessarily.
- **Fix**: Add a `files` field to scope what gets published:
  ```json
  "files": ["dist"]
  ```
  Not blocking for a scaffold, but best to set up correctly from the start.

### Finding 4: No `main` or `exports` field in package.json

- **Severity**: MINOR
- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/package.json`
- **Issue**: The package has `"type": "module"` and a `bin` entry, but no `exports` or `main` field. This means the package cannot be imported programmatically by other packages in a future monorepo setup. For a CLI-only package this is acceptable now, but if `packages/scaffold/` or any other package needs to import utilities from the CLI package later, it will fail.
- **Fix**: Consider adding:
  ```json
  "exports": {
    ".": "./dist/index.js"
  }
  ```

### Finding 5: package-lock.json is untracked

- **Severity**: MINOR
- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/package-lock.json`
- **Issue**: `git status` shows `packages/cli/package-lock.json` as untracked (`??`). Lock files should be committed for applications (which this CLI is) to ensure reproducible builds. Without it, `npm install` on a fresh clone may resolve different dependency versions.
- **Fix**: Stage and commit `package-lock.json`.

## Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `packages/cli/` directory exists with proper structure | PASS | `src/index.ts`, `src/commands/{init,run,status,create}.ts`, `package.json`, `tsconfig.json`, `.gitignore` all present |
| `package.json` has correct name, bin entry, and dependencies | PASS | name: `nitro-fueled`, bin: `./dist/index.js`, commander ^13.1.0 |
| TypeScript compiles successfully | PASS | `tsc --noEmit` exits cleanly, `dist/` exists with compiled output |
| `npx nitro-fueled --help` shows available commands | PASS | Shows all 4 commands plus help text |
| `npx nitro-fueled --version` shows version | PASS | Outputs `0.1.0` |
| Command stubs exist for init, run, status, create | PASS | All 4 files present with register functions |
| Each stub prints "not yet implemented" when invoked | PASS | All 5 invocations (including `run TASK_ID`) print correctly |

## Verdict

**PASS_WITH_NOTES**

All acceptance criteria are met. The scaffold is clean, minimal, and correctly structured. Finding 1 (duplicated version) is the only one I would classify as serious -- it is a guaranteed future bug that is trivial to fix now and painful to debug later. The remaining findings are minor improvements that are worth doing before building on top of this scaffold, but are not blocking.
