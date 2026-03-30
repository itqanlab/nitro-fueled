# Security Review — TASK_2026_110

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** `d3afd44 feat(cli): launcher-aware config schema + provider resolver engine (TASK_2026_110)`

## Scope

Files reviewed:
- `apps/cli/src/utils/provider-config.ts`
- `apps/cli/src/commands/config.ts`
- `apps/cli/src/utils/provider-flow.ts`
- `apps/cli/src/utils/provider-status.ts`

---

## Summary

Overall the implementation follows good security practices: atomic config writes with restrictive permissions (`0o600`/`0o700`), `spawnSync` with array arguments (no shell injection), HTTPS enforcement in the GLM connection test, and allowlist-based routing input validation. Two medium-severity issues require attention before merge.

---

## Findings

### [MEDIUM] Prototype pollution vector in `runUnloadMode` via `--unload` flag

**File:** `apps/cli/src/commands/config.ts:64`

```ts
if (providerArg in config.providers) {
  delete config.providers[providerArg];
```

The `in` operator traverses the prototype chain. If a user passes `--unload __proto__` or `--unload constructor`, the condition evaluates to `true` (these keys exist on every object's prototype). `delete config.providers['__proto__']` is then called. In modern JavaScript engines, deleting `__proto__` via bracket notation is a no-op (it is a special accessor property, not an own property), so full prototype pollution does not occur — but the branch executes, `changed` is set to `true`, and `writeConfig(config)` is called with an unmodified config. This silently passes for malformed input.

The `for...in` loop on `config.routing` immediately above is also affected: if a routing slot were set to `__proto__`, the `value === providerArg` comparison could match unexpectedly.

**Fix pattern:** Replace `in` with `Object.prototype.hasOwnProperty.call(config.providers, providerArg)` and validate `providerArg` against a known allowlist before use.

---

### [MEDIUM] SSRF via `testGlmConnection` — no private/loopback address restriction

**File:** `apps/cli/src/utils/provider-config.ts:299-337`

```ts
let url: URL;
try {
  url = new URL(`${baseUrl}/v1/models`);
} catch {
  return { ok: false, error: 'Invalid base URL' };
}
if (url.protocol !== 'https:') {
  return { ok: false, error: 'Base URL must use HTTPS' };
}

const response = await fetch(url.toString(), { ... });
```

The code enforces HTTPS but does not restrict the hostname. A `baseUrl` value of `https://169.254.169.254/` (AWS metadata endpoint), `https://localhost/`, or `https://10.0.0.1/` would pass the protocol check and trigger an outbound request to internal network addresses (Server-Side Request Forgery). The `baseUrl` originates from the old-format config file read during migration (`migrateOldConfig` calls `writeConfig`, but the old config's `baseUrl` is never validated before reaching this function via other callers).

**Note:** `testGlmConnection` is retained from the pre-task codebase and is not directly invoked in the new detection wizard. However it remains exported and callable. The risk exists if callers pass externally-sourced `baseUrl` values.

**Fix pattern:** After URL parsing, validate that `url.hostname` is not a loopback, link-local, or RFC-1918 address before calling `fetch`.

---

### [LOW] Silent swallow of rename error in `migrateOldConfig`

**File:** `apps/cli/src/utils/provider-config.ts:262-266`

```ts
try {
  renameSync(projectPath, migratedPath);
} catch {
  // If rename fails, just continue
}
```

If the rename fails (e.g., cross-device rename, permissions error), execution continues silently and `writeConfig(newConfig)` is still called. The old config is not backed up, but the global config is overwritten with migration results. The user receives no warning. Additionally, on the next run, `readConfig` will re-detect the old-format file (since it was not renamed) and run migration again, overwriting the global config a second time.

**Fix pattern:** Log a `console.warn` on rename failure so the user knows the backup did not succeed.

---

### [LOW] Unsafe `as` cast on migration input

**File:** `apps/cli/src/utils/provider-config.ts:246`

```ts
function migrateOldConfig(projectPath: string, raw: unknown): void {
  if (!isRecord(raw)) return;
  const old = raw as { providers: OldProviders };
```

`isRecord` only confirms `raw` is a non-null object. The cast to `{ providers: OldProviders }` bypasses type checking — `raw.providers` could be any shape. Runtime safety is preserved because all subsequent accesses use optional chaining (`old.providers.glm?.enabled`), but the cast is a code smell and the review-lessons convention explicitly prohibits `as` assertions.

**Fix pattern:** Use a proper type guard that narrows `raw.providers` before the cast, or use optional chaining directly on `(raw as Record<string, unknown>).providers`.

---

### [LOW] No `maxBuffer` limit on `spawnSync` calls

**File:** `apps/cli/src/utils/provider-flow.ts:74-96`

```ts
const result = spawnSync('opencode', ['auth', 'list'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 10_000,
});
```

The default `maxBuffer` for `spawnSync` is 1 MB. A rogue or misbehaving `opencode` binary could return output larger than this, causing `spawnSync` to throw an uncaught `ENOBUFS` error that propagates out of `detectOpenCode` and crashes the wizard. The same applies to `detectClaude` and `detectCodex` calls.

**Fix pattern:** Add `maxBuffer: 1024 * 1024` (1 MB) explicitly and wrap each `spawnSync` call in a try/catch to degrade gracefully on buffer overflow.

---

### [INFO] Environment variable enumeration via `resolveApiKey`

**File:** `apps/cli/src/utils/provider-config.ts:281-287`

```ts
export function resolveApiKey(value: string): string {
  if (value.startsWith('$')) {
    const envVarName = value.slice(1);
    return process.env[envVarName] ?? '';
  }
  return value;
}
```

`resolveApiKey` reads arbitrary environment variable names from the config file. If an attacker could write to `~/.nitro-fueled/config.json`, they could probe for the existence or content of sensitive env vars (e.g., `$AWS_SECRET_ACCESS_KEY`) by observing which values cause `testGlmConnection` to return a non-empty-API-key error. In the current new config schema, there is no field that holds an API key string of this form — `resolveApiKey` is only called from `testGlmConnection`. The risk is low given that config file write access already implies full user context compromise, but worth noting as the function stays exported.

---

## Positive Observations

- **No shell injection**: all `spawnSync` calls use array arguments with `stdio: ['ignore', 'pipe', 'pipe']` — shell metacharacters in binary names cannot be injected.
- **Atomic config write**: `writeConfig` uses tmp-file + `renameSync` with `mode: 0o600` and parent dir `mode: 0o700` — correct pattern.
- **HTTPS enforcement** in `testGlmConnection` via `url.protocol !== 'https:'` check.
- **Allowlist validation** in `promptRoutingAssignment`: user input checked against `availableProviders` and `Object.keys(DEFAULT_PROVIDERS)` before assignment.
- **Error message truncation**: parse errors and connection errors are truncated to 200 chars before display, preventing excessive verbosity.
- **Env var presence-only check**: `ZAI_API_KEY` and `OPENAI_API_KEY` are checked for non-empty presence only; values are never stored in the config or logged.
- **Strong type guards**: `isRecord`, `isValidNewConfig`, `isOldFormatConfig` all use `unknown` + type narrowing, consistent with review-lesson requirements.

---

## Issue Summary

| ID | Severity | File | Line | Description |
|----|----------|------|------|-------------|
| 1  | MEDIUM   | config.ts | 64 | Prototype pollution risk via `in` operator on user-supplied `--unload` arg |
| 2  | MEDIUM   | provider-config.ts | 305-314 | SSRF — no private/loopback address check in `testGlmConnection` |
| 3  | LOW      | provider-config.ts | 262-266 | Silent rename failure in migration loses backup without warning |
| 4  | LOW      | provider-config.ts | 246 | Unsafe `as` cast after `isRecord` check in `migrateOldConfig` |
| 5  | LOW      | provider-flow.ts | 74-96 | No `maxBuffer` guard on `spawnSync` calls |
| 6  | INFO     | provider-config.ts | 281-287 | Exported `resolveApiKey` reads arbitrary env vars from config-supplied names |
