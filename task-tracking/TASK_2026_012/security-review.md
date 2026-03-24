# Security Review: CLI Create Command

**File:** `packages/cli/src/commands/create.ts`
**Task:** TASK_2026_012
**Reviewer:** Security Reviewer
**Date:** 2026-03-24

---

## Summary

The `create.ts` file implements the `npx nitro-fueled create` command, which validates the workspace, checks for the Claude CLI, and spawns a Claude Code session with a constructed prompt. The file is compact (110 lines) and uses Node.js `spawn` and `execSync`. Overall the implementation follows secure patterns, with a few low-severity observations.

---

## Findings

### 1. Log Message Echoes Unsanitized User Input (LOW)

**Location:** Line 40
```ts
console.log(`Starting Claude session: claude -p "${prompt}"`);
```

**Description:** The `prompt` variable contains user-provided description text. While this only goes to stdout (not to a shell), the log line wraps it in double quotes, which could be visually misleading if the description itself contains quotes or escape sequences (e.g., ANSI terminal escape codes). A crafted description like `\x1b[2J` could clear the terminal or inject misleading colored output via log injection.

**Risk:** Terminal escape sequence injection in log output. Not exploitable for code execution, but could confuse operators or hide malicious activity in logs.

**Suggested Fix:** Either strip control characters from the description before logging, or remove the prompt echo from the log message entirely. At minimum, avoid wrapping in quotes that imply shell quoting:
```ts
console.log(`Starting Claude session with prompt length: ${prompt.length} chars`);
```

---

### 2. `execSync('command -v claude')` Usage (LOW)

**Location:** Lines 12-18
```ts
execSync('command -v claude', { stdio: 'ignore' });
```

**Description:** This invokes a shell to check whether `claude` is on PATH. The string is a hardcoded literal with no user input interpolated, so there is no command injection vector. However, `execSync` does invoke a full shell (`/bin/sh -c`), which means it is subject to the shell environment (aliases, PATH manipulation). If an attacker controls the `PATH` environment variable, they could place a malicious `claude` binary earlier in the path -- but that same attacker would also control the subsequent `spawn('claude', ...)` call, so this does not introduce additional risk beyond what already exists.

**Risk:** Negligible. No user input reaches the shell string.

**Suggested Fix:** No change required. For defense-in-depth, could use `execFileSync` with explicit path lookup, but this is not necessary given the threat model (local CLI tool).

---

### 3. `spawn()` with Array Arguments -- Safe Pattern (INFO)

**Location:** Lines 43-50
```ts
const child = spawn('claude', ['-p', prompt], { cwd, stdio: 'inherit' });
```

**Description:** Using `spawn` with an argument array (not a shell string) is the correct, safe pattern. The user-provided `prompt` is passed as a discrete argument element, so no shell interpretation occurs. There is no command injection risk here.

**Risk:** None.

---

### 4. Path Traversal in `isWorkspaceInitialized` (INFO)

**Location:** Lines 20-37
```ts
const claudeDir = resolve(cwd, '.claude');
const taskTrackingDir = resolve(cwd, 'task-tracking');
```

**Description:** The `cwd` is sourced from `process.cwd()` (line 90), which returns the OS-reported current working directory. It is not user-supplied via command-line arguments. The paths `.claude` and `task-tracking` are hardcoded relative directory names. `resolve()` normalizes any `..` sequences, but since neither component comes from user input, there is no path traversal risk. The function only calls `existsSync` (a read-only check), so even a manipulated path would not cause destructive behavior.

**Risk:** None.

---

### 5. Signal Handler Cleanup (INFO)

**Location:** Lines 52-67
```ts
process.on('SIGINT', forwardSignal);
process.on('SIGTERM', forwardSignal);

child.on('close', (code) => {
  process.off('SIGINT', forwardSignal);
  process.off('SIGTERM', forwardSignal);
  // ...
});
```

**Description:** Signal handlers are registered with named function references and removed in both the `close` and `error` handlers using `process.off()`. This is correct and avoids listener leaks. One minor edge case: if the child process emits both `error` and `close` (which can happen per Node.js docs), the handlers would be removed twice, but `process.off` is idempotent so this is harmless.

**Risk:** None.

---

### 6. Error Messages -- No Sensitive Information Disclosed (INFO)

**Location:** Lines 64, 73
```ts
console.error(`Claude session exited with code ${String(code ?? 'unknown')}`);
console.error(`Failed to start Claude session: ${err.message}`);
```

**Description:** Error messages report only the exit code (an integer) or the Node.js error message (e.g., "ENOENT"). No file paths, environment variables, tokens, or internal state are leaked. The `err.message` from `spawn` errors is safe to expose as it comes from Node.js internals (not from the child process's stderr, which is inherited directly to the terminal).

**Risk:** None.

---

### 7. No Prototype Pollution or Injection Vectors (INFO)

**Description:** The `descriptionParts` parameter is typed as `string[]` and comes from Commander's variadic argument parsing. It is joined with a space (line 104) and concatenated with a hardcoded command prefix (line 106). There is no `JSON.parse`, no `Object.assign` from user input, no `eval`, no dynamic `require`, and no template rendering. No prototype pollution or injection vectors exist.

**Risk:** None.

---

## Verdict: **PASS**

The implementation follows secure coding practices. The `spawn` call correctly uses array arguments to avoid shell injection. User input does not flow into any dangerous sinks. Signal handlers are properly cleaned up. The only actionable finding is the LOW-severity log injection concern (Finding 1), which is a minor hardening opportunity rather than a real vulnerability. No changes are required to ship this code.
