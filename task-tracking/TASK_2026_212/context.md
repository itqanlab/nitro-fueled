# Context — TASK_2026_212

## User Intent

Investigate why GPT-5.4 had a 50% kill rate on PREP workers in SESSION_2026-03-30T19-17-29.
Killed PIDs: 62333, 65311, 62488. Determine root cause and recommend routing changes.

## Strategy

RESEARCH task — Simple complexity. Gather data from:
1. Session files: task-tracking/sessions/SESSION_2026-03-30T19-17-29/
2. Orchestrator history for session data
3. Cortex MCP for worker stats, kill events
4. Any available JSONL logs or worker output files
