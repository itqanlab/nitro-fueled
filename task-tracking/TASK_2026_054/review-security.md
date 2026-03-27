# Security Review — TASK_2026_054

## Score: 8/10

## Issues Found

- [provider-config.ts:62] `err.message` from a JSON parse failure is passed verbatim to `console.warn` with no character cap. A crafted `config.json` whose malformed content triggers a long parse-error string (e.g., extremely long token) could produce unbounded terminal output. The existing security lesson (TASK_2026_068) mandates capping error strings at 200 characters before printing. Severity: **LOW** — local developer CLI, attacker would need to plant a malformed config file.

- [provider-config.ts:45–47] `isValidConfig` validates only the top-level shape (`providers` is a record). Nested provider fields (`glm.apiKey`, `glm.baseUrl`, `opencode.authMethod`, etc.) are not runtime-checked. A config file with `"apiKey": 42` would pass `isValidConfig`, then `resolveApiKey(glm.apiKey)` would call `String.prototype.startsWith` on a number, throwing a `TypeError` at runtime rather than returning a clean validation error. Severity: **LOW** — config is user-controlled and the crash is non-exploitable, but it produces an unhelpful uncaught exception rather than the documented warn-and-return-null behavior.

- [provider-status.ts:52, 56] `opencode.defaultModel` is interpolated directly into the `detail` field and printed to stdout via `console.log` with no length cap or character set check. If a user or downstream script writes an unusually long or terminal-escape-code-containing model name into `config.json`, it is echoed verbatim. Severity: **LOW** — local CLI, model name is user-supplied, but the existing security lesson pattern (TASK_2026_068) recommends capping detail strings sourced from config.

- [provider-flow.ts:222–224] `MODEL_FORMAT_RE` validation emits a warning but saves the model name unconditionally. This means an invalid model name string is persisted to config and later echoed in status output (see above). The pattern is informational rather than enforced. Severity: **LOW** — the model name is only used as a config string label, not passed to a shell or used in a file path at this layer.

## Passed Checks

- **No hardcoded secrets or API keys.** All credential references use `$ENV_VAR_NAME` indirection via `resolveApiKey`, which is the correct pattern.

- **No shell injection.** `installOpenCode` at provider-flow.ts:182 uses `spawnSync('npm', ['i', '-g', 'opencode'], ...)` with an argument array — no shell interpolation, no metacharacter risk.

- **Correct file permissions.** `mkdirSync` uses `mode: 0o700` (line 78) and `writeFileSync` uses `mode: 0o600` (line 82), matching the security lesson from TASK_2026_068. The atomic write via temp file + `renameSync` is a good pattern.

- **Error strings from network calls are capped.** `testGlmConnection` (provider-config.ts:184) caps `err.message` at 200 characters before returning it — consistent with TASK_2026_068 lesson.

- **Correct authorization logic for subscription users.** `checkProviderConfig` (provider-config.ts:133) gates the API key check on `opencode.authMethod !== 'subscription'`. `getProviderStatus` (provider-status.ts:51–52) returns `connected` for subscription users without any key check. Subscription users are not incorrectly blocked by key validation in either path.

- **No path traversal risk.** `getConfigPath` uses `resolve(cwd, '.nitro-fueled', 'config.json')` with a fixed subpath — user input does not reach any dynamic path construction.

- **No prompt injection vectors.** Auth method choice (`authAnswer`) is matched only against exact literals `'1'` and `'2'` with a safe fallback. No user-supplied string is interpolated into an LLM prompt.

- **Optional/undefined values handled safely.** `opencode.apiKey ?? ''` at provider-config.ts:134 and provider-status.ts:54 correctly handles the case where `apiKey` is absent (subscription mode). No crashes from missing auth data.

- **`resolveApiKey` env var lookup is safe.** `process.env[envVarName]` with an arbitrary key will return `undefined` (treated as empty string) for non-existent names; it does not traverse the file system or execute code.
