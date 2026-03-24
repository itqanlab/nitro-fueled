# Code Logic Review - TASK_2026_012 (CLI create Command)

## Summary

| Metric              | Value           |
|---------------------|-----------------|
| Overall Score       | 6/10            |
| Assessment          | PASS_WITH_NOTES |
| Critical Issues     | 0               |
| Serious Issues      | 2               |
| Minor Issues        | 3               |
| Failure Modes Found | 4               |

The `create` command satisfies all five acceptance criteria from the task spec. The happy path works correctly: it checks workspace initialization, checks Claude CLI availability, constructs the right prompt for both `/plan` and `/create-task` modes, and spawns a Claude session. Help text with usage examples is present.

However, the implementation has two serious structural issues (duplicated utility code, and a `command -v` check that is not portable to Windows) and several minor gaps around edge cases.

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| `npx nitro-fueled create` starts a Planner session | COMPLETE | Spawns `claude -p "/plan"` |
| Description text passed as arguments to Planner | COMPLETE | Variadic `[description...]` joined with spaces |
| `--quick` flag uses `/create-task` instead | COMPLETE | Switches prompt prefix to `/create-task` |
| Pre-flight check: verify workspace is initialized | COMPLETE | Checks `.claude/` and `task-tracking/` dirs |
| Clear help text showing usage examples | COMPLETE | `addHelpText('after', ...)` with four examples |

---

## Findings

### SERIOUS-1: Duplicated `isClaudeAvailable` and workspace-check logic

**File:** `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/create.ts` lines 11-37

**Description:** `create.ts` contains its own private copies of `isClaudeAvailable()` and workspace-directory checks that are nearly identical to the code in `packages/cli/src/utils/preflight.ts` (lines 10-17 and 29-39). The `run.ts` command already delegates to `preflightChecks()` in the shared utility, but `create.ts` re-implements both checks locally.

This creates a maintenance hazard: if the workspace-initialized definition changes (e.g., a new required directory or file is added), it must be updated in two places. It also means the Claude-availability error message wording can drift between commands.

**Suggested fix:** Extract the workspace-initialized check and `isClaudeAvailable` into shared utilities (or reuse the existing `preflight.ts` exports). `create` does not need the registry/MCP portions of `preflightChecks`, so a smaller shared function (or making the existing helpers exported) is appropriate. For example:

```typescript
// In preflight.ts - export the two helpers
export function isClaudeAvailable(): boolean { ... }
export function isWorkspaceInitialized(cwd: string): boolean { ... }

// In create.ts - import and use them
import { isClaudeAvailable, isWorkspaceInitialized } from '../utils/preflight.js';
```

---

### SERIOUS-2: `command -v claude` is not portable to Windows

**File:** `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/create.ts` line 13 (and `preflight.ts` line 12)

**Description:** `execSync('command -v claude', { stdio: 'ignore' })` is a shell builtin that works on macOS/Linux but fails on Windows (cmd.exe / PowerShell). Since this is a CLI tool distributed via npm (`npx nitro-fueled`), Windows users will hit this. The check will throw, causing `isClaudeAvailable` to return `false` even if `claude` is installed.

Note: this same issue exists in `preflight.ts`, so it affects `run` too, but it was introduced here as a copy-paste.

**Suggested fix:** Use `which` from the `which` npm package, or use a cross-platform approach:

```typescript
import { execSync } from 'node:child_process';

function isClaudeAvailable(): boolean {
  try {
    execSync(process.platform === 'win32' ? 'where claude' : 'command -v claude', {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}
```

---

### MINOR-1: `spawnClaudeSession` is duplicated between `create.ts` and `run.ts`

**File:** `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/create.ts` lines 39-76

**Description:** The spawn-with-signal-forwarding pattern in `spawnClaudeSession` (create.ts) is structurally identical to `spawnSupervisor` (run.ts lines 140-180). The only differences are: (a) `run.ts` passes `--dangerously-skip-permissions` and (b) the log label. This is a reasonable candidate for a shared `spawnClaude(cwd, args, label)` utility.

Not blocking, but worth noting for maintainability: any bug fix to signal handling or exit-code logic must be applied in both places.

**Suggested fix:** Extract a shared `spawnClaude(cwd: string, args: string[], label: string): void` into a utility module.

---

### MINOR-2: No handling of quoted descriptions with special characters

**File:** `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/create.ts` line 104

**Description:** The description is joined with a single space and embedded directly into the `-p` prompt string. If a user provides description text containing characters that are meaningful to the shell or to Claude's prompt parsing (e.g., newlines via `$'...'`, backticks, or very long strings), they pass through unfiltered.

In practice, since `spawn` uses argv (not a shell), the shell-injection risk is zero. But the log line on line 40 (`console.log(..."${prompt}"...)`) could display misleadingly if the prompt contains quotes or newlines.

This is low-risk but worth being aware of.

---

### MINOR-3: `create` does not use `--dangerously-skip-permissions` unlike `run`

**File:** `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/create.ts` line 44

**Description:** `run.ts` spawns Claude with `--dangerously-skip-permissions` (line 149), while `create.ts` does not. This is likely intentional -- Planner and create-task are interactive, user-facing sessions where permission prompts are appropriate, while the Supervisor runs autonomously.

However, this design decision is not documented anywhere. A future maintainer might "fix" this inconsistency and break the intended UX.

**Suggested fix:** Add a brief comment explaining why `create` intentionally omits `--dangerously-skip-permissions`.

---

## Failure Mode Analysis

### Failure Mode 1: Silent success on spawn failure race

**Trigger:** `child.on('error')` fires but `child.on('close')` never fires (e.g., `claude` binary found but immediately crashes with EACCES).
**Symptoms:** User sees "Failed to start Claude session" error but CLI exits with code 1, which is correct. However, if both `error` and `close` fire (which Node.js can do), the error message prints twice and signal listeners are removed twice (harmless but noisy).
**Impact:** Low -- cosmetic double error message.
**Current Handling:** Both handlers set `process.exitCode = 1` and remove signal listeners.
**Recommendation:** Track a `handled` boolean or use `child.on('exit')` instead of relying on both events independently.

### Failure Mode 2: SIGINT during pre-flight leaves no cleanup needed (good)

**Trigger:** User presses Ctrl+C before `spawnClaudeSession` is called.
**Symptoms:** Process exits normally. No child process exists yet, so no cleanup is needed.
**Impact:** None.
**Current Handling:** Correct -- signal handlers are only registered after spawn.

### Failure Mode 3: Race between spawn and immediate signal

**Trigger:** User presses Ctrl+C in the microseconds between `spawn()` (line 43) and `process.on('SIGINT', forwardSignal)` (line 56).
**Symptoms:** The default SIGINT handler kills the parent process. The child process (Claude) becomes orphaned and continues running in the background.
**Impact:** Low probability, but the child process would linger until it finishes or the user manually kills it.
**Recommendation:** Register signal handlers before spawning, or use `{ detached: false }` (which is already the default) -- the OS will typically clean up children when the parent exits, but it is not guaranteed.

### Failure Mode 4: `process.cwd()` throws if working directory was deleted

**Trigger:** User's current directory is deleted between CLI invocation and the `process.cwd()` call (extremely unlikely).
**Symptoms:** Uncaught exception, stack trace to user.
**Impact:** Negligible probability.
**Current Handling:** None, same as all other commands.

---

## Data Flow Analysis

```
User invokes: npx nitro-fueled create [--quick] [description...]
  |
  v
commander parses argv -> descriptionParts: string[], opts: { quick: boolean }
  |
  v
isWorkspaceInitialized(cwd) -> checks .claude/ and task-tracking/ exist
  |  GAP: Does not check registry.md (but create doesn't need it)
  |  GAP: Duplicated from preflight.ts
  v
isClaudeAvailable() -> execSync('command -v claude')
  |  GAP: Not portable to Windows
  v
Build prompt: "/plan <description>" or "/create-task <description>"
  |
  v
spawn('claude', ['-p', prompt]) with stdio: 'inherit'
  |  Signal forwarding: SIGINT, SIGTERM
  |  Exit code propagation on close
  v
Claude interactive session runs in foreground
```

---

## Integration with CLI Entry Point

**File:** `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/index.ts` line 8 and line 23

The `create` command is properly imported and registered:
- `import { registerCreateCommand } from './commands/create.js';` (line 8)
- `registerCreateCommand(program);` (line 23)

No issues found with registration.

---

## Comparison with Sibling Commands

| Aspect | `run.ts` | `status.ts` | `create.ts` |
|--------|----------|-------------|-------------|
| Uses shared preflight | Yes (`preflightChecks`) | No (own logic) | No (own logic) |
| Claude CLI check | Via preflight | N/A | Own copy |
| Workspace check | Via preflight | Own logic | Own copy |
| Signal forwarding | Yes | N/A | Yes (identical pattern) |
| Error on spawn failure | Yes | N/A | Yes |
| Exit code propagation | Yes | N/A | Yes |

`create.ts` and `status.ts` both bypass the shared preflight utility. `create.ts` has a stronger reason (it doesn't need registry parsing or MCP config), but the duplication is still a maintenance concern.

---

## Verdict

**Recommendation:** PASS_WITH_NOTES

**Confidence:** HIGH

**Rationale:** All five acceptance criteria are met. The command is properly registered, the spawn logic handles signals and errors correctly, the prompt construction logic is correct for both modes, and the help text is clear. The code is functional and complete with no stubs.

The two serious findings (code duplication and Windows portability) are real maintainability and compatibility concerns but do not block the feature from working correctly on macOS/Linux, which appears to be the current target platform. They should be addressed in a follow-up cleanup pass.

**Top Risk:** The duplicated `isClaudeAvailable` / workspace-check logic will lead to behavior drift between `create` and `run` when preflight requirements change.
