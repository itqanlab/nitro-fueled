# Security Review — TASK_2026_090

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Task:** Migrate init + run + status commands to Oclif
**Commit reviewed:** e07be02

---

## Scope

Files reviewed (per task File Scope):

- `apps/cli/src/base-command.ts`
- `apps/cli/src/commands/init.ts`
- `apps/cli/src/commands/run.ts`
- `apps/cli/src/commands/status.ts`

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 0     |
| SERIOUS  | 1     |
| MINOR    | 3     |

No blocking security issues. The Oclif migration itself does not introduce new attack surface — all user inputs flow through Oclif's flag/arg parser before reaching application logic. The one serious finding is a pre-existing unvalidated-data-to-prompt issue surfaced more clearly by the refactor context.

---

## Findings

---

### [SERIOUS] S-01: Unvalidated `agentName` passed into Claude `-p` prompt string

**File:** `apps/cli/src/commands/init.ts:49`
**Function:** `generateAgent`

```ts
const result = spawnSync('claude', [
  '-p',
  `/create-agent ${proposal.agentName}`,
  '--allowedTools', 'Read,Write,Glob,Grep,Edit',
], { ... });
```

`proposal.agentName` comes from `analyzeWorkspace()` which may perform AI-assisted stack analysis. The name is taken from workspace analysis output (either AI-generated or heuristic), but is never validated before being interpolated into the `-p` prompt string passed to Claude.

**Risk:** If `analyzeWorkspace()` returns a name containing a newline character (`\n`), shell-interpreted sequences, or a prompt injection payload (e.g., from a malicious `package.json` `name` field that feeds into AI analysis), it can alter the effective Claude prompt. While `spawnSync` is called without `shell: true` (preventing OS-level shell injection), the `-p` argument is a freeform string interpreted by Claude — meaning injected content can alter what command Claude executes.

**Attack vector:** A malicious project's `package.json`, workspace file, or source file name could contain a crafted string that the AI analysis propagates into `proposal.agentName`, injecting additional Claude slash commands or instructions.

**Recommendation:** Validate `agentName` against a safe-name pattern (e.g., `/^[a-z0-9][a-z0-9-]*$/`) before interpolation. Reject or sanitize names that do not match. This validation belongs immediately before the `spawnSync` call in `generateAgent`.

---

### [MINOR] M-01: Non-null assertions on array cells inside parse loop

**File:** `apps/cli/src/commands/status.ts:89–95`

```ts
workers.push({
  workerId: cells[0]!,
  taskId:   cells[1]!,
  workerType: cells[2]!,
  label:    cells[3]!,
  status:   cells[4]!,
  health:   cells[6]!,
});
```

The `cells.length >= 7` guard on line 87 makes all six accesses (indices 0–4 and 6) functionally safe. However, the non-null assertions are silent suppressors — if the guard condition were ever loosened or the column layout changed, the `!` would mask an `undefined` being stored as a real value without a type error at that point.

**Risk:** Low. No immediate exploitability, but fragile under future maintenance.

**Recommendation:** Replace `!` with explicit fallbacks: `cells[0] ?? ''`, etc. This eliminates the assertions while keeping the intent clear.

---

### [MINOR] M-02: Non-null assertion on `dashboardProcess` inside exit handler closure

**File:** `apps/cli/src/commands/run.ts:384–386`

```ts
process.on('exit', () => {
  if (dashboardProcess!.pid !== undefined) {
    try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
  }
});
```

`dashboardProcess` is declared `let dashboardProcess: ChildProcess | null = null` and written once before this handler is registered. The `!` non-null assertion suppresses the TypeScript null check inside the closure. TypeScript cannot track that the variable is guaranteed non-null at handler invocation time, so the `!` is required — but it means a future refactor that reassigns `dashboardProcess` to `null` after the handler is registered would silently crash.

**Risk:** Low. Current code is safe; fragile to maintenance changes.

**Recommendation:** Capture the value in a `const` before registering the handler:
```ts
const proc = dashboardProcess;
process.on('exit', () => {
  if (proc.pid !== undefined) {
    try { process.kill(proc.pid, 'SIGTERM'); } catch { /* already exited */ }
  }
});
```
This eliminates the assertion and makes the closure's captured reference explicit.

---

### [MINOR] M-03: Terminal escape sequence injection via unescaped file content to stdout

**Files:** `apps/cli/src/commands/status.ts:205–228`, `apps/cli/src/commands/run.ts:46–60`

Data read from local markdown files (`orchestrator-state.md`, `registry.md`, `plan.md`) is printed directly to the terminal via `console.log()` without stripping ANSI escape sequences. Fields at risk include: worker `label`, task `description`, plan `guidance`, `activePhase`, `activeMilestone`.

**Risk:** Low. An attacker who can write to the project's `task-tracking/` files (i.e., already has filesystem write access) could inject ANSI escape sequences that rewrite previously printed terminal output, spoof prompts, or overwrite terminal content. This is a terminal hijacking vector via escape injection. In practice this requires local filesystem access already, making it a low-severity issue for a developer CLI tool.

**Recommendation:** Sanitize output by stripping ANSI escape sequences (e.g., replace `/\x1b\[[0-9;]*m/g`) before passing to `console.log`. Alternatively, accept the risk as-in-scope for a local developer tool operating on trusted project files and document it.

---

## Files with No Findings

**`apps/cli/src/base-command.ts`** — No issues. Minimal pass-through overrides; no user input processed.

---

## Observations (Non-Findings)

- **Input validation is present and correct** in `run.ts` for `--task`, `--concurrency`, `--retries`, and `--interval` flags. Validated before use, validated with strict regex patterns. No bypass possible via Oclif's parsed flag values.
- **`taskId` format is validated** with `/^TASK_\d{4}_\d{3}$/` before being passed to `spawnOrchestrate`. No injection risk.
- **`spawn` is used without `shell: true`** in both `run.ts` (dashboard service) and via `spawnClaude` (supervisor/orchestrator). Arguments are arrays, not shell strings. OS-level command injection is not possible.
- **`spawnSync` in `init.ts`** also does not use `shell: true`. The `--allowedTools` restriction on the spawned Claude process is a good defensive measure limiting what the spawned agent can do.
- **`serverPath` in `init.ts`** is user-provided (flag or interactive prompt), passed to `configureMcp`. This is expected behavior — the user is providing their own MCP server path. No traversal risk beyond what the user already controls.
- **`process.cwd()` for all path resolution** — no user-controlled base path; appropriate for a CLI tool.
