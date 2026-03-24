# Security Review: TASK_2026_009 -- CLI init Command

**Reviewer:** Security Review Agent
**Date:** 2026-03-24
**Scope:** CLI init command and supporting utilities
**Files Reviewed:**
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/utils/scaffold.ts`
- `packages/cli/src/utils/stack-detect.ts`
- `packages/cli/src/utils/agent-map.ts`
- `packages/cli/src/utils/claude-md.ts`
- `packages/cli/src/utils/mcp-configure.ts`
- `packages/cli/src/utils/mcp-config.ts`
- `packages/cli/src/utils/mcp-setup-guide.ts`
- `packages/cli/src/utils/preflight.ts`
- `packages/cli/src/utils/mcp-connectivity.ts` (related; uses spawnSync with MCP config values)

---

## Findings

### SEC-001: Command Injection via MCP Config Values in mcp-connectivity.ts

**Severity:** HIGH
**File:** `utils/mcp-connectivity.ts` lines 17-18, 35
**Category:** Command Injection

The `testMcpConnectivity` function reads `command` and `args` from the MCP config entry (parsed from JSON files on disk) and passes them directly to `spawnSync`:

```typescript
const command = entry.command;        // From parsed JSON
const args = entry.args ?? [];        // From parsed JSON
const result = spawnSync(command, args, { ... });
```

If an attacker can write to `.mcp.json`, `.claude.json`, or `.claude/settings.json`, they can achieve arbitrary command execution. While these are config files the user controls, the tool trusts their contents without validation. An attacker who gains write access to the project directory (e.g., via a malicious dependency's postinstall script or a supply chain compromise) could inject a malicious command.

**Recommendation:**
- Validate that `command` is one of an allowlist (e.g., `node`, `npx`, `python`).
- At minimum, validate `command` does not contain shell metacharacters or path traversal.
- Consider warning the user before executing an unfamiliar command.

---

### SEC-002: Symlink Following in File Copy Operations

**Severity:** MEDIUM
**File:** `utils/scaffold.ts` lines 58-77
**Category:** Symlink Attack

The `copyDirRecursive` function uses `readdirSync` with `withFileTypes` and checks `entry.isDirectory()` / `entry.isFile()`. However, it does not check `entry.isSymbolicLink()`. If symlinks exist in the scaffold source directory (or are injected into it), `copyFileSync` will follow them and copy the target file's contents. This could:

1. Exfiltrate sensitive files if the scaffold source is compromised (a symlink pointing to `/etc/shadow` or `~/.ssh/id_rsa` would cause those contents to be copied into the project).
2. Overwrite unintended destinations if `destPath` is a symlink planted by an attacker in the target directory.

The `isFile()` check on `Dirent` returns `true` for symlinks pointing to files in some Node.js versions, and `isDirectory()` returns `true` for symlinks pointing to directories.

**Recommendation:**
- Add an `entry.isSymbolicLink()` check and skip symlinks (or resolve and validate their targets).
- Use `lstatSync` on the destination before writing to ensure it is not a symlink pointing outside the project.

---

### SEC-003: No Path Validation on User-Supplied MCP Server Path

**Severity:** MEDIUM
**File:** `utils/mcp-configure.ts` lines 54-55, `commands/init.ts` lines 184-190
**Category:** Path Traversal / Input Validation

The MCP server path is accepted from user input (interactive prompt or `--mcp-path` flag) and resolved into the MCP configuration. While `realpathSync` is used (good -- resolves symlinks), there is no validation that the resolved path is a reasonable server directory. The path is then embedded into a JSON config file and later executed via `spawnSync`. A malicious path could point to an attacker-controlled binary.

The only validation is `existsSync(resolvedServerPath)` and checking for `dist/index.js`. This is a reasonable heuristic but could be bypassed by an attacker who plants a malicious `dist/index.js`.

**Recommendation:**
- Consider validating the resolved path contains expected session-orchestrator files (e.g., `package.json` with the correct package name).
- Display the fully resolved path to the user and require confirmation before writing to config.

---

### SEC-004: Absolute Path Disclosure in Generated Files

**Severity:** LOW
**File:** `utils/mcp-setup-guide.ts` line 49, `utils/mcp-configure.ts` lines 77-89
**Category:** Information Disclosure

The MCP configuration embeds absolute filesystem paths into `.mcp.json` or `~/.claude.json`:

```typescript
args: [resolve(serverPath, 'dist', 'index.js')],
```

If `.mcp.json` is committed to version control, it exposes the developer's absolute filesystem path (e.g., `/Users/username/projects/session-orchestrator/dist/index.js`), leaking usernames and directory structure.

The code does print a warning for project-level config:
```typescript
console.warn('Note: Project-level config uses an absolute path that may not be portable across machines.');
```

This warning addresses portability but not the security implication.

**Recommendation:**
- Add `.mcp.json` to `.gitignore` during scaffolding, or at minimum warn the user not to commit it.
- Consider supporting relative paths or environment variable expansion in the config.

---

### SEC-005: TOCTOU Race in File Existence Checks

**Severity:** LOW
**File:** `utils/scaffold.ts` lines 49-76, `commands/init.ts` lines 42-43, 64-65
**Category:** TOCTOU Race Condition

Multiple locations follow a pattern of checking `existsSync(path)` then performing an operation on that path. For example in `scaffold.ts`:

```typescript
if (!overwrite && existsSync(destPath)) {  // Check
  result.skipped++;
} else {
  copyFileSync(srcPath, destPath);          // Use
}
```

And in `init.ts`:

```typescript
if (existsSync(agentPath)) {  // Check
  console.log(`  ${proposal.agentName}: already exists (skipped)`);
  return true;
}
// ... later ...
if (existsSync(agentPath)) {  // Check again after generation
```

Between the check and the use, another process could create or replace the file. In practice, this is a local CLI tool run by a single user, so exploitation requires a co-located attacker with precise timing -- making the real-world risk low.

**Recommendation:**
- Use `O_EXCL` / `O_CREAT` flags for atomic file creation where skipping existing files is the intent.
- For a CLI tool, this is acceptable risk but worth noting.

---

### SEC-006: No Integrity Verification of Scaffold Source

**Severity:** LOW
**File:** `utils/scaffold.ts` lines 12-30
**Category:** Supply Chain / Integrity

The `resolveScaffoldRoot` function locates the scaffold directory by checking two filesystem locations. There is no checksum or integrity verification of the scaffold files before they are copied into the user's project. If the scaffold directory is tampered with (e.g., via a compromised npm package or a local filesystem attack), malicious agent definitions, commands, or skills could be injected into every project initialized with this tool.

**Recommendation:**
- Consider adding a manifest file with checksums of scaffold files, verified at copy time.
- This is partially mitigated by npm's package integrity checks, but a post-install modification would bypass that.

---

### SEC-007: Generated Files Use Default (umask-inherited) Permissions

**Severity:** LOW
**File:** `utils/claude-md.ts` line 50, `utils/mcp-configure.ts` line 40, `utils/scaffold.ts` line 73
**Category:** Insecure File Permissions

`writeFileSync` and `copyFileSync` are used without explicit `mode` parameters. File permissions are inherited from the process umask. On most systems this results in `0644` (world-readable), which is fine for agent definitions but may be too permissive for MCP configuration files that could contain sensitive paths or future auth tokens.

The `~/.claude.json` global config file is particularly sensitive -- it may accumulate credentials or API keys over time.

**Recommendation:**
- For global config files (`~/.claude.json`), explicitly set permissions to `0600` (owner read/write only).
- For project-level files, `0644` is acceptable.

---

### SEC-008: Agent Name Passed to CLI Without Sanitization

**Severity:** LOW
**File:** `commands/init.ts` lines 49-51
**Category:** Input Validation

The `proposal.agentName` value is passed as part of a CLI argument to `spawnSync('claude', ...)`:

```typescript
const result = spawnSync('claude', [
  '-p',
  `/create-agent ${proposal.agentName}`,
  ...
]);
```

The `agentName` comes from the hardcoded `AGENT_MAP` in `agent-map.ts`, not from user input, so this is not directly exploitable. However, the pattern of interpolating values into CLI arguments without sanitization is fragile. If `AGENT_MAP` were ever extended to include user-supplied names, this would become a command injection vector.

**Recommendation:**
- Validate `agentName` matches an expected pattern (e.g., `/^[a-z0-9-]+$/`) before use.
- Since `spawnSync` uses array arguments (not a shell string), the risk is limited to Claude CLI argument interpretation, not OS-level command injection.

---

### SEC-009: Shell Invocation for CLI Detection

**Severity:** INFO
**File:** `commands/init.ts` line 33, `utils/preflight.ts` line 12
**Category:** Command Injection (Minimal Risk)

Both files use `execSync('command -v claude', { stdio: 'ignore' })` to detect the Claude CLI. Since the argument is a hardcoded string with no user input, this is safe. However, `execSync` invokes a shell, which is generally less safe than `spawnSync`. The `command -v` builtin is shell-specific.

**Recommendation:**
- Consider using `spawnSync('which', ['claude'])` or a PATH-scanning utility to avoid shell invocation entirely. This is a stylistic improvement, not a real vulnerability.

---

### SEC-010: Backup File Written Without Checking Existing Backup

**Severity:** INFO
**File:** `utils/mcp-configure.ts` lines 21-22
**Category:** Data Loss

When an existing MCP config file cannot be parsed, a `.bak` backup is created:

```typescript
writeFileSync(filePath + '.bak', readFileSync(filePath, 'utf-8'), 'utf-8');
```

If a `.bak` file already exists, it is silently overwritten, potentially destroying a previous backup.

**Recommendation:**
- Use a timestamped backup filename (e.g., `filePath + '.bak.' + Date.now()`).

---

## Security Summary

| ID | Severity | Category | File | Description |
|----|----------|----------|------|-------------|
| SEC-001 | HIGH | Command Injection | mcp-connectivity.ts | MCP config `command`/`args` passed directly to `spawnSync` |
| SEC-002 | MEDIUM | Symlink Attack | scaffold.ts | No symlink detection in recursive copy |
| SEC-003 | MEDIUM | Input Validation | mcp-configure.ts | User-supplied MCP path accepted without content validation |
| SEC-004 | LOW | Info Disclosure | mcp-setup-guide.ts, mcp-configure.ts | Absolute paths embedded in potentially committed config |
| SEC-005 | LOW | TOCTOU | scaffold.ts, init.ts | Check-then-act patterns in file operations |
| SEC-006 | LOW | Supply Chain | scaffold.ts | No integrity verification of scaffold files |
| SEC-007 | LOW | File Permissions | claude-md.ts, mcp-configure.ts | Global config files written with default permissions |
| SEC-008 | LOW | Input Validation | init.ts | Agent name interpolated into CLI args (from hardcoded map) |
| SEC-009 | INFO | Command Injection | init.ts, preflight.ts | Shell-based CLI detection with hardcoded string |
| SEC-010 | INFO | Data Loss | mcp-configure.ts | Backup file silently overwrites previous backup |

**Totals:** 0 CRITICAL, 1 HIGH, 2 MEDIUM, 4 LOW, 2 INFO

---

## Verdict: PASS_WITH_NOTES

The codebase demonstrates reasonable security practices for a developer CLI tool: it uses `spawnSync` with array arguments (avoiding shell injection in most cases), resolves symlinks with `realpathSync` for the MCP path, validates file existence before operations, and limits blast radius by operating only within the project directory and known config locations.

The HIGH finding (SEC-001) is noteworthy because it executes commands sourced from JSON config files without validation, but the attack requires prior write access to the user's config files, which implies the machine is already partially compromised. The MEDIUM findings around symlinks and path validation represent defense-in-depth gaps that should be addressed before a v1.0 release.

No credentials, tokens, or secrets are hardcoded or generated by any of the reviewed files. The tool does not make network requests. The primary attack surface is local filesystem manipulation.

**Recommended priority fixes:**
1. SEC-001: Add command allowlist validation in `mcp-connectivity.ts`
2. SEC-002: Add symlink detection in `copyDirRecursive`
3. SEC-007: Set restrictive permissions on `~/.claude.json`
