# Security Review — TASK_2026_011

## Summary

The status command implementation is a **read-only reporting tool** that parses local Markdown files and prints summaries to stdout. The attack surface is narrow: it reads three fixed-path files relative to `process.cwd()` and outputs formatted text to the console. No user-supplied arguments influence file paths, no data is written, and no external network calls are made.

Overall the code is well-structured from a security perspective. The strict regex patterns in the registry parser act as implicit input validation. A few minor observations are noted below but nothing rises to blocking or major severity.

## Findings

### [MINOR] No symbolic link or file-type check before reading files
- File: `packages/cli/src/utils/registry.ts:29-33`, `packages/cli/src/commands/status.ts:41-46`, `status.ts:101-106`
- Issue: The code uses `existsSync` + `readFileSync` on three hardcoded relative paths (`task-tracking/registry.md`, `task-tracking/orchestrator-state.md`, `task-tracking/plan.md`). If an attacker can plant a symlink at one of these paths pointing to a sensitive file (e.g., `/etc/shadow`), the content would be read and partially displayed. However, exploitation requires the attacker to already have write access to the project directory, which means they already have broader access. The strict regex parsing also means most non-Markdown content would simply be silently ignored and never displayed.
- Suggestion: Acceptable risk given the threat model (local CLI tool, attacker needs local write access). If hardening is desired in the future, use `lstatSync` to reject symlinks or use `realpathSync` to verify the resolved path stays within the project directory.

### [MINOR] Unbounded file read into memory
- File: `packages/cli/src/utils/registry.ts:33`, `packages/cli/src/commands/status.ts:46,106`
- Issue: `readFileSync` reads the entire file into memory with no size limit. A maliciously large `registry.md` or `plan.md` file could cause memory exhaustion (OOM). Again, this requires local write access to the project.
- Suggestion: Acceptable for a CLI tool operating on local project files. If hardening is desired, check `statSync().size` before reading and reject files above a reasonable threshold (e.g., 10 MB).

### [NIT] Parsed Markdown content displayed without sanitization
- File: `packages/cli/src/commands/status.ts:197-198,206-209,268`
- Issue: Values parsed from Markdown files (worker labels, phase names, guidance text, task descriptions) are printed directly to `console.log`. If the terminal supports escape sequences, a crafted value could inject ANSI escape codes to manipulate terminal output (terminal escape injection). This is a very low-severity concern for a local development CLI.
- Suggestion: No action required. If the tool is ever used in CI/log-aggregation pipelines where terminal output is rendered in a web UI, consider stripping ANSI escape sequences from parsed values.

## What Was Checked

- **File path traversal**: All file paths are constructed with `resolve(cwd, <hardcoded-relative-path>)`. No user-supplied input influences path construction. The `cwd` comes from `process.cwd()`, not from CLI arguments. No traversal risk.
- **Input validation**: The registry parser uses a strict regex (`/^\|\s*(TASK_\d{4}_\d{3})\s*\|...$/`) that only matches well-formed table rows. Status values are validated against a whitelist (`VALID_STATUSES`). This effectively rejects malformed or injected content.
- **Injection risks**: No shell commands are spawned, no SQL/NoSQL queries are made, no template rendering occurs. Output goes to `console.log` only. No injection vector.
- **Information disclosure**: The tool displays task IDs, statuses, descriptions, worker info, and plan phases -- all project-internal data. No credentials, tokens, or environment variables are read or displayed.
- **Unsafe file operations**: All operations are read-only (`existsSync`, `readFileSync`). No files are created, modified, or deleted.
- **Denial of service**: Minor concern with unbounded file reads (noted above), but acceptable for a local CLI tool.

## Verdict

**PASS** -- No blocking or major security issues found. The implementation follows good practices: hardcoded file paths, strict regex parsing, status whitelist validation, and read-only file operations. The minor findings are acceptable given the threat model of a local development CLI tool.
