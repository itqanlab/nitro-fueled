# Task: Supervisor Spawn Fallback — Retry with Claude Sonnet on Provider Failure

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Provider   | default     |
| Testing    | skip        |

## Description

When the supervisor spawns a worker with a non-Claude provider (e.g., `provider: glm`) and the spawn fails, the current behavior is:

1. Log the failure
2. Leave the task in the queue
3. Wait for the next loop iteration to retry — same provider, same failure

This means a bad GLM API key or a network issue silently stalls all tasks routed to that provider until the user intervenes.

The fix: when `spawn_worker` returns an error AND the attempted provider was not `claude`, immediately retry the spawn with `provider: claude`, `model: claude-sonnet-4-6` as the fallback. Log clearly that the fallback was triggered. This ensures work continues even when an optional provider is misconfigured.

## Acceptance Criteria

- [ ] When `spawn_worker` fails and the provider was `glm` or `opencode`, supervisor immediately retries with `provider: claude`, `model: claude-sonnet-4-6`
- [ ] Fallback retry uses the same prompt, label, and working directory as the original spawn
- [ ] Log entry on fallback: `| {HH:MM:SS} | auto-pilot | SPAWN FALLBACK — TASK_X: {original_provider} failed, retrying with claude/sonnet |`
- [ ] If the fallback spawn also fails, apply the existing Step 5f failure handling (log, leave in queue, retry next iteration)
- [ ] Worker recorded in state.md with the **resolved** provider (`claude`) and model (`claude-sonnet-4-6`), not the originally intended provider
- [ ] Fallback does NOT apply when provider was already `claude` (no infinite loop)
- [ ] Fallback does NOT apply for non-provider MCP errors (e.g., MCP unreachable — those use the existing global MCP failure handler)

## Implementation Notes

**In SKILL.md Step 5f (spawn failure handling):**

```
On spawn failure:
  IF provider != 'claude':
    Log: "SPAWN FALLBACK — TASK_X: {provider} failed ({error}), retrying with claude/claude-sonnet-4-6"
    Retry spawn_worker with provider=claude, model=claude-sonnet-4-6
    IF retry succeeds: record worker with provider=claude, model=claude-sonnet-4-6. Continue normally.
    IF retry fails: apply existing failure handling (log, leave task in queue)
  ELSE:
    Apply existing failure handling (log, leave task in queue)
```

**Distinguishing provider failure from MCP unreachable:**
- MCP unreachable: `list_workers` also fails, or error contains "connection refused" / "ECONNREFUSED"
- Provider failure: `spawn_worker` returns an error but `list_workers` succeeds — treat as provider failure

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` — Step 5f spawn failure handling

## Parallelism

Can run in parallel with any other task. No dependencies.
Wave: independent.
