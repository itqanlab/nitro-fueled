# Task: Provider/Model Tracing — Per-Task Run Telemetry

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P2-Medium    |
| Complexity | Simple       |
| Model      | default      |
| Testing    | unit         |

## Description

Every task run should emit a **trace entry** capturing which provider and model was used, what happened, and how long it took. These traces accumulate globally across all projects in `~/.nitro-fueled/traces/` and build a dataset for learning which models perform well on which task types over time.

No analysis tooling is required in this task — just reliable, consistent capture.

### Trace Schema

Each entry is one JSON line in a daily `.jsonl` file (`~/.nitro-fueled/traces/YYYY-MM-DD.jsonl`):

```json
{
  "timestamp": "2026-03-28T14:23:00Z",
  "task_id": "TASK_2026_095",
  "project": "nitro-fueled",
  "complexity_tier": "medium",
  "preferred_tier": "balanced",
  "provider": "glm",
  "model": "glm-4.7",
  "fallback_used": false,
  "fallback_from_model": null,
  "outcome": "COMPLETE",
  "review_pass": true,
  "review_attempts": 1,
  "token_input": 45230,
  "token_output": 8120,
  "token_cost_usd": 0.00,
  "duration_ms": 134500
}
```

### Emit Points

1. **Worker completion** — when the Supervisor receives worker done signal, it writes a trace entry
2. **Review completion** — when review workers finish, the trace entry is updated with `review_pass` and `review_attempts`

### Implementation

- New module `libs/worker-core/src/core/trace-writer.ts` — appends a JSON line to the daily trace file
- Auto-pilot skill updated to call trace writer at task completion
- Global traces directory created on first write: `~/.nitro-fueled/traces/`
- File rotates daily by date — no cleanup logic needed for now
- Atomic append (no file locking issues for single-process writes)

### Privacy

Traces are local to the machine. No data is sent anywhere. The `project` field captures the directory name only (not the full path).

## Dependencies

- TASK_2026_111 — provider resolver engine must be in place so we know which model was actually used (including fallback). Supersedes cancelled TASK_2026_096.

## Acceptance Criteria

- [ ] On task completion, a trace entry is written to `~/.nitro-fueled/traces/YYYY-MM-DD.jsonl`
- [ ] Trace file is created if it doesn't exist; entries are appended
- [ ] All schema fields are populated (null/0 for unknowns rather than omitting)
- [ ] `fallback_used` and `fallback_from_model` correctly reflect when fallback chain was triggered
- [ ] Traces from multiple projects on the same machine go to the same `~/.nitro-fueled/traces/` directory
- [ ] No user-visible output from trace writing — fully silent

## Parallelism

**Wave**: 2 (depends on new provider resolver architecture for full fidelity)
**Can run in parallel with**: TASK_2026_097
**Conflicts with**: None

## References

- `.claude/skills/auto-pilot/SKILL.md`
- `libs/worker-core/src/core/print-launcher.ts`
- `apps/session-orchestrator/src/tools/spawn-worker.ts`
