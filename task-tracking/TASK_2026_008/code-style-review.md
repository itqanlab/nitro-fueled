# Code Style Review — TASK_2026_008

## Summary

This is a CLI scaffold with Commander.js. All four commands are stubs. The structure is clean and the code compiles, but there are several issues ranging from missing `package-lock.json` in `.gitignore` (it is checked into git status as untracked), a duplicated version string, missing `files` field in package.json, and a missing `async` on command actions that will need it soon. For a scaffold, this is acceptable with notes — but "it is just a scaffold" does not excuse setting up patterns that the next developer will copy verbatim into real implementations.

## Findings

### Finding 1: Duplicated version string — single source of truth violation

- **Severity**: SERIOUS
- **File**: `packages/cli/src/index.ts:14` and `packages/cli/package.json:3`
- **Issue**: The version `0.1.0` is hardcoded in both `package.json` (line 3) and `index.ts` (line 14, `.version('0.1.0')`). When the version bumps, one of them will be forgotten. This is the kind of drift that review-lessons/review-general.md explicitly warns about under "Enum values must match canonical source character-for-character."
- **Fix**: Read the version from package.json at runtime. For ESM with Node16 module resolution, use `createRequire` or a JSON import assertion:
  ```typescript
  import { readFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  import { dirname, join } from 'node:path';

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  program.version(pkg.version);
  ```
  Alternatively, use `createRequire(import.meta.url)` to require the JSON file.

### Finding 2: Missing `files` field in package.json

- **Severity**: SERIOUS
- **File**: `packages/cli/package.json`
- **Issue**: No `files` field means `npm publish` will include everything not in `.npmignore` or `.gitignore` — including `src/`, `tsconfig.json`, and any test files added later. The published package should only contain `dist/` and `package.json`. This is not hypothetical; the design doc states `npx nitro-fueled init` as the intended entry point, which means this will be published.
- **Fix**: Add `"files": ["dist"]` to package.json.

### Finding 3: Missing `prepublishOnly` script

- **Severity**: MINOR
- **File**: `packages/cli/package.json:9-12`
- **Issue**: There is no `prepublishOnly` script to ensure `tsc` runs before `npm publish`. Without it, a developer could publish stale or missing `dist/` output. The `start` script also has limited utility — CLIs are invoked via the `bin` entry, not `npm start`.
- **Fix**: Add `"prepublishOnly": "npm run build"`. Consider removing the `start` script or replacing it with something useful like `"lint": "tsc --noEmit"`.

### Finding 4: `package-lock.json` is untracked

- **Severity**: SERIOUS
- **File**: `packages/cli/package-lock.json` (visible in git status)
- **Issue**: The lockfile is listed as untracked (`?? packages/cli/package-lock.json` in git status). It is not in `.gitignore`. For a publishable CLI package, the lockfile should either be committed (to ensure reproducible CI builds) or explicitly gitignored if the project uses a workspace-level lockfile. Right now it is in limbo — neither committed nor ignored.
- **Fix**: Decide on a strategy. If this will eventually live in an Nx workspace with a root lockfile, add `package-lock.json` to `packages/cli/.gitignore`. If this is standalone, commit the lockfile.

### Finding 5: No `type` import for `Command` in `index.ts`

- **Severity**: MINOR
- **File**: `packages/cli/src/index.ts:3`
- **Issue**: In `index.ts`, `Command` is imported as a value (`import { Command } from 'commander'`), which is correct because it is instantiated. However, the four command files correctly use `import type { Command }` since they only use it as a type annotation. This is good — but worth calling out the inconsistency is intentional and correct. No action needed here, but documenting the pattern for future developers: use `import type` when only used in type position, value import when instantiating.
- **Fix**: None needed. This is actually correct. Noting for completeness.

### Finding 6: No error handling or process exit codes

- **Severity**: MINOR
- **File**: `packages/cli/src/index.ts:21`
- **Issue**: `program.parse()` is called without any error handling. Commander handles most errors internally, but when real implementations land, unhandled promise rejections from async actions will silently fail. There is no `.exitOverride()` or top-level catch. For a scaffold this is fine, but the pattern being set here will be copied forward.
- **Fix**: Add a comment or TODO marking where error handling should go. When async actions land, wrap `program.parseAsync()` in a try/catch with `process.exit(1)` on failure. Use `parseAsync()` instead of `parse()` now to prepare for async command handlers:
  ```typescript
  program.parseAsync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
  ```

### Finding 7: `run` command argument naming

- **Severity**: NIT
- **File**: `packages/cli/src/commands/run.ts:5`
- **Issue**: The command is defined as `.command('run [taskId]')` with camelCase `taskId`. Commander will pass this as the first argument to the action handler, which works. However, the design doc shows `npx nitro-fueled run TASK_ID` with the `TASK_` prefix convention. The help text will show `[taskId]` which is fine, but when real implementation lands, the handler should validate the TASK_ID format (e.g., `TASK_2026_NNN`). No action now, but worth a TODO comment.
- **Fix**: Consider adding a comment: `// TODO: validate taskId format (TASK_YYYY_NNN) when implementing`.

### Finding 8: Description string duplicated between package.json and index.ts

- **Severity**: NIT
- **File**: `packages/cli/package.json:4` and `packages/cli/src/index.ts:13`
- **Issue**: The description string `"AI development orchestration — full PM -> Architect -> Dev -> QA pipeline"` appears in both places. Same drift risk as the version string (Finding 1). Less critical since descriptions change rarely, but the pattern is the same.
- **Fix**: Could be read from package.json alongside the version (see Finding 1 fix). Low priority.

### Finding 9: tsconfig — `declarationMap` and `sourceMap` unnecessary for CLI

- **Severity**: NIT
- **File**: `packages/cli/tsconfig.json:13-14`
- **Issue**: `declarationMap: true` and `sourceMap: true` generate `.d.ts.map` and `.js.map` files. For a CLI tool (not a library consumed by other TypeScript projects), declaration maps serve no purpose. Source maps have marginal debugging value for a CLI. These add build artifacts that will be published unless `files` is set correctly (see Finding 2).
- **Fix**: Consider removing `declarationMap`. Keep `declaration` if you plan to export types for programmatic use. `sourceMap` is debatable — keep if you want stack traces with TS line numbers, remove if you want leaner output.

## Verdict

**PASS_WITH_NOTES**

The scaffold is structurally sound. The command registration pattern is clean, `import type` is used correctly in the stub files, the tsconfig settings are appropriate for ESM + Node16, and the file/folder structure matches the design doc. The issues found are not blocking for a scaffold, but Findings 1 (duplicated version), 2 (missing `files` field), and 4 (untracked lockfile) should be addressed before this package gets any closer to publishing. Finding 6 (using `parseAsync` instead of `parse`) should be done now to avoid a behavioral change later when async actions are added.
