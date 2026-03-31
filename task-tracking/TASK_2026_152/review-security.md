# Security Review — TASK_2026_152

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 9/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 0                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 4                                    |

Files reviewed (all markdown AI agent instructions, no executable code):

1. `.claude/skills/auto-pilot/SKILL.md`
2. `.claude/skills/auto-pilot/references/parallel-mode.md`
3. `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` — byte-for-byte identical to (1); findings apply equally
4. `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` — byte-for-byte identical to (2); findings apply equally

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | Task IDs are validated against `^TASK_\d{4}_\d{3}$` before routing; dependency tokens validated against same regex. No unvalidated external input passes to dangerous operations. |
| Path Traversal           | PASS   | No file-path construction from user input. All file references are hardcoded relative paths (`task-tracking/`, `{SESSION_DIR}state.md`). The SESSION_DIR substitution is an internal supervisor variable, not user-supplied. |
| Secret Exposure          | PASS   | No credentials, API keys, or tokens appear anywhere in the files. Provider names and model IDs are referenced as plain identifiers with no authentication material. |
| Injection (shell/prompt) | PASS   | Shell commands present are limited to `Bash: sleep 30` — no variables, no user input, no concatenation. Banned Bash pattern list (Rule #1) and banned tangent list (Rule #7) actively restrict the attack surface. |
| Insecure Defaults        | PASS   | MCP unavailability results in an explicit FATAL STOP with no fallback to ad-hoc execution (unless `allowFileFallback` is explicitly opt-in). Retry limit is capped at 5 with clamping. Concurrency default (3) is conservative. |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

No serious issues found.

---

## Minor Issues

### Minor Issue 1: File-Based Fallback Path Accepts Unvalidated `task.md` Content

- **File**: `references/parallel-mode.md` — Step 5 Fallback path, line 189
- **Problem**: The fallback path (`cortex_available = false`) instructs the supervisor to "read the minimal metadata slice from `task.md`". No validation constraints are described for the values read from that file — no schema check, no type assertion, no sanitization of the `provider`/`model` fields before they are passed to `spawn_worker()`.
- **Impact**: In the degraded-mode path, a tampered or malformed `task.md` could supply an attacker-controlled `provider` or `model` string to `spawn_worker`. This is a low-probability vector (requires write access to the task-tracking directory) and the preferred DB path eliminates it entirely, but the fallback path has no stated guard.
- **Fix**: Add a note to the Step 5 fallback block requiring that `provider`, `model`, and `task_id` read from `task.md` are validated against the same schema used on the preferred path (task_id regex; provider must be in the `get_available_providers()` list if MCP is partially available).

### Minor Issue 2: `allowFileFallback` Config Field Has No Access-Control Note

- **File**: `SKILL.md` — nitro-cortex Availability Check section, lines 237–238
- **Problem**: The opt-in degraded mode (`"allowFileFallback": true` in `.nitro-fueled/config.json`) disables the hard-stop on cortex DB failure and activates the file-based fallback paths. The config file itself is described as a plain JSON file with no mention of access controls. An attacker or misconfigured automation that can write to `.nitro-fueled/config.json` could force the supervisor into the less-validated file fallback path at will.
- **Impact**: Privilege escalation within the orchestration system — not a direct OS-level escalation, but the supervisor's data-access guarantees weaken in degraded mode. Combined with Minor Issue 1, this creates a chained path from config write to unvalidated input.
- **Fix**: Add a documentation note that `.nitro-fueled/config.json` should be protected from world-writable permissions in shared or CI environments, and that `allowFileFallback` should be explicitly set to `false` in production/unattended deployments unless the fallback path's weaker guarantees are acceptable.

---

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: The file-based fallback path (`cortex_available = false`) does not state validation requirements for values read from `task.md` before they reach `spawn_worker`. This is a defense-in-depth gap, not an immediately exploitable vulnerability — the preferred path is unaffected and the fallback requires an attacker to already have write access to the task-tracking directory.
