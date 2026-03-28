# Security Review — TASK_2026_089

**Reviewer:** nitro-code-security-reviewer
**Commit:** `e07be02` — `feat(cli): migrate apps/cli from Commander to @oclif/core`
**Date:** 2026-03-28
**Status:** COMPLETE

---

## Summary

The Commander → Oclif migration is architecturally sound and introduces no new remote-code-execution or authentication bypass vulnerabilities. The most significant security risks are pre-existing in the business logic (spawning Claude with `--dangerously-skip-permissions`, plaintext credential storage) and are now surfaced by the migration into the Oclif class pattern where they are easier to see. One new concern is introduced: the `run-cli` Nx target in `project.json` uses unquoted shell arg substitution that is potentially injectable.

Utility files (`apps/cli/src/utils/` — 23 files) were confirmed unchanged in commit `e07be02`. No utility files appear in the git diff. No security review of utility file internals is warranted under the scope boundary.

---

## Findings

### SEC-01 — Shell Injection via `run-cli` Nx Target (MEDIUM)

**File:** `apps/cli/project.json:29`
**Severity:** Medium
**Category:** Command Injection (OWASP A03:2021)

```json
"run-cli": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node dist/index.js {args.command}",
    "cwd": "apps/cli"
  }
}
```

Nx's `run-commands` executor constructs the shell command by substituting `{args.command}` at build time with whatever the caller passes via `--args`. Because `run-commands` uses a shell (not a raw `execFile`), an attacker or malicious automation can pass:

```
nx run @itqanlab/nitro-fueled:run-cli --args="--command='status; rm -rf /'"
```

and the substituted command string becomes:

```
node dist/index.js status; rm -rf /
```

which a shell will execute both halves of.

**Impact:** Local code execution for any process that can invoke Nx targets (CI scripts, pre-commit hooks, developer workstations).
**Exploitability:** Low in isolation (requires local access or CI runner compromise), but worth hardening.
**Recommendation:** Quote the substitution (`"node dist/index.js '{args.command}'"`) and validate allowed values, or use the `args` array form of `run-commands` instead of string interpolation. This target appears to be a developer convenience shortcut, not a published entry point, but shell injection issues in build tooling can propagate into CI.

---

### SEC-02 — `--dangerously-skip-permissions` Spawned with User-Influenced Prompt Content (MEDIUM)

**File:** `apps/cli/src/commands/run.ts:194-209`
**Severity:** Medium
**Category:** Privilege Escalation / Untrusted Input in Privileged Context

```typescript
// run.ts:194-200
spawnClaude({
  cwd,
  args: ['--dangerously-skip-permissions', '-p', autoPilotPrompt],
  label: 'Supervisor',
});

// run.ts:203-209
spawnClaude({
  cwd,
  args: ['--dangerously-skip-permissions', '-p', `/orchestrate ${taskId}`],
  label: 'Orchestrator',
});
```

Both `spawnSupervisor()` and `spawnOrchestrate()` invoke Claude with `--dangerously-skip-permissions`, which disables all tool-call approval prompts. The `taskId` is well-validated (`/^TASK_\d{4}_\d{3}$/` at line 285) so the argument itself cannot be injected. However:

- The `/orchestrate ${taskId}` prompt triggers Claude to read the task's `task.md` file, which is user-controlled content in the repository. If the task file contains adversarial instructions (prompt injection), Claude will act on them with full, uninhibited tool access.
- The `/auto-pilot` prompt similarly gives the Supervisor Claude uninhibited access to the entire workspace.

**Impact:** If a task file is tampered with (e.g., in a supply chain attack, a compromised PR, or a malicious collaborator), the resulting Claude session can read, write, delete, or exfiltrate arbitrary files in the working directory without any approval gate.
**Recommendation:** This is a known architectural trade-off of the Supervisor design. Document the trust boundary explicitly: the `--dangerously-skip-permissions` flag must only be used in workspaces where all task files are trusted content. Consider adding a warning to the user before spawning with this flag, or providing a `--require-approval` mode.

---

### SEC-03 — Plaintext API Key Storage (MEDIUM)

**File:** `apps/cli/src/commands/config.ts:145-153`
**Severity:** Medium
**Category:** Sensitive Data Exposure (OWASP A02:2021)

```typescript
// config.ts:145-153
try {
  writeConfig(cwd, config);
} catch (err: unknown) {
  ...
}
ensureGitignore(cwd);
```

The `config` object written by `writeConfig()` may contain GLM or OpenCode provider API keys (set via `runGlmFirstTimeMenu()` / `runOpenCodeFirstTimeMenu()`). These keys are persisted to `.nitro-fueled/config.json` in plaintext JSON with no encryption or OS-level secret store integration.

`ensureGitignore(cwd)` is called after `writeConfig()`, meaning there is a brief window where the file exists but is not yet gitignored. More importantly, `ensureGitignore()` only guards against `git add` — it does not prevent:
- The file being included in zip/tar archives sent to support
- Other users on the same machine reading the file (world-readable by default on many systems)
- Backup tools copying it off-machine

**Impact:** API key leak if a developer shares their project directory, runs backup software, or operates on a shared machine.
**Recommendation:** At minimum, set file permissions to `0600` when writing the config file (owner read/write only). Ideally integrate with OS keychain APIs. Flag clearly in user-facing output that the file contains credentials.

---

### SEC-04 — ANSI Terminal Injection in `status.ts` (LOW)

**File:** `apps/cli/src/commands/status.ts:48, 112`
**Severity:** Low
**Category:** Output Injection

```typescript
// parseActiveWorkers — content read from orchestrator-state.md
content = readFileSync(statePath, 'utf-8');
// ... parsed and pushed into WorkerEntry fields ...
console.log(`  ${w.taskId} | ${w.workerType} Worker | ${w.health} | ${w.label}`);

// parsePlan — content read from plan.md
content = readFileSync(planPath, 'utf-8').replace(/\r\n/g, '\n');
// ... parsed and displayed via console.log() ...
console.log(`Active Phase: ${plan.activePhase}`);
```

File content from `orchestrator-state.md` and `plan.md` is read and printed directly to the terminal without stripping ANSI escape sequences. A maliciously crafted state file (e.g., written by a compromised worker session or an attacker who gains write access to the `task-tracking/` directory) could inject ANSI escape sequences to:
- Overwrite or hide terminal output
- Inject fake prompts
- Manipulate terminal window title, clipboard (via OSC 52), or terminal state

**Impact:** Terminal hijacking on the developer's workstation if the task-tracking files are writable by untrusted parties.
**Exploitability:** Low in the typical use case (single developer, local filesystem), but relevant in shared CI environments or when `task-tracking/` is stored in a shared location.
**Recommendation:** Strip or escape ANSI control characters from data read out of these files before printing. A simple approach is to remove characters matching `/\x1b\[[0-9;]*[A-Za-z]/g` and other OSC sequences before passing to `console.log`.

---

### SEC-05 — Silent Error Suppression in `getCurrentChecksum()` (LOW)

**File:** `apps/cli/src/commands/update.ts:33-39`
**Severity:** Low
**Category:** Error Handling

```typescript
function getCurrentChecksum(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return computeChecksum(filePath);
  } catch {
    return null;  // ← silent catch, no logging
  }
}
```

When `computeChecksum()` throws (e.g., EPERM on a file the user cannot read), the function silently returns `null`. The call site at line 81 compares this to `manifestChecksum` (a hash string). A `null !== hash` comparison evaluates to `true` (not equal), so the file falls into the "modified by user — skip" branch (line 85-86), which is the safer default: the file is not overwritten.

However, the silent failure means a legitimate update will be silently skipped for a file the user did not modify — they get an incorrect outcome with no diagnostic output to explain why.

**Impact:** Incorrect update behavior (missed file update) with no user-visible error.
**Recommendation:** Add `console.error(`Warning: could not checksum ${filePath}: ${String(err)}`)` inside the catch block, consistent with the pattern used elsewhere in `update.ts` (e.g., line 113).

---

### SEC-06 — Floating Dependency Version for `@oclif/core` (LOW / INFO)

**File:** `apps/cli/package.json:47`
**Severity:** Low
**Category:** Supply Chain Risk (OWASP A06:2021)

```json
"@oclif/core": "^4.10.3"
```

The caret range allows automatic installation of any `4.x.y` release where `x >= 10` or `y` is any patch. A compromised `@oclif/core` minor or patch release would be automatically used by anyone running `npm install` fresh.

**Impact:** Supply chain compromise of `@oclif/core` would affect all users of `nitro-fueled` at their next clean install.
**Recommendation:** Consider using an exact version or a lockfile-pinned version for CLI tool dependencies. At minimum, enable `npm audit` in CI and verify `package-lock.json` is committed. For the published package itself, the lockfile is not included by npm, so consumers are fully exposed to any `4.x.x` compromise.

---

### SEC-07 — `as Record<string, unknown>` Type Assertion in `dashboard.ts` (INFO)

**File:** `apps/cli/src/commands/dashboard.ts:26`
**Severity:** Info (code-style violation with minor security implication)
**Category:** Type Safety

```typescript
const body = await resp.json() as Record<string, unknown>;
```

This uses a type assertion (`as`) which the project conventions explicitly prohibit. Beyond the style violation, the `as` cast trusts that the response is a `Record<string, unknown>` without runtime validation. If the `/health` endpoint returns something unexpected (e.g., `null`, an array, or a string), subsequent property access (`body.service`, `body.status`) would either silently return `undefined` or throw.

**Actual impact:** Minimal — `checkLegacyHealthOnPort()` wraps all access in `try { ... } catch { return false }` and the function is only used for backward compatibility with older dashboard-service builds.
**Recommendation:** Replace the `as` cast with a proper type guard:
```typescript
const body: unknown = await resp.json();
if (typeof body !== 'object' || body === null) return false;
const rec = body as Record<string, unknown>; // still a style violation — use type guard
return rec['service'] === 'nitro-fueled-dashboard' || rec['status'] === 'ok';
```
Or use a real runtime check without any `as`.

---

## Scope: Utility Files

23 utility files in `apps/cli/src/utils/` confirmed present and not modified in commit `e07be02`. No changes to review.

---

## Findings Table

| ID     | File               | Line(s)    | Severity | Category                    |
|--------|--------------------|------------|----------|-----------------------------|
| SEC-01 | project.json       | 29         | MEDIUM   | Command Injection           |
| SEC-02 | commands/run.ts    | 194–209    | MEDIUM   | Privilege Escalation        |
| SEC-03 | commands/config.ts | 145–153    | MEDIUM   | Sensitive Data Exposure     |
| SEC-04 | commands/status.ts | 48, 112    | LOW      | ANSI Terminal Injection     |
| SEC-05 | commands/update.ts | 33–39      | LOW      | Silent Error Suppression    |
| SEC-06 | package.json       | 47         | LOW      | Supply Chain / Dependency   |
| SEC-07 | commands/dashboard.ts | 26      | INFO     | Type Safety / Style         |

---

## What Was NOT Found

- No SQL injection (no database access in scope)
- No XSS (CLI tool, no HTML rendering)
- No path traversal: `update.ts` correctly guards against path escape with `startsWith(cwdNorm)` where `cwdNorm = resolve(cwd) + sep` — the trailing separator prevents the prefix-match false negative
- No secrets hardcoded in source files
- No unsafe `eval()` or `new Function()` usage
- No argument injection in `spawnSync` / `spawn` calls: all use array form, not shell strings
- `taskId` in single-task mode is fully validated before use (`/^TASK_\d{4}_\d{3}$/`)
- `--task` shorthand validated before expansion (`/^\d{1,3}$/`)
- `--concurrency`, `--interval`, `--retries` validated before passing to Claude
- `--unload` provider name validated against allowlist before config mutation
- Port value validated as integer in `0–65535` range before use
