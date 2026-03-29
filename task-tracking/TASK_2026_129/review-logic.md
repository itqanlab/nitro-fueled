# Logic Review — TASK_2026_129

## Score: 7/10

## Acceptance Criteria Check

- [x] AC1: The `--continue` parsing step in `nitro-auto-pilot.md` includes an explicit SESSION_ID format validation rule — PASS (present in both files, Step 2: Parse Arguments)
- [x] AC2: The validation uses the regex `^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$` — PASS (exact string appears in both files)
- [x] AC3: A clear error message is shown when the format does not match, and execution halts — PASS (STOP IMMEDIATELY + full error message + EXIT stated explicitly)
- [x] AC4: Invalid characters are NOT silently stripped — PASS (instruction explicitly says "do not strip or modify the token")

## Findings

### Finding 1: Regex is correct and sufficient for the security goal

The regex `^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$` anchored with `^` and `$`:
- Blocks `../../../etc/passwd` — CORRECT
- Blocks `SESSION_2026-03-28_14-00-00/../../etc/passwd` — CORRECT ($ prevents suffix)
- Blocks zero-width tricks, embedded slashes, null bytes — CORRECT
- Allows semantically invalid dates like `SESSION_9999-99-99_99-99-99` — ACCEPTED. The format check is the correct layer to enforce here; a non-existent session will fail cleanly when `state.md` lookup returns "not found." This does not represent a security gap.

All three parse branches are correctly specified:
- Token present + valid: use validated SESSION_ID
- Token present + invalid: STOP IMMEDIATELY, display error, EXIT
- Token absent: auto-detect most recent paused/stopped session

### Finding 2: "Token" disambiguation is implicit, not stated

The instruction says "if followed by a token, validate it." There is no explicit definition of what constitutes a "token" vs. an adjacent flag. For example:

- `/nitro-auto-pilot --continue --dry-run` — is `--dry-run` the SESSION_ID token? An LLM would likely treat it as a separate flag (it starts with `--`), but this is inferred, not specified.
- `/nitro-auto-pilot --continue -x` — would `-x` be treated as a SESSION_ID token that fails validation? Or as an unrecognized flag that errors differently?

The implicit rule "a token is a non-flag argument (does not start with `-`)" is not stated. In practice, the regex will cleanly reject any `--foo` value if it were mistakenly captured as a token, so the security boundary holds. However, if an LLM captures `--dry-run` as the SESSION_ID token, it will halt with the wrong error message instead of running with `--dry-run`. This is a UX/reliability gap, not a security gap.

Severity: Moderate.

### Finding 3: File scope declaration in task.md is incomplete

The task's `## File Scope` lists only `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`. The implementation correctly also updated `.claude/commands/nitro-auto-pilot.md` (the live/canonical copy). Both copies are now in sync, which is the right outcome. However, the missing entry in File Scope means the task declaration is inaccurate as written. This is a task hygiene finding, not a defect in the implementation.

Severity: Minor.

### Finding 4: Scaffold is missing pause-continue.md — pre-existing gap exposed

Both `SKILL.md` files (canonical and scaffold) reference `references/pause-continue.md` at line 588/595 respectively. The canonical `.claude/skills/auto-pilot/references/pause-continue.md` exists. The scaffold copy at `apps/cli/scaffold/.claude/skills/auto-pilot/references/` does NOT contain `pause-continue.md` — only `worker-prompts.md` and `parallel-mode.md` exist there.

This means `--continue` validation in the scaffold command correctly halts on invalid SESSION_IDs, but when the validated SESSION_ID reaches Continue Mode in SKILL.md, the SKILL.md says "load `references/pause-continue.md`" — and in a project initialized from the scaffold, that file does not exist.

This is a pre-existing scaffold completeness bug (not introduced by TASK_2026_129). It is out of scope for this task but should be tracked.

Severity: Serious (for scaffold users), but pre-existing.

### Finding 5: No second validation in pause-continue.md Continue Mode

`references/pause-continue.md` Step 1 (line 33): "If SESSION_ID is provided: look for `task-tracking/sessions/{SESSION_ID}/state.md`." At this point the SESSION_ID has already been validated by Step 2 of the command and the value is passed through. The SKILL.md does NOT re-validate, which is architecturally correct (single validation point). No double-validation smell here — this is fine.

### Finding 6: Both files are in sync — no divergence

Both modified files (`apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md` and `.claude/commands/nitro-auto-pilot.md`) contain the identical validation block. The scaffold copy is slightly older (fewer flags — no `--evaluate`, `--sequential`, etc.), but the `--continue` validation block itself is word-for-word identical in both. No drift introduced by this change.

## Required Fixes

- **No blocking fixes required.** All four acceptance criteria pass. The security goal (prevent path traversal via unvalidated SESSION_ID) is achieved.
- **Recommended (Moderate)**: Clarify in Step 2 that a "token" following `--continue` is a non-flag argument, i.e., does not start with `-`. Example wording: "if the next argument does not start with `-`, treat it as the SESSION_ID token and validate it."
- **Out of scope but track separately**: Add `pause-continue.md` to the scaffold at `apps/cli/scaffold/.claude/skills/auto-pilot/references/pause-continue.md` to close the scaffold completeness gap.

## Approved

yes
