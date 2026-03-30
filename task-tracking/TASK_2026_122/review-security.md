# Security Review — TASK_2026_122

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 4                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | `--cortex-path` reaches `configureNitroCortex()` which validates existence and `realpathSync`-resolves it before use |
| Path Traversal           | PASS   | Both `configureMcp()` and `configureNitroCortex()` use `realpathSync` and verify the `dist/index.js` entry point exists; no boundary escape is possible |
| Secret Exposure          | PASS   | No API keys, tokens, or credentials in any of the four files |
| Injection (shell/prompt) | PASS   | No `exec`/`execSync` with string concatenation; MCP server path is stored in JSON config, not passed to a shell |
| Insecure Defaults        | FAIL   | `writeFileSync` and `mkdirSync` in `mergeJsonFile` omit explicit file modes; produced files are world-readable (0o644) |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: `settings.json` `{{NITRO_CORTEX_PATH}}` placeholder is never substituted

- **File**: `apps/cli/scaffold/.claude/settings.json:7`
- **Problem**: The scaffold file contains the literal string `"{{NITRO_CORTEX_PATH}}/dist/index.js"` as the MCP server argument. The `scaffoldFiles()` function in `init.ts` copies scaffold files verbatim via `copyFileSync` with no template substitution step. When `npx nitro-fueled init` runs, this file is copied as-is into `.claude/settings.json` with the unresolved placeholder intact.
- **Impact**: Claude Code reads `.claude/settings.json` at startup and attempts to launch `node {{NITRO_CORTEX_PATH}}/dist/index.js`. Node resolves the argument as a literal path, fails silently or emits a startup error, and the `nitro-cortex` MCP server is never available to any agent. Every auto-pilot and orchestration workflow that depends on the cortex tools is silently broken for every project that runs `init`. Additionally, if `--cortex-path` is supplied (which triggers `configureNitroCortex()` to write `.mcp.json`), two conflicting MCP entries exist: one in `.claude/settings.json` (broken placeholder) and one in `.mcp.json` (correct absolute path). This creates non-deterministic MCP resolution depending on which config file Claude Code loads first.
- **Fix**: Either (a) remove the `mcpServers` block from the scaffold `settings.json` entirely and rely solely on the `configureNitroCortex()` flow writing the correct path to `.mcp.json`, or (b) add a post-copy substitution step in `scaffoldFiles()` that replaces `{{NITRO_CORTEX_PATH}}` with the resolved path if `--cortex-path` is supplied, or with an empty sentinel that Claude Code ignores if it is not. Option (a) is simpler and consistent with how `session-orchestrator` is handled (no scaffold entry, only written on demand).

## Minor Issues

### Issue 1: `writeFileSync` and `mkdirSync` omit explicit file modes for MCP config files

- **File**: `apps/cli/src/utils/mcp-configure.ts:31-36`
- **Problem**: `mkdirSync(dir, { recursive: true })` and `writeFileSync(filePath, ..., 'utf-8')` both omit explicit mode options. The resulting directory is created at the umask default (typically 0o755, world-listable) and the file at 0o644 (world-readable). The files written are `.mcp.json` (project-level MCP config) and `~/.claude.json` (global Claude config), both of which contain the absolute path to the local MCP server binary.
- **Impact**: On a shared or multi-user machine, any local user can read the MCP config and learn the file system layout of the project owner's machine. The path itself is not a secret, but it discloses home directory structure and project locations.
- **Fix**: Pass `{ recursive: true, mode: 0o700 }` to `mkdirSync` and `{ encoding: 'utf-8', mode: 0o600 }` to `writeFileSync`. This matches the pattern documented in project security lessons (TASK_2026_068).

### Issue 2: `JSON.parse` result cast via `as` without runtime validation in `handleNitroCortexConfig`

- **File**: `apps/cli/src/commands/init.ts:281`
- **Problem**: `JSON.parse(readFileSync(projectMcp, 'utf-8')) as Record<string, unknown>` uses a TypeScript `as` assertion. If `.mcp.json` contains non-object content (e.g., a JSON array, `null`, or a truncated write), the cast succeeds at the type level and the subsequent `cfg['mcpServers']` access returns `undefined` rather than throwing.
- **Impact**: In this specific call site the consequence is benign — the fallback `{}` on line 283 covers the `undefined` case, and a `try/catch` wraps the block. No crash, no incorrect config write. However, this pattern violates the project convention against `as` assertions documented in `review-general.md`.
- **Fix**: Load as `unknown`, then guard: `if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) { /* fall through */ }` before accessing properties.

### Issue 3: Error message from `writeFileSync` echoed verbatim to stderr in `mergeJsonFile`

- **File**: `apps/cli/src/utils/mcp-configure.ts:38`
- **Problem**: `console.error(\`Error: Could not write ${filePath}: ${msg}\`)` echoes the raw exception message from `writeFileSync` without capping its length. Node.js I/O error messages can include internal paths and detailed OS error information.
- **Impact**: Low risk in a local developer CLI (the operator is the user). However, the project security lessons document a 200-character cap on echoed exception strings (TASK_2026_068). This is inconsistent with that convention.
- **Fix**: Cap `msg` to 200 characters before echoing: `const cappedMsg = msg.length > 200 ? msg.slice(0, 200) + '…' : msg`.

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: The `{{NITRO_CORTEX_PATH}}` placeholder in `scaffold/.claude/settings.json` is never substituted, making the scaffold-installed `nitro-cortex` MCP entry permanently broken for every project initialized via `npx nitro-fueled init`. This is a serious functional defect disguised as a configuration issue — it silently defeats the entire purpose of TASK_2026_122's CLI integration work. It should be fixed before this task is marked COMPLETE, but it is not a security exploit and does not block approval.
