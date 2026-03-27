# Security Review — TASK_2026_069

**Score**: 8/10
**Verdict**: PASS_WITH_NOTES

---

## Findings

### MINOR — Error message logged verbatim without truncation

**File**: `.claude/skills/auto-pilot/SKILL.md`, line 594

The fallback log instruction reads:

```
"SPAWN FALLBACK — TASK_X: {provider} failed ({error}), retrying with claude/claude-sonnet-4-6"
```

The `{error}` placeholder is interpolated directly from the MCP `spawn_worker` error response with no stated length cap or sanitization. MCP error objects from an external or misconfigured provider could carry arbitrarily long strings — including authentication challenge messages, internal provider stack traces, or crafted content. When the agent writes this verbatim to `log.md` (a version-controlled file) it may commit:

- API endpoint URLs (disclosing provider routing topology)
- Partial or full authentication details embedded in HTTP 401 / 403 responses
- Provider-supplied error payloads that could contain injected markdown (e.g., a provider returning a response whose body contains a fake log line, causing a Supervisor agent reading log.md to misinterpret the session state)

The same pattern was flagged in TASK_2026_068 (`Network exception messages from child processes or fetch calls must be capped before terminal output`). The same principle applies here to log file writes.

**Fix**: Cap the interpolated error to the first 200 characters with a `…` suffix when truncated. The log instruction should read: `{error[:200]}` (or equivalent notation meaningful to the agent). Apply the same cap to the Step 5f.5 failure log: `"Failed to spawn fallback worker for TASK_X: {error}"`.

---

### MINOR — MCP-unreachable heuristic relies on string matching; a renamed or localized error could misroute to fallback

**File**: `.claude/skills/auto-pilot/SKILL.md`, lines 589–590

The distinction between MCP-unreachable and provider-failure uses:

> error contains "connection refused", "ECONNREFUSED", or `list_workers` itself fails

String matching on error messages is a brittle heuristic. If the MCP server is reachable but `spawn_worker` returns a transport-layer timeout (e.g., "ETIMEDOUT", "socket hang up", "read ECONNRESET"), the condition would not match either keyword and the instruction would classify the failure as a provider failure, triggering a fallback retry to Claude. This means:

- A transient network partition between the supervisor and the MCP server (not a provider issue) would cause the supervisor to re-attempt with Claude's API, potentially routing a task to the wrong provider and incurring unexpected cost.
- Repeated transient timeouts would be partially absorbed by the one-retry fallback budget (benign), but would not escalate to the global MCP failure handler or a supervisor pause — masking a real MCP connectivity problem.

This is not immediately exploitable, but it is a logic gap that overlaps with security (unexpected provider routing under adversarial network conditions).

**Fix**: Expand the MCP-unreachable detection to include `ETIMEDOUT`, `ECONNRESET`, and `socket hang up`, or — preferably — treat any `spawn_worker` error that also causes `list_workers` to fail (the second condition) as MCP-unreachable regardless of error text. The `list_workers`-also-fails branch already provides a reliable structural gate; emphasize it as the primary check and demote string matching to a secondary hint.

---

## No Issues

The following concerns raised in the task brief were evaluated and found to have no actionable security gap:

**Provider escalation / deliberate restriction bypass**: The fallback only fires when the resolved provider is NOT `claude` and when `spawn_worker` returns an error. A deliberately provider-restricted task (e.g., a task.md that explicitly sets `provider: glm`) would still fall back to Claude on GLM failure. This is a design-level policy question (whether failover should respect a hard provider restriction) rather than a security issue — no attacker-controlled trigger path exists.

**Infinite loop / cost amplification**: The fallback is a single one-shot retry (not a loop). If the fallback spawn fails, the instruction falls through to the existing failure handler (log, leave in queue, retry next loop iteration). The loop-level retry path is governed by the existing concurrency and interval constraints. No runaway amplification vector exists.

**Prompt injection via user-controlled content**: No user-provided content flows into the fallback trigger path. The fallback is triggered by an MCP error return value, and the only user-influenced fields (`prompt`, `label`, `working_directory`) are carried over unchanged from the original spawn attempt — they were already present in the system before the failure. No new injection surface is introduced.

**Infinite loop guard correctness**: The `IF resolved provider != 'claude'` guard is correctly specified. The fallback cannot retrigger itself because the retry uses `provider=claude` and the guard excludes `provider=claude` from fallback eligibility. The no-loop invariant is sound.

---

## Review Lessons Update

The error-truncation finding is an extension of the existing TASK_2026_068 pattern. No new lesson category is needed — the existing entry in `security.md` covers it. The MCP-unreachable string-matching pattern is new and worth documenting.
