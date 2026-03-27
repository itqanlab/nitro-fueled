# Security Review — TASK_2026_042

## Score: 7/10

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `baseUrl` and `defaultModel` accepted without validation; config deserialized with `as` cast and no schema check |
| Path Traversal           | PASS   | All paths derived from `process.cwd()` (not user input) via `path.resolve()` — no traversal risk |
| Secret Exposure          | FAIL   | Write-then-chmod race window leaves config file world-readable for a brief period; API key echoed in prompt display string |
| Injection (shell/prompt) | PASS   | Shell commands use array form or constant strings; all user-derived values passed to Claude prompts are regex-validated before use |
| Insecure Defaults        | FAIL   | `writeFileSync` uses default umask (typically 644) before `chmodSync` corrects it to 600 — the race window is the default |

---

## BLOCKING

### Issue 1: Write-then-chmod TOCTOU race — config file briefly world-readable

- **File**: `packages/cli/src/utils/provider-config.ts:59–65`
- **Problem**: `writeFileSync` is called first, creating the file with the process's default umask (typically 0644 — owner read/write, group/other read). `chmodSync` is called only afterward to restrict it to 0600. Between those two calls, the file exists on disk with the API key readable by any process running as the same group or as world-readable, depending on the umask.
- **Impact**: On multi-user systems or CI environments, any process that scans the filesystem between the write and the chmod can read the API key in plaintext.
- **Fix**: Create the file with restrictive permissions atomically. Use `writeFileSync(configPath, content, { encoding: 'utf8', mode: 0o600 })` — the `mode` option sets permissions at creation time, eliminating the race window entirely. The subsequent `chmodSync` call can then be removed.

---

## SERIOUS

### Issue 1: `baseUrl` reaches `fetch()` without URL validation — SSRF vector

- **File**: `packages/cli/src/utils/provider-config.ts:133`
- **Problem**: The `baseUrl` value read from `config.json` is concatenated directly into a URL string and passed to `fetch()` without any validation. There is no check that the URL scheme is `https`, that it points to an expected domain, or that it is well-formed.
- **Impact**: If the config file is modified by another process or tool, or if an attacker can influence the contents of `.nitro-fueled/config.json`, they can redirect GLM connection tests to any URL — including internal network services (SSRF). A `file://` scheme could also be attempted on some runtimes.
- **Fix**: Validate `baseUrl` before use. Parse it with `new URL(baseUrl)` inside a try/catch. Reject any URL whose `protocol` is not `https:`. Optionally, compare the hostname against a known-good allowlist (e.g., `api.z.ai`).

### Issue 2: Config file deserialized with type cast, no schema validation

- **File**: `packages/cli/src/utils/provider-config.ts:45`
- **Problem**: `JSON.parse(raw) as NitroFueledConfig` performs a TypeScript compile-time cast only. At runtime there is no shape check — any value (including a string, array, or object with unexpected extra fields) passes through. Values like `baseUrl`, `apiKey`, and `defaultModel` are consumed downstream without further validation.
- **Impact**: A malformed or adversarially crafted config file can cause unexpected behavior downstream. Combined with Issue 1 above, an unexpected `baseUrl` can reach `fetch()` silently. A non-string `apiKey` would produce a runtime error on `.startsWith('$')` in `resolveApiKey`, surfacing an unhandled exception rather than a clean error.
- **Fix**: Add runtime shape validation. A minimal guard — check `typeof parsed === 'object' && parsed !== null && 'providers' in parsed` — reduces the risk. A more complete fix uses a schema library (e.g., Zod) or manually validates each field before use.

### Issue 3: User-supplied `defaultModel` echoed without validation

- **File**: `packages/cli/src/commands/config.ts:94–95`
- **Problem**: The `defaultModel` value from the user's interactive prompt is interpolated directly into a `console.log` output and stored verbatim in the config file with no format check. There is no validation that it matches an expected format (e.g., `provider/model-name`).
- **Impact**: While `console.log` cannot produce terminal injection in modern terminals via simple strings, the unvalidated value is persisted to `config.json` and could propagate into downstream tool invocations (e.g., if opencode accepts it as a command argument). A very long or specially crafted model name could produce confusing output or errors in consuming code.
- **Fix**: Validate `defaultModel` against a simple pattern before accepting it, e.g., `/^[\w.-]+\/[\w.-]+$/`. Reject and re-prompt if the value does not match.

---

## MINOR

- **`dep-check.ts:13,59`**: `execSync` is called with a shell string (`'claude --version 2>/dev/null'`). This invokes the system shell. The binary names are hardcoded constants with no user input, so there is no injection risk today — but if these strings ever accept external input, the pattern becomes dangerous. Prefer `spawnSync('claude', ['--version'])` with `stdio: ['ignore', 'pipe', 'pipe']` to avoid shell invocation entirely. The `2>/dev/null` redirect is unnecessary when using `spawnSync` with `stdio` control.

- **`provider-config.ts:87`**: The `.gitignore` check uses `content.includes('.nitro-fueled/')`. This is correct for the exact string but would also match `.nitro-fueled/secrets/` or any line containing that substring. If someone has a more specific entry, the function would skip adding the bare directory entry. The check should match the full entry on a line boundary (e.g., use a regex `/^\.nitro-fueled\/$/m`).

- **`provider-config.ts:46–48`**: `readConfig` silently returns `null` on any parse error (JSON syntax errors, file read errors). The caller has no way to distinguish "file not found" from "file is corrupt." This masks config corruption — a partial write or disk error would silently fall through to default behavior. Consider distinguishing the two cases (return `null` for not-found, throw or return a typed error for parse failure).

- **`config.ts:49`**: The interactive prompt shows the current API key reference (`$ZAI_API_KEY` or the stored key) in the prompt string. If the stored value is an actual key (not an env var reference), it is printed in plaintext to the terminal as part of the default hint. This is a minor information disclosure to anyone with terminal access or scroll-back history.

- **`init.ts:44–46`**: `proposal.agentName` is interpolated into the Claude `-p` argument string: `` `/create-agent ${proposal.agentName}` ``. `agentName` is derived from internal stack detection, not raw user input, so the immediate risk is low. However, if the stack detection logic ever incorporates user-controlled values (e.g., package names from `package.json`), this becomes a prompt injection vector. Using a structured argument (e.g., separate flag) rather than string interpolation would eliminate the class entirely.

---

## Summary

The implementation handles the most critical concern — API key storage — mostly correctly: the config directory is gitignored, chmod 600 is applied, and keys are never logged or included in error messages. The shell execution calls use array form where it matters and validate all user-derived values before they reach Claude process arguments.

The BLOCKING issue is the write-then-chmod race on config file creation, which leaves the file world-readable for a brief window. This is a one-line fix (`mode: 0o600` in the `writeFileSync` options) and must be resolved before this code handles real API keys in production.

The two SERIOUS issues (unvalidated `baseUrl` reaching `fetch()`, and no runtime schema validation on config deserialization) are not immediately exploitable in the current threat model (the config file is user-owned), but they represent a class of risk that grows as the tool is adopted in shared or automated environments.

**Recommendation**: REVISE — address the BLOCKING write-then-chmod race and the two SERIOUS issues before shipping.
**Confidence**: HIGH
**Top Risk**: TOCTOU race between `writeFileSync` and `chmodSync` exposes the API key file with world-readable permissions for a brief window at creation time.
