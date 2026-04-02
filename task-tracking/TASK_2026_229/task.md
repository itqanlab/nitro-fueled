# Task: Extend Cortex Schema for Worker Telemetry

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Simple      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Extend the Cortex workers table and add new fields to capture detailed telemetry per worker execution. This data feeds the reporting and intelligence layers.

**New fields on workers table:**

- `launcher_type` (text) — which launcher ran this worker (claude-code, codex, cursor)
- `model_used` (text) — specific model (claude-opus-4-6, gpt-5, etc.)
- `spawn_to_first_output_ms` (integer) — startup latency
- `total_duration_ms` (integer) — end-to-end execution time
- `token_usage` (text/JSON) — input/output tokens if available
- `estimated_cost_usd` (real) — cost estimate for this worker run
- `files_changed_count` (integer) — number of files modified
- `files_changed` (text/JSON) — list of file paths
- `review_result` (text) — pass/fail/pending
- `review_findings_count` (integer) — number of review findings
- `retry_number` (integer) — which retry attempt this is (0 = first try)
- `workflow_phase` (text) — which phase (pm, architect, dev, qa, review)

**New MCP tools:**

- `get_worker_telemetry(worker_id)` — full telemetry for one worker
- `get_session_telemetry(session_id)` — aggregated telemetry for a session

## Dependencies

- None (additive schema change)

## Acceptance Criteria

- [ ] Workers table extended with all telemetry fields
- [ ] New MCP tools for querying telemetry data
- [ ] Existing worker tools continue to work (backward compatible)
- [ ] Migration handles existing rows (nullable new fields)

## References

- Current workers schema: `packages/mcp-cortex/src/db/schema.ts`
- Current worker tools: `packages/mcp-cortex/src/tools/`

## File Scope

- `packages/mcp-cortex/src/db/schema.ts` (modified)
- `packages/mcp-cortex/src/tools/telemetry-tools.ts` (new)

## Parallelism

Can run in parallel — additive schema change, no conflicts.
