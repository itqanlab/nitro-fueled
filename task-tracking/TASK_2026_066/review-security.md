# Security Review — TASK_2026_066

## Overall Score
8/10

## Verdict
PASS WITH NOTES

## Findings

### Non-Blocking Findings

#### Finding 1: Stale `Compaction Count` row in the Supervisor Runtime Counters table

The `state.md` schema retains a `Compaction Count` row in the `## Runtime Counters` section. Before this commit, that counter drove the now-removed Supervisor self-compaction limit (stop after 2 self-compactions). With the limit removed, the counter is no longer consumed by any logic in the spec. A future contributor reading the schema may misinterpret it as a constraint that still applies, or an agent filling in the schema may attempt to enforce a limit that no longer exists.

- **Location**: `state.md Format` section, `## Runtime Counters` table, line ~1686
- **Risk**: Spec ambiguity, not an active attack surface. No security boundary is weakened.
- **Recommendation**: Remove the `Compaction Count` row from the `## Runtime Counters` section, or add an inline comment marking it as informational-only (not a limit counter). This avoids confusion with the new per-worker `Compaction Count` column in the Active Workers table.

---

#### Finding 2: `compaction_count` initialization point is unspecified

The spec states the default value is 0 (shown in the Active Workers example rows) but does not explicitly state when the counter is initialized — at spawn time, or on first `compacting` health state observation. If initialization is deferred to first observation, there is a narrow window where parsing code that reads the column before the worker's first compaction health check encounters a missing cell.

- **Location**: Step 6c compacting handler; Active Workers table schema
- **Risk**: Not an injection or traversal vector. The practical risk is a parse failure or a stale `undefined`/empty-cell read that silently skips the kill check on the first compaction. This is a spec completeness gap, not an exploitable vulnerability.
- **Recommendation**: Explicitly state "write `Compaction Count: 0` to the Active Workers row at spawn time (Step 5), before any health checks run."

---

### Items Checked and Found Clear

#### Kill trigger manipulation
The `compaction_count` is tracked entirely within `{SESSION_DIR}state.md`, a file written only by the Supervisor itself. The MCP tool `get_worker_stats` returns a `health` field constrained to the enum `healthy | high_context | compacting | stuck | finished`. There is no external path by which an adversary can inject an arbitrary compaction count. A worker reaching health state `compacting` increments a counter the Supervisor controls — the worker cannot force an early kill by manipulating this counter.

#### Prompt injection in log format entries
The two new log events use the pattern:
```
COMPACTION WARNING — TASK_X: compacted {N} times
COMPACTION LIMIT — TASK_X: compacted {N} times, killing
```
`TASK_X` is a task ID sourced from the Supervisor's own state table (not from MCP response payloads). Per the existing security rule (TASK_2026_064, TASK_2026_060), task IDs must be validated against `/^TASK_\d{4}_\d{3}$/` before use in path or log contexts. That validation requirement is already documented in the spec and applies uniformly to every site that uses a registry-sourced task ID — this new log site does not introduce a new gap relative to the existing standard. `{N}` is the integer compaction count maintained by the Supervisor — not externally sourced — and carries no injection risk.

#### Resource exhaustion from removing the Supervisor self-compaction limit
The removed rule forced a graceful stop after 2 Supervisor self-compactions. The Supervisor is explicitly designed to compact and recover from `state.md`; it does not lose state on compaction. Removing the limit allows the Supervisor to run indefinitely, which is the correct behavior for long backlogs. This is not a resource exhaustion risk in the denial-of-service sense: the Supervisor consumes tokens proportional to its monitoring work (polling MCP, writing state.md), not proportional to the number of workers it kills. An operator choosing to process a 50-task backlog with concurrency 3 is the expected usage pattern. There is no external trigger path that forces Supervisor compactions — they occur only when the LLM context window fills naturally.

#### `compaction_count` bounding
The kill threshold is `>= 6`. The counter increments by 1 per `compacting` health state observation. The Supervisor writes `state.md` after each monitoring pass. Because `state.md` is fully overwritten (atomic) on each update, there is no opportunity for counter corruption via concurrent writes. The counter is not bounded above the kill threshold by spec, but because the kill action is triggered at >= 6 (not exactly 6), any monitoring pass that sees `compacting` after the kill has been issued will re-trigger the kill. The Worker Recovery Protocol should handle a second kill call gracefully (the worker will already be absent from MCP). This is acceptable — a duplicate kill attempt is benign.

#### `Kill Failed` log error string (pre-existing, not new in this commit)
The `Kill Failed` log row uses `{error}` with no character cap. This is a pre-existing gap flagged in the security lessons (TASK_2026_069). It was not introduced by this commit and is out of scope for this review.

---

## Review Summary

| Metric         | Value                |
|----------------|----------------------|
| Overall Score  | 8/10                 |
| Assessment     | PASS WITH NOTES      |
| Critical Issues | 0                   |
| Serious Issues  | 0                   |
| Minor Issues    | 2                   |
| Files Reviewed  | 1 (SKILL.md, changed sections only) |

The compaction circuit breaker design is sound from a security perspective. The kill mechanism cannot be externally triggered, the log entries use only internally-controlled data, and removing the Supervisor self-compaction limit does not introduce a new resource exhaustion surface. The two minor notes (stale Runtime Counter row, unspecified initialization point) are spec clarity issues — neither creates an exploitable condition.
