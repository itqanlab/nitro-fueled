# Code Style Review - TASK_2026_009 (CLI init Command)

**Reviewer**: Code Style Reviewer
**Date**: 2026-03-24
**Files Reviewed**: 8

---

## Findings

### [SERIOUS] Duplicated `isClaudeAvailable()` function

- **File**: `packages/cli/src/commands/init.ts`
- **Line**: 31-38
- **Issue**: `isClaudeAvailable()` is defined identically in both `init.ts` (line 31) and `preflight.ts` (line 10). The `create` command already uses the one from `preflight.ts`. The `init` command should reuse it rather than duplicating.
- **Fix**: Import `basicPreflightChecks` or extract `isClaudeAvailable` as a shared export from `preflight.ts` and use it in `init.ts`. Delete the local copy.

### [SERIOUS] Contradictory Claude CLI check logic in init

- **File**: `packages/cli/src/commands/init.ts`
- **Lines**: 245-249 (hard fail) vs 118-122 (soft skip)
- **Issue**: At line 245, the init command hard-fails with `exitCode = 1` if Claude CLI is not found. But at line 118, `handleStackDetection` also checks `isClaudeAvailable()` and gracefully skips agent generation. The hard fail at line 245 means the soft skip at 118 is dead code -- it can never be reached. Either the prereq check is too strict (init should work without Claude CLI since it just copies files), or the soft skip is unnecessary.
- **Fix**: Remove the hard prerequisite check at line 245. Scaffolding files does not require Claude CLI. Only agent generation does, and that path already handles the missing CLI gracefully. Users should be able to `init` without Claude CLI installed and configure agents later.

### [SERIOUS] `command -v` is not portable across all shells

- **File**: `packages/cli/src/commands/init.ts`
- **Line**: 33
- **Issue**: `execSync('command -v claude', { stdio: 'ignore' })` uses `command -v`, which is a shell builtin. On Windows (cmd.exe / PowerShell), this will always fail. The `preflight.ts` copy has the same problem. Since this is a CLI tool meant to be installed into "any project," Windows support matters.
- **Fix**: Use `which` package or implement a cross-platform lookup (e.g., try `where claude` on Windows, or use `process.platform` to branch). Alternatively, try `spawnSync('claude', ['--version'])` which works cross-platform.

### [SERIOUS] Hardcoded skill directory list will silently diverge from scaffold

- **File**: `packages/cli/src/commands/init.ts`
- **Line**: 81
- **Issue**: `const skillDirs = ['orchestration', 'auto-pilot', 'technical-content-writer', 'ui-ux-designer']` is a hardcoded list. If a new skill is added to the scaffold, this list must be manually updated. There is no mechanism to detect the mismatch -- the new skill will simply not be copied, and the user gets no error.
- **Fix**: Dynamically read skill subdirectories from the scaffold source: `readdirSync(resolve(scaffoldRoot, '.claude/skills'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)`. This makes the init command self-maintaining.

### [SERIOUS] `generateClaudeMd` uses path splitting that fails on Windows

- **File**: `packages/cli/src/utils/claude-md.ts`
- **Line**: 12
- **Issue**: `resolve(cwd).split('/').pop()` splits on forward slash only. On Windows, `resolve()` returns backslash-separated paths (e.g., `C:\Users\foo\project`), so `.split('/')` returns the full path as a single element, making `projectName` the entire Windows path string.
- **Fix**: Use `path.basename(cwd)` instead. It is cross-platform by design.

### [SERIOUS] `expandTilde` handles `~` but not `~user` and does not cover Windows

- **File**: `packages/cli/src/utils/mcp-configure.ts`
- **Line**: 6-10
- **Issue**: The function handles `~/` but not `~username/` (valid on Unix). More importantly, on Windows `homedir()` works but tilde expansion is not a thing -- the function will silently pass through `~\something` without expanding. The function name implies it handles tilde, so callers may rely on it incorrectly.
- **Fix**: Add a JSDoc comment documenting the limitation. Optionally handle `~username` using `os.userInfo()` or at minimum warn that this is Unix-only.

### [SERIOUS] `detectNodeFrameworks` conflict resolution is fragile

- **File**: `packages/cli/src/utils/stack-detect.ts`
- **Lines**: 111-116
- **Issue**: The conflict resolution uses `splice` based on `indexOf`, which mutates the array while iterating over its logical content. If the framework list order changes (e.g., from reordering `depMap`), the deduplication could remove the wrong entry. More critically, only two conflicts are handled (next/react, nuxt/vue). What about SvelteKit + Svelte? Remix + React? Astro + React/Vue/Svelte?
- **Fix**: Use a `Set` or a priority-based filter pattern. Define meta-framework-to-base-framework mappings and filter generically, e.g., `const metaOverrides = { nextjs: 'react', nuxt: 'vue', sveltekit: 'svelte' }`.

### [SERIOUS] `detectStack` deduplication drops TypeScript stack but frameworks go to nodejs

- **File**: `packages/cli/src/utils/stack-detect.ts`
- **Lines**: 198-201, 229-233
- **Issue**: When both `nodejs` and `typescript` are detected, the switch at line 199-201 calls `detectNodeFrameworks(cwd)` for both, producing duplicate framework detection. Then at line 231-233, the typescript entry is removed via `splice`. But the `nodejs` entry already has the frameworks, so the user sees `nodejs (angular, react)` rather than `typescript (angular, react)`. This is misleading -- a project with `tsconfig.json` is TypeScript, not vanilla Node.
- **Fix**: When merging, prefer the `typescript` label over `nodejs` since it is more specific. Or, rename `nodejs` to `typescript` when `tsconfig.json` is present, rather than adding a separate entry and then removing it.

### [MINOR] Unused import: `statSync` in scaffold.ts

- **File**: `packages/cli/src/utils/scaffold.ts`
- **Line**: 1
- **Issue**: `statSync` is imported from `node:fs` but never used anywhere in the file.
- **Fix**: Remove `statSync` from the import.

### [MINOR] Unused import: `relative` in scaffold.ts

- **File**: `packages/cli/src/utils/scaffold.ts`
- **Line**: 2
- **Issue**: `relative` is imported from `node:path` but never used.
- **Fix**: Remove `relative` from the import.

### [MINOR] Unused import: `join` in scaffold.ts

- **File**: `packages/cli/src/utils/scaffold.ts`
- **Line**: 2
- **Issue**: `join` is imported but only `resolve` is semantically needed. Actually, `join` IS used on lines 61-62. Retracted -- `join` is used. However, `relative` and `statSync` remain unused.
- **Fix**: N/A for `join`. Remove `relative` and `statSync`.

### [MINOR] `CURRENT_FILE` module-level constant naming inconsistency

- **File**: `packages/cli/src/utils/scaffold.ts`
- **Line**: 5
- **Issue**: `CURRENT_FILE` uses `SCREAMING_SNAKE_CASE`, but the codebase convention (from `agent-map.ts` line 8: `AGENT_MAP`) also uses it for the exported constant. However, `CURRENT_FILE` is a private module-level variable, not a public constant. The project's CLAUDE.md says constants should use `camelCase`. The CLI codebase is not an Angular project so that convention may not strictly apply, but consistency within the CLI package matters.
- **Fix**: Consider renaming to `currentFile` for consistency, or document that `SCREAMING_SNAKE` is acceptable for module-level computed constants in the CLI package.

### [MINOR] Console output inconsistency: `console.error` vs `console.log` for non-error messages

- **File**: `packages/cli/src/utils/mcp-setup-guide.ts`
- **Lines**: 7-40
- **Issue**: `displayMcpSetupGuide` uses `console.error` for ALL output including setup instructions, section headers, and informational content. This is not an error -- it is instructional output. Using `console.error` means piping stdout would lose the setup guide. Other files (like `init.ts`) correctly use `console.log` for informational messages and `console.error` only for actual errors/warnings.
- **Fix**: Use `console.log` for informational/instructional output. Reserve `console.error` for actual errors and warnings.

### [MINOR] `McpServerType` type is overly narrow

- **File**: `packages/cli/src/utils/mcp-config.ts`
- **Line**: 5
- **Issue**: `type McpServerType = 'stdio' | 'http'` -- Claude Code MCP config also supports `'sse'` transport type. If someone configures an SSE server, `extractMcpEntry` will silently accept it (line 54 defaults to `'stdio'` when type is not recognized), potentially misvalidating the entry.
- **Fix**: Add `'sse'` to the union. Also consider making the default case on line 55-63 return null for unrecognized types rather than silently treating them as stdio.

### [MINOR] `proposeAgents` linear scan per framework

- **File**: `packages/cli/src/utils/stack-detect.ts`
- **Lines**: 248-249
- **Issue**: `AGENT_MAP.find()` is called for every framework in every stack. With 42 entries this is fine, but the data structure is doing a linear scan when a `Map<string, AgentMapping>` keyed by `${language}:${framework ?? 'null'}` would be O(1) and clearer in intent.
- **Fix**: Low priority. Consider converting `AGENT_MAP` to a `Map` for lookup if the list grows. Current size is acceptable.

### [NITPICK] `prompt()` function shadows `node:readline` semantics

- **File**: `packages/cli/src/commands/init.ts`
- **Line**: 21
- **Issue**: The function is named `prompt` which shadows the global `prompt` (not relevant in Node, but could confuse readers). More importantly, this is a reusable utility that could live in a shared `utils/prompt.ts` for use by future interactive commands.
- **Fix**: Extract to `utils/prompt.ts` and name it `askQuestion` or `promptUser` for clarity.

### [NITPICK] No type narrowing on `AgentProposal.stack` field

- **File**: `packages/cli/src/utils/stack-detect.ts`
- **Line**: 13
- **Issue**: `stack: string` is a freeform string assembled via string concatenation (`${stack.language} + ${fw}`). There is no guarantee this matches any known format. Consumers cannot pattern-match on it.
- **Fix**: Consider making `stack` a structured type `{ language: string; framework?: string }` instead of a display string. Add a separate `displayName` getter or function.

### [NITPICK] Magic string `'session-orchestrator'` repeated across files

- **File**: `packages/cli/src/utils/mcp-config.ts` (line 49), `mcp-setup-guide.ts` (line 24), `mcp-configure.ts` (line 77 via `buildMcpConfigEntry`)
- **Issue**: The MCP server name `'session-orchestrator'` appears as a string literal in three different files. If the server name changes, all three must be updated.
- **Fix**: Define `const MCP_SERVER_NAME = 'session-orchestrator'` in a shared location and reference it everywhere.

---

## Summary

**Overall Assessment**: The implementation is functional and well-structured for a first pass. The code is readable, functions are reasonably scoped, and error handling is present throughout. Import organization is consistent (node builtins first, then third-party, then local). Type usage is generally good with proper interfaces.

**However**, there are several issues that will cause real problems:

1. **The duplicated `isClaudeAvailable`** is the kind of thing that leads to behavioral divergence when one copy gets updated and the other does not. This is the most straightforward fix.

2. **The contradictory Claude CLI check** means users cannot scaffold without Claude CLI, which is unnecessarily restrictive. File copying does not need Claude.

3. **The hardcoded skill directory list** is a maintenance time bomb. When someone adds a skill to the scaffold and forgets to update this list, users get a silently incomplete setup.

4. **Cross-platform issues** (path splitting, `command -v`, tilde expansion) will break on Windows. If Windows is not a supported platform, that should be documented. If it is, these need fixing.

5. **The TypeScript/Node.js deduplication** produces misleading output (shows `nodejs` instead of `typescript` for TS projects).

**Severity Breakdown**:
- BLOCKING: 0
- SERIOUS: 8
- MINOR: 6
- NITPICK: 3

**Score**: 5.5/10 -- Acceptable with several issues to address. The code works for the happy path on macOS/Linux, but has duplication, portability problems, and a maintenance trap that will bite within a few months.

**What a stronger implementation would include**:
- Shared utility extraction (prompt, isClaudeAvailable)
- Dynamic scaffold discovery instead of hardcoded lists
- Cross-platform path handling throughout
- A `--verbose` flag for debugging scaffold resolution
- Unit tests for `detectStack`, `proposeAgents`, and `expandTilde` edge cases
