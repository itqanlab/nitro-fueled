# Task: MCP Cortex — Health Constants & context_overflow State

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | REFACTORING                  |
| Priority              | P2-Medium                    |
| Complexity            | Medium                       |
| Preferred Tier        | balanced                     |
| Model                 | default                      |
| Testing               | optional                     |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

Part 1 of 2 — original request: Unify worker health status definitions and thresholds across MCP cortex, dashboard, and documentation.

All worker health thresholds in `packages/mcp-cortex/src/tools/workers.ts` are hardcoded magic numbers inline in `getHealth()`. The `CONTEXT_WINDOWS` map lives in `token-calculator.ts` with no shared constant for the compaction detection threshold in `jsonl-watcher.ts`. There is also a logic gap: a worker at 120%+ context with zero compactions is indistinguishable from one at 85% — both return `high_context`.

**Changes required:**

1. **Create `packages/mcp-cortex/src/constants.ts`** — export all health-related thresholds as named constants:
   - `HEALTH_CONTEXT_HIGH_THRESHOLD = 80` (percent — triggers `high_context`)
   - `HEALTH_CONTEXT_OVERFLOW_THRESHOLD = 100` (percent — triggers `context_overflow`)
   - `HEALTH_COMPACTION_TRIGGER_COUNT = 2` (triggers `compacting` status)
   - `HEALTH_STUCK_TIMEOUT_MS = 120_000` (2 min inactivity → `stuck`)
   - `HEALTH_STARTUP_GRACE_MS = 300_000` (5 min grace for `starting`)
   - `COMPACTION_DETECT_DROP_RATIO = 0.3` (token drop ratio that counts as a compaction)
   - Move `CONTEXT_WINDOWS` and `DEFAULT_CONTEXT_WINDOW` here from `token-calculator.ts`

2. **Update `packages/mcp-cortex/src/db/schema.ts`** — add `context_overflow` to the `HealthStatus` type union:
   ```
   'healthy' | 'starting' | 'high_context' | 'context_overflow' | 'compacting' | 'stuck' | 'finished'
   ```

3. **Update `packages/mcp-cortex/src/tools/workers.ts`** — import constants, add `context_overflow` check before `high_context`:
   ```ts
   if (tokens.context_percent >= HEALTH_CONTEXT_OVERFLOW_THRESHOLD) return 'context_overflow';
   if (tokens.context_percent > HEALTH_CONTEXT_HIGH_THRESHOLD) return 'high_context';
   ```

4. **Update `packages/mcp-cortex/src/process/token-calculator.ts`** — import `CONTEXT_WINDOWS` and `DEFAULT_CONTEXT_WINDOW` from constants, remove local definitions.

5. **Update `packages/mcp-cortex/src/process/jsonl-watcher.ts`** — import `COMPACTION_DETECT_DROP_RATIO` from constants, replace hardcoded `0.3` references.

## Dependencies

- None

## Acceptance Criteria

- [ ] `packages/mcp-cortex/src/constants.ts` exists and exports all thresholds listed above
- [ ] `HealthStatus` type includes `context_overflow`
- [ ] Workers at >= 100% context report `context_overflow`, not `high_context`
- [ ] No magic numbers remain in `getHealth()` or compaction detection logic
- [ ] `token-calculator.ts` and `jsonl-watcher.ts` import from constants, not defining their own
- [ ] TypeScript compiles without errors

## References

- `packages/mcp-cortex/src/tools/workers.ts` — `getHealth()` function (lines 47-57)
- `packages/mcp-cortex/src/db/schema.ts` — `HealthStatus` type (line 11)
- `packages/mcp-cortex/src/process/token-calculator.ts` — `CONTEXT_WINDOWS` map
- `packages/mcp-cortex/src/process/jsonl-watcher.ts` — compaction detection (lines 178-182, 230-231)

## Parallelism

✅ Can run in parallel — no file scope overlap with any currently CREATED task.

Suggested execution wave: Wave 1 (independent).

## File Scope

- packages/mcp-cortex/src/constants.ts (new)
- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/workers.ts
- packages/mcp-cortex/src/process/token-calculator.ts
- packages/mcp-cortex/src/process/jsonl-watcher.ts
