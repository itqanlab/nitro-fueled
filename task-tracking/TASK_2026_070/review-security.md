# Security Review — TASK_2026_070

## Score: 7/10

## Review Summary

| Metric           | Value          |
|------------------|----------------|
| Overall Score    | 7/10           |
| Assessment       | NEEDS_REVISION |
| Critical Issues  | 0              |
| Serious Issues   | 2              |
| Minor Issues     | 2              |
| Files Reviewed   | 4              |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | Session archive commit message interpolates `{tasks_completed}` and `{total_cost}` without a stated cap or validation rule |
| Path Traversal           | PASS   | No user-supplied paths accepted; all paths are derived from the known session directory structure |
| Secret Exposure          | PASS   | No credentials, tokens, or secrets introduced |
| Injection (shell/prompt) | FAIL   | Stale-archive error reason `{reason}` interpolated into log without a character cap; commit message interpolates `{SESSION_ID}` with no character-set validation |
| Insecure Defaults        | PASS   | gitignore additions are additive and conservative |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: SESSION_ID interpolated into git commit messages without character-set validation

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Stale Session Archive Check (Step 6, 7) and Session Stop section (Step 6)
- **Problem**: The commit message templates `"chore(session): archive {SESSION_ID} — recovered from previous session"` and `"chore(session): archive {SESSION_ID} — {tasks_completed} tasks, ${total_cost}"` substitute `{SESSION_ID}` directly into the shell command string passed to `git commit -m`. `SESSION_ID` values originate from session directory names that are written by the supervisor, but the spec does not validate the format before use. A malformed or adversarially crafted session directory name (e.g., containing a newline, backtick, or `$(...)`) could, depending on how the agent constructs the shell call, break out of the commit message string. The same concern applies to `{tasks_completed}` and `{total_cost}`, which are drawn from supervisor-maintained counters that are not validated for format here.
- **Impact**: If the evaluating agent builds the git command via string interpolation into a shell string (e.g., wraps it in a bash `eval` or passes it to `exec` rather than `spawnSync`), a crafted session name could inject additional git arguments or shell commands. Even without shell injection, a newline in the message string would silently produce a multi-paragraph commit message that breaks downstream `git log --oneline` parsing.
- **Fix**: Add a validation step in the Stale Session Archive Check algorithm: before using `{SESSION_ID}` in any commit message, assert it matches the expected pattern (e.g., `/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/`). If it does not match, skip the commit and log a warning. Similarly, cap `{total_cost}` to a decimal pattern and `{tasks_completed}` to an integer. Document that the agent must pass the message to `git commit` as a literal argument, not via shell interpolation.

### Issue 2: `{reason}` error string interpolated into version-controlled log files without a character cap

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Session Log table ("Git error (non-fatal)" row) and Session Stop section step 6
- **Problem**: The log row template `| {HH:MM:SS} | auto-pilot | STALE ARCHIVE WARNING — git error: {reason} |` and the session stop template `| {HH:MM:SS} | auto-pilot | SESSION ARCHIVE WARNING — commit failed: {reason} |` interpolate `{reason}` directly from a git error response. Git error messages can include file system paths, lock file paths, or crafted content from a compromised git hook. There is no stated length cap. These log entries are committed to git history by the session stop step, meaning uncapped error strings become permanently part of the repository.
- **Impact**: A malicious git hook or a crafted git error message could write arbitrarily long strings or sensitive path information into committed log files. The existing security lesson for TASK_2026_069 calls out this exact pattern: "behavioral specs must explicitly state a cap (e.g., `{error[:200]}`)."
- **Fix**: Apply the cap established by the TASK_2026_069 lesson: specify `{reason[:200]}` (first 200 characters) at every log-write instruction that sources content from an external git response. This applies to both the Stale Session Archive Check log table and the Session Stop warning row.

---

## Minor Issues

### Minor 1: `.gitignore` glob pattern excludes `state.md` only one level deep

- **File**: `.gitignore` line `task-tracking/sessions/*/state.md`
- **Problem**: The glob `*/state.md` matches exactly one directory level. If a session directory were ever nested one level deeper (e.g., `task-tracking/sessions/2026/SESSION_ID/state.md`), the pattern would not match and `state.md` would be tracked. This is a defense-in-depth concern, not an immediate risk, since the current session directory structure is flat.
- **Fix**: Document the flat-directory assumption in a comment next to the rule, or use `**/state.md` if the intent is to exclude all `state.md` files recursively under `task-tracking/sessions/`.

### Minor 2: Completion Worker appends to `orchestrator-history.md` with `unknown` sentinel values

- **File**: `.claude/skills/orchestration/SKILL.md` — Completion Phase, Step 5
- **Problem**: The spec allows the worker to write `unknown` for worker label, cost, and duration if these cannot be determined. `unknown` is a safe literal, but the `Description` field pattern that TASK_2026_061 flagged applies here: the row format has no constraint against a worker writing a path or token into the worker label field if it cannot determine the real value. The risk is low because the field is agent-populated from session context rather than from user input.
- **Fix**: Add an explicit note that all fields appended by the Completion Worker must be drawn only from the session context of the current task, and must not include file paths outside the project root, tokens, or raw error output. This is consistent with the TASK_2026_061 lesson on free-text description fields.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `{SESSION_ID}` and `{reason}` interpolated into git commit messages and committed log files without a character-set validation step or length cap — the pattern flagged in prior lessons (TASK_2026_069) is present here. The fixes are small and mechanical.
