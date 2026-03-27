# Logic Review — TASK_2026_069

**Score**: 6/10
**Verdict**: PASS_WITH_NOTES

---

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Fails on glm/opencode, retries with provider=claude, model=claude-sonnet-4-6 | YES | Step 5f covers any non-claude provider. |
| 2 | Fallback retry uses same prompt, label, working_directory | YES | Step 5f point 3 is explicit. |
| 3 | Log entry format: `SPAWN FALLBACK — TASK_X: {provider} failed, retrying with claude/sonnet` | PARTIAL | See Finding 1. |
| 4 | Fallback also fails — existing failure handling applies (log, leave in queue) | YES | Step 5f point 5 is explicit. |
| 5 | Worker recorded with resolved provider (claude) not intended provider | YES | Step 5f point 4 is explicit. |
| 6 | Fallback does NOT apply when provider is already claude | YES | IF branch checks `resolved provider != claude`. |
| 7 | Fallback does NOT apply for MCP-unreachable | PARTIAL | See Finding 2. |

---

## Findings

### [MINOR] Finding 1 — Log format mismatch between the inline log and the log table

Step 5f, point 1 instructs the supervisor to emit:

```
"SPAWN FALLBACK — TASK_X: {provider} failed ({error}), retrying with claude/claude-sonnet-4-6"
```

Step 5f, point 2 instructs the supervisor to write to `log.md`:

```
| {HH:MM:SS} | auto-pilot | SPAWN FALLBACK — TASK_X: {provider} failed, retrying with claude/sonnet |
```

The log table at line 128 shows only the existing "Spawn failure" row:

```
| Spawn failure | | {HH:MM:SS} | auto-pilot | SPAWN FAILED — TASK_X: {error} | |
```

There is no "Spawn fallback" row registered in the canonical log event table (lines 92-139). This means:

1. A supervisor reading the log table to understand what events exist will not find the fallback event documented there.
2. The inline log message (point 1) includes `{error}` and the model name `claude-sonnet-4-6`, while the `log.md` row (point 2) omits `{error}` and abbreviates the model as `sonnet`. Two different formats for the same event creates an inconsistency. The acceptance criterion specifies the `log.md` format precisely; the inline log does not need to match it exactly, but having both formats stated separately with different detail levels is a maintenance hazard.

**Recommendation**: Add a "Spawn fallback" row to the log event table, using the `log.md` format as the canonical definition:

```
| Spawn fallback | `\| {HH:MM:SS} \| auto-pilot \| SPAWN FALLBACK — TASK_X: {provider} failed, retrying with claude/sonnet \|` |
```

Remove point 1 (the redundant inline log string) and rely on the table, or align the two formats so they match exactly.

---

### [MINOR] Finding 2 — MCP-unreachable detection is heuristic, not verified before retry

Step 5f distinguishes provider failure from MCP-unreachable by two signals:

- Error message contains "connection refused" or "ECONNREFUSED"
- `list_workers` itself fails

The fallback then calls `spawn_worker` a second time (the claude retry). If the actual problem is a transient MCP timeout (not a string-matchable ECONNREFUSED, and `list_workers` happened to succeed because it was cached or hit a race), the fallback call will also fail — which is handled by point 5. So the system degrades gracefully. However, the text does not say whether `list_workers` is called at the time of the spawn failure, or whether the result from the most-recent call (Step 1 startup reconcile) is reused. If the intent is "call `list_workers` now to distinguish", the step should say so explicitly. If the intent is "if the most recent `list_workers` succeeded, treat this as provider failure", that should be stated.

**Impact**: Low — the fallback path itself is safe (it either succeeds or falls back to leaving the task in queue). The concern is ambiguity for the supervisor implementing this instruction.

---

### [MINOR] Finding 3 — Fallback retry does not reset or increment retry_count

Step 5f point 5 says: if the fallback spawn fails, "leave task status as-is (will retry next loop iteration)". The existing failure handling for the claude-already-provider path says the same. Neither path mentions whether `retry_count` is incremented for the fallback attempt.

The retry_count field (tracked in state.md per worker) is used by the stuck detection and Worker Recovery Protocol to determine when to give up on a worker. If the fallback attempt counts as an attempt, not incrementing `retry_count` allows the supervisor to keep retrying a permanently broken task indefinitely. If it does not count, the current behavior is correct but undocumented.

**Recommendation**: Explicitly state whether the fallback spawn attempt (and its failure) increments `retry_count`, and whether the original failed attempt does too. This matters for the BLOCKED-due-to-max-retries condition (log table line 121).

---

### [SUGGESTION] Finding 4 — `spawn_worker` tool signature has no `provider` parameter

The MCP tool signature documented at line 1647 is:

```
spawn_worker(prompt: string, working_directory: string, label: string, model?: string, allowed_tools?: string[])
```

There is no `provider` parameter in the documented signature. Step 5f point 3 instructs the supervisor to "override: `provider=claude`, `model=claude-sonnet-4-6`", but if `spawn_worker` does not accept a `provider` parameter, this instruction cannot be carried out as written.

Step 5d at line 546 says: `"provider": the resolved provider from step 5c (omit if 'claude' — that is the MCP default, so omitting is equivalent)`. This implies `provider` is accepted by `spawn_worker` even though it is absent from the formal signature block.

If `provider` is a real parameter that was simply omitted from the signature documentation, the signature block should be updated. If `provider` is conveyed another way (e.g., embedded in the model string, or handled by a wrapper), both Step 5d and Step 5f need to clarify the actual calling convention. This is not a blocker for this task — it is a pre-existing documentation gap — but it is exercised directly by the new fallback code path.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The fallback successfully spawns a claude worker, records it in state.md with `provider=claude`, and continues normally. If the supervisor later reads state.md (after compaction recovery) and tries to determine which tasks used which providers for cost tracking or analytics, the `provider` column now says `claude` for a task that the user intended to run on `glm`. This is correct per acceptance criterion 5, but it means the cost accounting will attribute charges to claude even if the user has a billing reason to distinguish them. This is not a bug in the implementation but is an undocumented side-effect worth noting in operator documentation.

### 2. What user action causes unexpected behavior?

A user who configures a task with `provider: glm` in `task.md` explicitly opts into glm for cost or capability reasons. The fallback silently runs the task on claude without alerting the user beyond a log entry. If the user is not monitoring the log, they may not realize the fallback occurred. The fallback log entry at the `log.md` level is visible, but there is no mechanism to surface it to the operator's attention (no WARN prefix, no console alert).

### 3. What data makes this produce wrong results?

If the task's `task.md` has `Provider: claude` explicitly set, the routing table would resolve to `claude`, and the fallback would correctly not apply. However, if a task uses `Provider: default` and the routing table resolves it to `glm` (e.g., `Complexity=Medium`), the fallback applies. The worker is spawned on claude with `claude-sonnet-4-6` regardless of whether the routing table would have chosen `claude-opus-4-6` for that task's complexity. A Complex task that glm fails on gets retried with Sonnet instead of Opus — a potential quality downgrade that is not mentioned.

### 4. What happens when dependencies fail?

If `list_workers` fails when the supervisor attempts to distinguish MCP-unreachable from provider failure (Finding 2), the step applies the global MCP failure handler and exits the loop. This is correct but the timing of the `list_workers` call is unspecified. A slow `list_workers` after a fast `spawn_worker` failure delays the main loop; this is acceptable but should be documented as a synchronous gate.

### 5. What's missing that the requirements didn't mention?

- **No operator notification beyond log**: The fallback is logged but not surfaced as a WARNING-level event that would prompt the operator to investigate the broken provider configuration. A task succeeding via fallback masks a persistent infrastructure problem.
- **No maximum fallback count per session**: If every task in a large batch falls back to claude, the session could exhaust the claude quota faster than expected. The task.md accepts this risk but it is not acknowledged.
- **Fallback does not re-evaluate model quality**: A Complex task is downgraded from `glm-5` (the routing table's choice) to `claude-sonnet-4-6` without checking whether `claude-opus-4-6` would be more appropriate. The implementation always falls back to Sonnet, not to the routing table's claude-equivalent.

---

## Summary

The core fallback logic is correctly specified: non-claude provider failure triggers a retry with claude/sonnet, the retry uses the same prompt/label/working_directory, and if the retry also fails the task is left in queue for the next iteration. The no-infinite-loop guard (provider == claude skips fallback) is in place. The MCP-unreachable distinction is present but relies on heuristic string matching with ambiguity around when `list_workers` is re-called.

The main actionable issues are:

1. The "Spawn fallback" event is missing from the canonical log event table (lines 92-139), creating a documentation gap and a minor format inconsistency between the inline log and the `log.md` row.
2. `retry_count` behaviour during fallback is unspecified, which could allow indefinite retries on permanently broken tasks.
3. The `spawn_worker` tool signature does not document the `provider` parameter, which the new code path relies on.

None of these issues block the acceptance criteria from being met in the normal case, but they leave ambiguity that could cause divergent supervisor behaviour when implemented.
