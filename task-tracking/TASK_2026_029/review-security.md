# Security Review — TASK_2026_029

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 9/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 0                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 2                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | `cwd` is `process.cwd()` — not user-supplied. `scaffoldRoot` is derived from compiled module path only. |
| Path Traversal           | PASS   | All `resolve()` calls use fixed path suffixes appended to trusted roots. No user-controlled path segments. |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys in either file. |
| Injection (shell/prompt) | PASS   | `spawnSync` uses array arguments (no shell). Tag content from master file flows only into markdown output, not eval/exec. |
| Insecure Defaults        | PASS   | `mkdirSync` uses `{ recursive: true }` only for `.claude/` subdirectory at a fixed path. No permissive defaults found. |

## Critical Issues

No critical issues found.

## Serious Issues

No serious issues found.

## Minor Issues

### Minor 1: `as` type assertion on `JSON.parse` result without runtime type guard

- **File**: `packages/cli/src/utils/anti-patterns.ts:79`
- **Problem**: `JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }` uses a TypeScript `as` cast after `JSON.parse`. If `package.json` contains unexpected shapes (e.g., `dependencies` is a number, not an object), the spread `{ ...(pkg.dependencies ?? {}) }` would produce an incorrect result or throw at runtime, not at parse time.
- **Impact**: A crafted `package.json` in the target project with a non-object `dependencies` field (e.g., `"dependencies": 42`) could cause `detectDatabase` to throw an unhandled exception. The outer `try/catch` on line 77 catches this and returns `false`, so no crash propagates — but the detection result is silently incorrect rather than reported.
- **Fix**: Replace the `as` cast with an `unknown` cast and validate the shape with a type guard, or at minimum add a check `typeof pkg.dependencies === 'object' && pkg.dependencies !== null` before spreading.

---

### Minor 2: `stderr` from `spawnSync` concatenated directly into `console.error`

- **File**: `packages/cli/src/commands/init.ts:55`
- **Problem**: `result.stderr?.toString().trim()` is appended to a `console.error` log message without any sanitization. If the Claude CLI process writes sensitive tokens or environment variables to stderr (e.g., in error diagnostics), those values are printed to the terminal.
- **Impact**: Low probability in normal operation — the Claude CLI process is trusted. If a misconfigured environment causes secrets to leak via stderr, they appear in init output. Not exploitable by an external actor but represents a credential hygiene gap.
- **Fix**: Log stderr only at a debug verbosity level or redact it behind a `--verbose` flag, rather than always printing it on failure.

---

## Detailed Security Analysis

### Path Traversal — Full Trace

`cwd` originates at `init.ts:260` as `process.cwd()` — the OS-reported working directory of the running process. It is never modified by user input after this point.

All file paths derived from `cwd` in `anti-patterns.ts` use `resolve(cwd, <fixed string>)`:
- `resolve(cwd, manifest)` — `manifest` values are string literals from the `DB_MANIFESTS` constant array (lines 41–51).
- `resolve(cwd, 'package.json')` — fixed suffix.
- `resolve(cwd, '.claude')` — fixed suffix.
- `resolve(claudeDir, 'anti-patterns.md')` — fixed suffix appended to the already-fixed `claudeDir`.

`scaffoldRoot` is derived exclusively from `CURRENT_FILE` (the compiled module's own path) via relative traversal in `resolveScaffoldRoot`. No user input reaches this value. The master file path `resolve(scaffoldRoot, '.claude', 'anti-patterns-master.md')` is therefore a package-internal path.

No path traversal surface exists.

### Content Injection — Master File Analysis

The `anti-patterns-master.md` is a static package file, not user-supplied. Its content goes through `filterMasterByTags` which:
1. Splits on newlines.
2. Matches `<!-- tags: ... -->` comments via a bounded regex.
3. Accumulates body lines per section.
4. Joins matched section bodies with double newlines.

The output is written to disk as markdown. At no point is any content from the master file passed to `eval`, `exec`, `spawnSync`, or a template engine. The injection surface is limited to content quality of the output `.md` file — a concern for prompt injection into agents that read the file, not OS-level injection.

Tag values extracted from `<!-- tags: ... -->` comments are used only as Set keys for `.has()` lookup. Even if a master file contained a tag name with special characters, those characters would be inert as dictionary keys.

### `spawnSync` Shell Injection Analysis

`init.ts:43–51` calls:
```
spawnSync('claude', ['-p', `/create-agent ${proposal.agentName}`, '--allowedTools', 'Read,Write,Glob,Grep,Edit'], { cwd, stdio: ... })
```

`spawnSync` passes arguments as an array directly to `execve` — no shell invocation, no metacharacter interpretation. Even if `proposal.agentName` contained `;`, `&&`, `|`, backticks, or `$()`, those characters would be passed literally as part of the string argument to the Claude process. This is the correct pattern for avoiding shell injection.

`proposal.agentName` is derived from `proposeAgents(stacks)` → `detectStack(cwd)` → reading manifest files (package.json, tsconfig.json, etc.) from disk. This is a local read, not a network-supplied value, and the agentName is constructed from STACK_TO_TAGS keys — controlled string literals in the codebase.

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: No significant risks found. The two minor issues are both defense-in-depth concerns with no direct exploitability: one is a silent fallback on malformed package.json (caught by the outer try/catch), and the other is a credential hygiene gap in stderr logging that requires the Claude CLI itself to misbehave.
