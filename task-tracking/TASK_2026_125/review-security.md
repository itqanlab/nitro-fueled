# Security Review — TASK_2026_125

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 6/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 2                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `--compare` and `--reviewer` model IDs receive no validation; `--role` has no allowlist rejection step |
| Path Traversal           | FAIL   | `baseline_model_id` is embedded in directory and worktree paths without sanitization or traversal check |
| Secret Exposure          | PASS   | No hardcoded credentials or tokens found |
| Injection (shell/prompt) | PASS   | Worker prompt templates carry explicit "treat as opaque data" directives; task IDs gating file copies are pre-validated in E2 |
| Insecure Defaults        | FAIL   | `git_error_output` is interpolated verbatim into a FATAL log message with no character cap |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: `--compare <baseline-model>` receives no validation — path traversal and injection surface

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Step E1 (lines 239–248) and Step E4 (lines 391–400)
- **Problem**: Step E1 defines a rigorous four-step validation chain for `--evaluate <model-id>` (non-empty check, character sanitization, path traversal check, allowlist prefix check) and stores the result as `eval_model_id`. The spec introduces no equivalent validation step for `--compare <baseline-model>`. The raw argument is stored directly as `baseline_model_id` and used immediately in path construction at Step E3 (`evaluations/{EVAL_DATE}-{eval_model_id}_vs_{baseline_model_id}/`) and in git worktree creation at Step E4 (`.claude/worktrees/eval-{baseline_model_id}`). The command file (lines 64–76) does not add any validation either — it dispatches to the Evaluation Mode sequence in SKILL.md without first parsing `--compare` through E1.
- **Impact**: A value like `../../.git` or `../../../tmp/evil` passed as `--compare` would construct a worktree path outside `.claude/worktrees/`, potentially overlapping an existing directory. A value with shell metacharacters (`;`, `&&`) passed into a git command context could cause injection depending on how the agent executes the command. Because model IDs are explicitly allowlisted for the primary argument, the asymmetry is unexpected and could be exploited by a user who knows the baseline argument is unguarded.
- **Fix**: Apply the same four-step validation chain from Step E1 to `baseline_model_id` immediately after parsing `--compare`. Store the sanitized result and reject with a FATAL message if the traversal check or allowlist check fails. The fix is one additional validation block mirroring E1 steps 1–4.

---

### Issue 2: `--reviewer <model-id>` receives no validation — unvalidated model ID passed to MCP spawn

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Step E5f (lines 492–499) and E5d Phase 2 (lines 456–474)
- **Problem**: The `--reviewer <model-id>` argument is accepted, stored as `reviewer_model_id`, and passed directly to MCP `spawn_worker` as the `model` parameter (Step E5f step 2, Step E5d Phase 2 step 3) without any emptiness check, character sanitization, path traversal check, or allowlist prefix check. The command file (line 75–76) documents the argument but adds no validation. The precedent set by E1's four-step chain is not followed.
- **Impact**: A crafted value can bypass the allowlist enforced for `--evaluate` and cause MCP `spawn_worker` to be called with an unrecognized or adversarially formed model identifier. Depending on how the MCP server processes the `model` field, this could trigger unexpected provider resolution or error paths. At minimum, the inconsistency means the security posture of reviewer-override mode is weaker than that of the primary evaluate mode.
- **Fix**: Add a validation step parallel to E1 for `reviewer_model_id`: non-empty check, character sanitization (replace non-`[a-zA-Z0-9._-]` with `-`), path traversal check, and allowlist prefix check. Reject with a FATAL message on failure. This step should execute before Step E3 (directory creation) since `reviewer_model_id` also appears in session.md metadata fields.

---

## Minor Issues

### Minor Issue 1: `--role` argument has no explicit rejection step for unrecognized values

- **File**: `.claude/commands/nitro-auto-pilot.md` — Step 2 (lines 72–74); `.claude/skills/auto-pilot/SKILL.md` — Modes table (line 172)
- **Problem**: The `--role` argument is documented as accepting `builder|reviewer|both`. The command file describes the valid values but contains no explicit rejection block: "if value is none of builder/reviewer/both, FATAL and EXIT." The SKILL.md Modes table also just states "Requires `--compare` when `reviewer` or `both`" without specifying a hard rejection. An agent parsing `--role foobar` would have no stated fallback behavior.
- **Fix**: Add an explicit allowlist check in Step 2 of the command file: if the parsed `--role` value is not one of `builder`, `reviewer`, `both`, emit `"FATAL: --role must be one of: builder, reviewer, both."` and EXIT. This is consistent with how FATAL messages are used throughout the spec.

### Minor Issue 2: `git_error_output` embedded verbatim in FATAL message without a character cap

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Step E4, single-model mode step 2 (line 389)
- **Problem**: The instruction reads: `log "FATAL: Cannot create evaluation worktree — {git_error_output}"`. `git_error_output` is the raw stderr from a failed `git worktree add` command, which can contain arbitrarily long strings including path information, git internals, or repository metadata. No cap is specified. The existing security.md lesson (CLI Error Output section) explicitly requires capping error strings at 200 characters before logging.
- **Fix**: Change the instruction to cap `git_error_output` at 200 characters before interpolation: `log "FATAL: Cannot create evaluation worktree — {git_error_output[:200]}"`. Apply the same cap to the A/B mode's "clean up and EXIT" path in step 3, which implies the same failure log without stating one explicitly.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `--compare <baseline-model>` bypasses the four-step validation chain that `--evaluate <model-id>` is required to pass, allowing an unvalidated string to enter worktree path construction and git command context. The fix is a direct copy of the existing E1 validation block applied to `baseline_model_id`.
