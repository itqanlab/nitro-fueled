# Security Review — TASK_2026_068

## Verdict
APPROVED

## Score
9/10

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 9/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 0                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 3 (+ provider-config.ts out-of-scope reference read) |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | `--unload` validated against `UNLOADABLE_PROVIDERS` whitelist at config.ts:73. Model string validated against `MODEL_FORMAT_RE` regex at provider-flow.ts:204. |
| Path Traversal           | PASS   | Config path constructed from `resolve(cwd, '.nitro-fueled', 'config.json')` — fixed suffix, no user-controlled segment. |
| Secret Exposure          | PASS   | API keys stored in config file, never logged. Keys sent via `x-api-key` header, not URL. `resolveApiKey` expands env-var references at runtime. |
| Injection (shell/prompt) | PASS   | `spawnSync('npm', ['i', '-g', 'opencode'])` uses a fully static argument array — no variable content, no shell interpolation. |
| Insecure Defaults        | PASS   | `writeConfig` passes `{ mode: 0o600 }` plus a follow-up `chmodSync` to enforce owner-only permissions. HTTPS enforced in `testGlmConnection` before any network call. |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

No serious issues found.

---

## Minor Issues

### Minor 1: GLM error string from network exception echoed verbatim to terminal

- **File**: `packages/cli/src/utils/provider-config.ts:181` (out-of-scope reference — noted only)
  Called from in-scope `provider-flow.ts:53` and `provider-status.ts:41`
- **Problem**: `testGlmConnection` catches any exception and returns `err.message` as the `error` field. This value is then printed directly to the console via `console.log(\` failed${reason}\`)`. A network error from a malicious or misconfigured server could include a long error string (e.g., a full stack trace or a crafted message) in the TCP reset payload, which would be printed verbatim.
- **Impact**: Low. Terminal output only; no file write. Could expose internal path fragments from Node's TLS stack on failure (e.g., certificate path). Not exploitable remotely.
- **Fix**: Cap the echoed error message at a safe length (e.g., 200 characters) before printing, or truncate with a trailing `…`. This also applies to the `detail` field rendered in `printProviderStatusTable`.

### Minor 2: `mkdirSync` for config directory uses no explicit mode

- **File**: `packages/cli/src/utils/provider-config.ts:78` (out-of-scope reference — noted only)
  Invoked via `writeConfig` which is called from in-scope `config.ts:90`, `config.ts:146`
- **Problem**: `mkdirSync(dir, { recursive: true })` creates `.nitro-fueled/` with the process umask-derived default (typically 0o755 on Linux/macOS), making the directory world-listable. The file itself is correctly 0o600, but the directory's listing permission reveals that a config file exists.
- **Impact**: Very low on a personal developer workstation. On a shared machine, any local user can enumerate `~/.nitro-fueled/` and confirm the presence of a config file (though they cannot read it).
- **Fix**: Add `mode: 0o700` to the `mkdirSync` call: `mkdirSync(dir, { recursive: true, mode: 0o700 })`. This matches the existing lesson documented in security.md (TASK_2026_059).

---

## Detailed Findings Notes

**`--unload` whitelist (config.ts:22-78)**: The `UNLOADABLE_PROVIDERS` constant is a `readonly` tuple `['glm', 'opencode']`. The user-supplied string is `.toLowerCase()`-normalized before the `.includes()` check. This correctly prevents arbitrary strings from reaching `delete config.providers[provider]`. Passing `__proto__` or `constructor` would be rejected by the whitelist check.

**`spawnSync` call (provider-flow.ts:184)**: Arguments are fully static: `spawnSync('npm', ['i', '-g', 'opencode'])`. The only user-controlled decision here is a Y/n prompt; the actual command is hardcoded. This is a correct, safe pattern per the existing Shell Injection lesson (TASK_2026_029).

**API key never in URL (provider-config.ts:162-163)**: Verified. The key is sent as `x-api-key` header. The `url.toString()` value passed to `fetch` is constructed from the `baseUrl` only, never includes the key.

**HTTPS enforcement (provider-config.ts:157-159)**: `url.protocol !== 'https:'` check fires before the fetch call, returning an error instead of proceeding over plain HTTP. This correctly covers both the interactive reconfigure path and the `--test` flag path.

**Config file permissions (provider-config.ts:82, 86)**: `writeFileSync` is called with `{ mode: 0o600 }`. A follow-up `chmodSync` corrects permissions on pre-existing files. The dual approach is the pattern documented in the security lessons (TASK_2026_059). The minor concern is the directory itself (Minor 2 above).

**No API keys in `console.log` / `console.error`**: Searched all three in-scope files. Log output includes provider names, status labels, model names, and generic error messages. No raw key values are printed.
