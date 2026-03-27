# Security Review — TASK_2026_031

## Score: 9/10

## Findings

### [MINOR] stderr from external processes echoed directly to console

- **File**: `packages/cli/src/commands/init.ts:56-57`, `init.ts:247-249`, `init.ts:259-261`
- **Problem**: `stderr` captured from `spawnSync` calls (`claude`, `git add`, `git commit`) is printed verbatim via `console.error`. In normal operation this is harmless. If a git hook or the claude CLI writes sensitive content (e.g., a token, a credential path) to stderr, that content is forwarded to the terminal without filtering.
- **Impact**: Low probability, low impact in a local developer CLI. An attacker who can pre-position a malicious git hook in the target repository could cause arbitrary text to appear in output, but cannot escalate beyond what is already reachable by running git hooks.
- **Fix**: Cap stderr echoing at a reasonable length (e.g., first 500 characters) and avoid forwarding it in non-verbose mode. This is a defense-in-depth hardening, not a required change to approve.

---

## Approved

**Shell injection prevention — correctly implemented.**
`commitScaffold` uses `spawnSync('git', ['add', '--', ...files], ...)` (array form, no shell). No shell string concatenation occurs anywhere in the new code. This is the pattern mandated by the `security.md` lesson from TASK_2026_029, and it is correctly applied.

**Commit message is hardcoded.**
The git commit message `'chore: initialize nitro-fueled orchestration'` is a string literal with no user-controlled interpolation. No injection surface exists in the commit step.

**File path list is internally sourced.**
The `files` array passed to `git add` consists exclusively of absolute paths built by `path.join(dest, entry.name)` inside `copyDirRecursive`, where `dest` is always resolved from `process.cwd()`. No user-supplied path strings enter the list.

**Symlink traversal is blocked.**
`copyDirRecursive` explicitly skips symbolic links (`entry.isSymbolicLink()` check at line 66 of scaffold.ts), preventing a scenario where a symlink inside the scaffold source redirects a file write or git-add to an unintended location.

**Git repository guard present.**
`commitScaffold` checks `existsSync(resolve(cwd, '.git'))` before calling git commands, preventing confusing failures in non-git directories without leaking information.

**No credentials or secrets in source.**
No API keys, tokens, or hardcoded passwords were found in either changed file.

**No `exec` or shell-string execution.**
Neither file uses `child_process.exec`, `execSync` with string templates, `eval`, or `new Function`.
