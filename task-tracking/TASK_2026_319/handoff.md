# Handoff — TASK_2026_319

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified — added SESSION_EVALUATIONS_TABLE, index, and db.exec call)
- packages/mcp-cortex/src/tools/sessions.ts (modified — added handleEvaluateSession function)
- packages/mcp-cortex/src/index.ts (modified — added import + tool registration for evaluate_session)

## Commits
- (implementation commit — to be made by orchestrator)

## Decisions
- Scoring signal `lesson_violation_rate` set to 0.0 intentionally — not derivable from DB alone; reserved for future enrichment
- Task lookup uses `session_claimed = ?` to associate tasks with sessions (existing FK pattern)
- Dynamic SQL placeholders for IN clauses to handle variable-length task ID lists safely

## Known Risks
- If a session has 0 tasks (no session_claimed rows), all dimension scores default to formula-neutral values (quality=3.0 from blockingPenalty path, efficiency=10, process=0, outcome=0) — edge case to verify
- `session_claimed` column links tasks to sessions; sessions without claimed tasks return zero-signal evaluations
