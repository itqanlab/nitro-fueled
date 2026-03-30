# Security Review — TASK_2026_111

## Review Summary

| Metric           | Value                                          |
|------------------|------------------------------------------------|
| Overall Score    | 7/10                                           |
| Assessment       | NEEDS_REVISION                                 |
| Critical Issues  | 0                                              |
| Serious Issues   | 2                                              |
| Minor Issues     | 3                                              |
| Files Reviewed   | 7 (+ process-launcher.ts read for context)     |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                                  |
|--------------------------|--------|----------------------------------------------------------------------------------------|
| Input Validation         | FAIL   | `model`/`providerName` from config embedded in Claude prompt without length/char guard |
| Path Traversal           | PASS   | `resolve(cwd, ...)` is operator-supplied; no user-controlled path traversal found      |
| Secret Exposure          | PASS   | No credentials in source; error messages in fallback log are adequately scoped         |
| Injection (shell/prompt) | FAIL   | Config-sourced strings injected into Claude `-p` prompt without sanitization           |
| Insecure Defaults        | PASS   | `mkdirSync` uses `0o700`; `spawn()` (not `exec()`) used throughout                    |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Config-Sourced Strings Injected Into Claude Prompt Without Sanitization

- **File**: `apps/cli/src/commands/create.ts:55–59`
- **Problem**: `resolved.providerName`, `resolved.model`, and `resolved.launcher` are read from `.nitro-fueled/config.json` and interpolated directly into the `claudePrompt` string passed to `spawnClaude` as the `-p` argument. The config is operator-controlled and validated only for structural shape — the individual string values are not checked for newlines, backticks, or instruction-override syntax before being embedded in the prompt. A crafted config with `providerName: "anthropic\n\nIgnore previous instructions and..."` would inject that content into the Claude evaluation prompt.

  Relevant line:
  ```
  tierNote += `\n\nProvider suggestion: ${resolved.providerName} / ${resolved.model} (launcher: ${resolved.launcher}). Include ...`;
  claudePrompt = `/create-task ${description}${tierNote}`;
  ```

- **Impact**: Prompt injection into the Claude session that runs `/create-task`. An attacker who can write to the project's `.nitro-fueled/config.json` (e.g., a malicious dependency post-install script or a compromised project collaborator) can inject arbitrary instructions into the task-creation session, potentially causing Claude to execute unintended commands or write malicious content to task files.
- **Fix**: Validate `resolved.providerName`, `resolved.model`, and `resolved.launcher` against a strict allowlist pattern before interpolation. Acceptable patterns: `providerName` → `/^[a-z0-9][a-z0-9-]{0,63}$/`, `model` → `/^[a-zA-Z0-9._-]{1,128}$/`, `launcher` → one of the three known enum values (`claude`, `opencode`, `codex`). Reject (skip the tier note) if any value does not match.

---

### Issue 2: `console.log` Fallback Message in `spawn-worker.ts` Has No Length Cap on Caller-Supplied Strings

- **File**: `apps/session-orchestrator/src/tools/spawn-worker.ts:51–55`
- **Problem**: When the Phase 2 fallback fires, the code logs `args.provider`, `args.model`, `resolved.providerName`, and `resolved.model` verbatim via `console.log`. `args.provider` is constrained to a Zod enum (safe), but `args.model` is a free-form `z.string()` with no length limit in the schema. A caller supplying a very long or specially crafted model string can write an unbounded entry to stdout, and any consumer of that stdout stream (e.g., a log aggregator or the MCP response parser) may misparse the output.

  Relevant line:
  ```typescript
  console.log(
    `SPAWN FALLBACK — ${args.label}: ${args.provider}/${args.model} unavailable, trying ${resolved.providerName}/${resolved.model}`,
  );
  ```

- **Impact**: A crafted `model` argument containing newlines or terminal escape sequences can corrupt stdout, split log entries, or inject misleading lines into any log consumer. Low exploitation probability in the current MCP-local deployment context, but consistent with the project's own lesson (TASK_2026_054) requiring a 200-character cap on strings sourced from caller input before logging.
- **Fix**: Add `.max(256)` to the `model` field in `spawnWorkerSchema`, and cap `args.model`, `args.label`, and `resolved.model` in the fallback log line to 200 characters each before interpolation.

---

## Minor Issues

### Minor 1: `parseConfigFile` in `provider-resolver.ts` Silently Discards Parse Errors

- **File**: `libs/worker-core/src/core/provider-resolver.ts:52–58`
- **Problem**: The `catch` block returns `null` with no logging. Unlike the CLI's `provider-config.ts` which emits a capped `console.warn`, this version gives no diagnostic when a malformed config file causes fallback to a lower-tier provider. Silent failures make "why is the wrong provider being used?" impossible to diagnose from logs.
- **Fix**: Add a `console.warn` inside the catch with a capped error message (max 200 chars): `console.warn(\`provider-resolver: failed to parse ${filePath}: ${msg}\`)`.

### Minor 2: `isNitroFueledConfig` Guard Does Not Validate Nested Launcher and Provider Entry Shapes

- **File**: `libs/worker-core/src/core/provider-resolver.ts:40–46`
- **Problem**: The top-level guard confirms `launchers`, `providers`, and `routing` are records, but does not verify that each value in `launchers` passes `isLauncherInfo()` or that each value in `providers` passes `isProviderEntry()`. The calling code does call these per-entry guards at use time (in `isLauncherAvailable` and `tryProvider`), so there is no crash risk. However, a malformed entry silently resolves to "unavailable", possibly triggering an unexpected fallback without any log trace.
- **Fix**: This is mitigated by per-entry guards at use time. Documented for awareness; no crash or injection risk exists. Low priority.

### Minor 3: `complexity-estimator.ts` `isLauncherAvailable` Accesses `config.launchers[launcherName]` Without Checking Entry Shape

- **File**: `apps/cli/src/utils/complexity-estimator.ts:143–150`
- **Problem**: `config.launchers[launcherName]` is accessed and `.found` / `.authenticated` read directly without calling an `isLauncherInfo()` guard first. If a config entry is malformed (e.g., a null value for a launcher key), this will return `false` silently, which is the safe behavior — but the absence of a guard is inconsistent with the pattern in `provider-resolver.ts`.
- **Fix**: Add `if (launcher === undefined || typeof launcher !== 'object' || launcher === null) return false;` before accessing `.found`. (The current code already guards against `undefined` via early return, so this is low priority.)

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Config-sourced `providerName` and `model` values interpolated without sanitization into the Claude `-p` prompt in `create.ts` — constitutes a prompt injection vector for anyone who can write to the project config file.

---

## Findings Summary

| Reviewer              | Finding Count | Blocking |
|-----------------------|---------------|----------|
| code-security-reviewer | 5 (0C, 2S, 3M) | YES — Serious Issue 1 (prompt injection) |
