# Logic Review — TASK_2026_042

## Score: 5/10

## BLOCKING

### B1 — `checkProviderConfig` only validates GLM; OpenCode credential gap is silent
`provider-config.ts:106–121` — `checkProviderConfig` checks whether the GLM API key resolves
to a non-empty string but performs zero validation for the OpenCode provider. If a user enables
OpenCode in config (`enabled: true`) and later uninstalls the opencode binary or the binary is
missing at run time, `npx nitro-fueled run` says "Ready to run" and proceeds — the supervisor
starts and will silently fail every OpenCode-routed task. The task says the pre-flight check
must "fail fast if a required provider is misconfigured." This is an enabled provider with no
binary check at all.

Fix: add a check that if `config.providers.opencode?.enabled === true`, `checkOpencodeBinary()`
returns `found: true`; push an issue if not.

---

### B2 — `--check` mode reports providers as "configured" without testing connectivity
`config.ts:99–131` — In `runCheckMode`, the GLM and OpenCode status is read directly from the
config file. The task spec shows `--check` output as "connected (GLM-5, GLM-4.7, GLM-4.5-Air
available)" — implying a live connection test. The implementation just prints whatever is in
the JSON, so a stale or invalid API key shows `✓ GLM — configured` with no actual verification.
Users depend on `--check` to know if things will work; a false positive breaks that trust and
means `--check` cannot substitute for a real pre-flight.

Fix: call `testGlmConnection` inside `runCheckMode` and reflect the actual live result.

---

### B3 — Env var references on the OpenCode side are entirely absent
The task spec (AC: "API keys support env var references (`$ZAI_API_KEY`)") and the config
schema in the task.md show that the opencode provider stores an OpenAI API key. The
`resolveApiKey` helper exists and is used for GLM, but nowhere in the codebase is it used for
the OpenCode provider's API key — because `OpenCodeProviderConfig` has no `apiKey` field at
all. The config schema in `provider-config.ts:20–23` only stores `defaultModel`.

The task's acceptance criterion says "API keys support env var references" — and the task.md
JSON example shows OpenCode stores no API key in `config.json` because opencode CLI reads
`OPENAI_API_KEY` from the environment directly. But then `--check` mode has no way to verify
whether that env var is actually set, and the pre-flight check ignores it. The session
orchestrator integration description says it "reads default model" — so where does the OpenAI
key come from when a worker spawns? This flow is unaddressed in all five files.

---

### B4 — `configureOpenCodeProvider` has no mechanism to test the OpenCode connection
The task AC says "OpenCode setup: prompts for OpenAI API key, tests connection (via opencode
CLI)". The implementation at `config.ts:73–97` prompts only for a default model and skips the
connection test entirely. There is no `testOpencodeConnection` function anywhere. The user gets
`✓ OpenCode configured` with zero verification that it actually works.

---

## SERIOUS

### S1 — `readConfig` silently swallows malformed JSON, returns `null`, hides corruption
`provider-config.ts:43–48` — If `.nitro-fueled/config.json` exists but is corrupt or
truncated (e.g. interrupted write), `readConfig` catches the parse error and returns `null`.
This is the same return value as "file does not exist." Callers cannot distinguish corruption
from absence. In `runProvidersPhase`, a `null` config is treated as a fresh start — it then
builds a new config and overwrites whatever corrupt content was there without warning the user.
Silent data destruction.

Fix: differentiate "file missing" from "file unreadable/invalid" and surface an error to the
user in the latter case.

---

### S2 — Race between `writeFileSync` and `chmodSync` leaves config world-readable briefly
`provider-config.ts:59–65` — `writeFileSync` creates the file with the process umask (typically
0o644 — owner+group read, world read). The subsequent `chmodSync(configPath, 0o600)` narrows
it. Between the two calls there is a window where the API key is on disk at 0o644. On a shared
machine or CI runner this matters. The fix is to write with `O_WRONLY | O_CREAT | O_TRUNC` and
mode 0o600 in the same call, or write to a temp file and rename.

---

### S3 — `claude auth status` command is unverified; the check is fragile
`dep-check.ts:27–55` — The login check runs `claude auth status` and treats exit code 0 as
"logged in." The version-string parsing regex (`/subscription[:\s]+(\S+)/i`) is speculative;
if the Claude CLI does not expose `auth status` (it may be `claude status` or something else),
the command returns a non-zero exit code and the check reports "not logged in" even if the user
is logged in. The `installHint` then tells them to run `claude auth login` unnecessarily. This
is a correctness risk: the correct command needs to be verified against the actual Claude CLI.

---

### S4 — `runProvidersPhase` calls `runDependencyChecks()` a second time inside the providers flow
`config.ts:146–147` — Dependencies are already checked and printed at lines 195–198 before
`runProvidersPhase` is called (in the non-`--providers` path). Then `runProvidersPhase` calls
`runDependencyChecks()` again internally just to resolve the `opencodeFound` flag. This runs
`execSync('opencode --version')` and `spawnSync('claude', ['auth', 'status'])` a second time,
adding 10+ seconds of subprocess overhead on a slow machine. The opencode result from the first
check should be passed in, not re-derived.

---

### S5 — `--reset` deletes config but does not remove the gitignore entry or the `.nitro-fueled/` directory
`config.ts:178–187` — `config --reset` removes `config.json` but leaves the (now-empty)
`.nitro-fueled/` directory and the `.gitignore` entry intact. If the user then runs `config`
again, `ensureGitignore` correctly deduplicates the entry — that part is fine. But the
directory remains, `readConfig` still returns `null` (file gone), and the user experience is
clean enough. The real gap: if the user deletes `.nitro-fueled/` manually and removes the
gitignore entry themselves, then `--reset` silently does nothing (`existsSync(configPath)` is
false) and prints "No config file found" — that is correct, but the command does not convey
whether a full reset (including directory cleanup) happened. Not catastrophic, but misleading.

---

## MINOR

### M1 — `testGlmConnection` picks `models[0]` from the `/v1/models` endpoint as the display name
`provider-config.ts:142` — The Anthropic-compatible `/v1/models` endpoint may return models in
arbitrary order. Reporting `models[0]` as "available" is random — the user sees whichever
model comes first, not necessarily the configured GLM-4.7 sonnet model. The output should
confirm the expected model (`glm-4.7`) is in the list, not just show whatever the API returns
first.

---

### M2 — `configureGlmProvider` defaults the prompt placeholder to `$ZAI_API_KEY` even when the user has already saved a literal key
`config.ts:48` — `const defaultKey = existing?.apiKey ?? '$ZAI_API_KEY'`. If the user
previously saved their literal API key (`zai_sk_...`), that literal key will appear as the
default in the prompt. This leaks the key to the terminal in plaintext during the prompt
display. The default should be masked (e.g., `zai_sk_***`) or the prompt should say "[keep
existing]" without showing the value.

---

### M3 — `prompt()` creates a new `readline.Interface` per call; if stdin is piped (CI/non-interactive), subsequent `rl.question` calls may throw or hang
`config.ts:22–30` — Creating and closing a readline interface per call is fine in a TTY.
In a piped or non-TTY context (automated test, piped `echo y |` invocation), closing and
reopening `process.stdin` via a new `createInterface` each time can cause the stream to end
prematurely, causing later prompts to receive empty strings silently. There is no TTY detection
or `--yes` flag support for the `config` command (unlike `init`, which has `-y`).

---

### M4 — `runCheckMode` exit code is set via `process.exitCode = 1` but the process may still exit 0 if something catches the exit
`config.ts:130` — Minor: setting `process.exitCode` rather than calling `process.exit(1)` is
the correct pattern for async cleanup. But callers that wrap the CLI (scripts, CI pipelines)
need to know this is the intended pattern. No concern in isolation, noted for CI integration
documentation.

---

### M5 — OpenCode model validation accepts any string without format checking
`config.ts:93–94` — The user can type anything as the default model string. There is no
validation that the value is a known `opencode` model format (e.g., `openai/gpt-4.1-mini`).
A typo would silently save and not be caught until a worker tries to spawn.

---

## Acceptance Criteria Coverage

| AC | Status | Notes |
|----|--------|-------|
| `npx nitro-fueled config` runs interactive provider setup | PARTIAL | Claude and GLM work; OpenCode skips API key and connection test (B4) |
| Dependency check validates claude, opencode, node on PATH | COMPLETE | All three checked in `dep-check.ts` |
| Claude login status verified | PARTIAL | `claude auth status` used, but command may not exist in all CLI versions (S3) |
| GLM setup: prompts for Z.AI API key, tests connection | COMPLETE | Implemented correctly |
| OpenCode setup: prompts for OpenAI API key, tests connection | MISSING | No API key prompt; no connection test (B4) |
| Config stored in `.nitro-fueled/config.json` (gitignored) | COMPLETE | `writeConfig` + `ensureGitignore` both called |
| `--check` flag validates without changing anything | PARTIAL | Does not perform live connection test (B2) |
| Auto-install offer for missing optional deps (opencode) | COMPLETE | `spawnSync('npm', ['i', '-g', 'opencode'])` path implemented |
| Session orchestrator reads config at spawn time | MISSING | No code in these files reads config at spawn time; `checkProviderConfig` checks keys but does not build env vars or pass config to spawn |
| API keys support env var references (`$ZAI_API_KEY`) | PARTIAL | GLM only; OpenCode has no API key field at all (B3) |
| `.nitro-fueled/` added to `.gitignore` by init | COMPLETE | `ensureGitignore` called in `init.ts` step 5b |
| Pre-flight check runs before auto-pilot starts | PARTIAL | Only checks GLM key; OpenCode binary gap (B1); `--check` does not test live (B2) |

---

## Summary

The happy path for GLM is solid: prompt, test, save, gitignore. The structural work —
`readConfig`/`writeConfig`, `resolveApiKey`, `ensureGitignore`, `checkProviderConfig` wired
into `run.ts` — is correct and clean.

The implementation falls apart at OpenCode. The task AC explicitly requires prompting for an
OpenAI API key and testing the connection; neither happens. The pre-flight check ignores whether
the opencode binary is available at run time. The `--check` mode prints config file contents
rather than doing the live verification the task spec illustrates. The session-orchestrator
integration (reading config at spawn time to build env vars for worker sessions) is completely
absent from all five files — there is no spawn-time config reader.

These are not polish issues. Three of the four blocking issues correspond directly to named
acceptance criteria that are unimplemented. The score reflects that the foundation is there and
the GLM path is correct, but roughly half the feature is missing.
