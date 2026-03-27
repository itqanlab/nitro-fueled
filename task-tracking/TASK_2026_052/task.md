# Task: Manifest — Version Tracking and Install Record

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P0-Critical |
| Complexity | Simple      |

## Description

Create the `.nitro-fueled/manifest.json` file format and write it on every `init` run. This is the foundational data structure that both the `update` command (TASK_2026_050) and the `init` merge logic depend on.

The manifest records:
- Which version of nitro-fueled was installed
- Every core file that was copied with its SHA-256 checksum and the version it came from
- Every generated file (AI agents, anti-patterns) with metadata about when and how it was generated

### Manifest format

```json
{
  "version": "1.2.3",
  "installedAt": "2026-03-27T10:00:00Z",
  "updatedAt": "2026-03-27T10:00:00Z",
  "coreFiles": {
    ".claude/agents/nitro-planner.md": {
      "checksum": "sha256:abc123",
      "installedVersion": "1.0.0"
    }
  },
  "generatedFiles": {
    ".claude/agents/nitro-react-developer.md": {
      "generatedAt": "2026-03-27T10:00:00Z",
      "stack": "react",
      "generator": "ai"
    },
    ".claude/anti-patterns.md": {
      "generatedAt": "2026-03-27T10:00:00Z",
      "stack": "react,typescript",
      "generator": "template"
    }
  }
}
```

### What to build

1. **`packages/cli/src/utils/manifest.ts`** — utility module:
   - `readManifest(cwd)` → parse `.nitro-fueled/manifest.json`, return typed object or null
   - `writeManifest(cwd, manifest)` → write to `.nitro-fueled/manifest.json`
   - `computeChecksum(filePath)` → SHA-256 of file contents, prefixed `sha256:`
   - `buildCoreFileEntry(filePath)` → read + checksum a single file
   - Types: `Manifest`, `CoreFileEntry`, `GeneratedFileEntry`

2. **Wire into `init.ts`** — after all files are scaffolded and generated:
   - Read existing manifest if present (for merge runs)
   - For each scaffolded core file: compute checksum, add to `coreFiles`
   - For each generated file (anti-patterns, AI agents): add to `generatedFiles`
   - Write manifest to `.nitro-fueled/manifest.json`
   - Add `.nitro-fueled/` to `.gitignore` (it is local state, not project config)

3. **Display on init** — print one line: `  Manifest: written (.nitro-fueled/manifest.json)`

## Dependencies

- None

## Parallelism

**Do NOT run in parallel with TASK_2026_049.** Both modify `packages/cli/src/commands/init.ts`.
Run this task first (Wave 1), then TASK_2026_049 (Wave 2).

## Acceptance Criteria

- [ ] `packages/cli/src/utils/manifest.ts` exists with all four exports
- [ ] `init` writes `.nitro-fueled/manifest.json` after scaffolding completes
- [ ] Manifest includes every core file copied with correct SHA-256 checksum
- [ ] Manifest includes every generated file with stack and generator metadata
- [ ] Re-running `init` on an existing project updates the manifest without losing existing entries
- [ ] `.nitro-fueled/` is added to `.gitignore` automatically
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)

## File Scope

- `packages/cli/src/utils/manifest.ts` (new)
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/utils/gitignore.ts`
