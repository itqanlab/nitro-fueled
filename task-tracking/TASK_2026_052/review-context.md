# Review Context — TASK_2026_052

## Task Scope
- Task ID: 2026_052
- Task type: FEATURE
- Files in scope: (these are the ONLY files reviewers may touch)
  - `packages/cli/src/utils/manifest.ts` (new) — Manifest types and utility functions
  - `packages/cli/src/commands/init.ts` — Wired manifest building and writing after scaffolding

## Git Diff Summary

Implementation commit: `8142f7e` — feat(TASK_2026_052): add manifest — version tracking and install record

### packages/cli/src/utils/manifest.ts (new file, 68 lines)
- New utility module with TypeScript types (`CoreFileEntry`, `GeneratedFileEntry`, `Manifest`)
- `readManifest(cwd)` — reads `.nitro-fueled/manifest.json`, returns `Manifest | null`
- `writeManifest(cwd, manifest)` — writes to `.nitro-fueled/manifest.json`, creates directory if needed
- `computeChecksum(filePath)` — SHA-256 of file contents prefixed with `sha256:`
- `buildCoreFileEntry(filePath, version)` — builds `CoreFileEntry` with checksum and version

### packages/cli/src/commands/init.ts (modified)
- Added `createRequire`, `relative` imports
- Added `getPackageVersion()` — reads version from `package.json` at runtime via `createRequire`
- Added `GeneratedFileInfo` interface and `buildAndWriteManifest()` function
- Wired into main init flow as "Step 9: Write manifest" before MCP configuration
- Handles re-runs: reads existing manifest and merges (preserves `installedAt`, merges `coreFiles`/`generatedFiles`)
- Categorizes CLAUDE.md and anti-patterns as `template`-generated; AI agents as `ai`-generated
- Prints: `  Manifest: written (.nitro-fueled/manifest.json)`

## Project Conventions

From CLAUDE.md:
- Git: conventional commits with scopes
- TypeScript is the primary language for CLI packages
- File-based task/state management
- No `as` type assertions — use type guards or generics
- No `any` type — use `unknown` + type guards
- Error handling: never swallow errors, no empty catch blocks
- kebab-case for file names
- camelCase for variables/functions, PascalCase for interfaces/types

## Style Decisions from Review Lessons

Relevant to TypeScript/CLI code being reviewed:

**TypeScript Anti-Patterns:**
- No `as` type assertions — `JSON.parse(raw) as Manifest` in `readManifest` and `(pkg as Record<string, unknown>)` in `getPackageVersion` are potential violations
- No `any` type
- Error handling: never swallow errors — `catch {}` empty blocks hide issues

**CLI/npm Hygiene:**
- Version strings must have single source of truth — `getPackageVersion()` reads from `package.json` via `createRequire` (correct pattern)
- Functions that write files should guard all I/O with try/catch

**Security:**
- `JSON.parse(raw) as Manifest` has no runtime type safety — code calling field methods may throw on unexpected types
- `writeFileSync` for manifest.json: manifest is not sensitive (no credentials), so default mode is acceptable
- File generation functions must guard I/O with try/catch and return typed failure — `computeChecksum` and `buildCoreFileEntry` use `readFileSync` without try/catch

**File Size Limits:**
- `manifest.ts`: 68 lines — well within 200-line service limit
- `init.ts` additions: ~80 lines added — cumulative size should be checked

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `packages/cli/src/utils/manifest.ts`
- `packages/cli/src/commands/init.ts`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 4
- Serious: 3
- Minor: 0

### Blocking (MUST FIX)
1. `manifest.ts:34` — `JSON.parse(raw) as Manifest` — unsafe `as` assertion with no runtime type guard (Style #1, Logic #3, Security S1)
2. `manifest.ts:35-37` — empty `catch {}` silently swallows I/O and parse errors (Style #2, Logic #1)
3. `init.ts:26` — `(pkg as Record<string, unknown>)` — unnecessary `as` assertion after narrowing (Style #5, Security S4)
4. `init.ts:29-31` — empty `catch { // Fall through }` in `getPackageVersion` — no executed code (Style #6, Logic #2)

### Serious (SHOULD FIX)
5. `manifest.ts:54-58` — `computeChecksum`/`buildCoreFileEntry` unguarded `readFileSync` (Style #3, Logic #4, Security S2)
6. `manifest.ts:44-49` — `writeManifest` unguarded `mkdirSync`/`writeFileSync` (Style #4, Logic #5, Security S3)
7. `init.ts:322` — `buildAndWriteManifest` calls `writeManifest` without try/catch; calling `.action()` has no guard (Style #7, Security S3)
