# Task: Add session_evaluations table and evaluate_session MCP tool


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Create the DB foundation for session quality scoring.

## What to add
1. New `session_evaluations` table in cortex DB schema:
   - session_id, overall_score, quality_score, efficiency_score, process_score, outcome_score
   - signals_json (full raw signals), schema_version, created_at
2. New `evaluate_session(session_id)` MCP tool:
   - Reads workers, phases, reviews, fix_cycles, handoffs for the session
   - Computes 4 dimension scores: Quality (35%), Efficiency (30%), Process (20%), Outcome (15%)
   - Writes record to session_evaluations table
   - Returns score card object
3. Supervisor calls evaluate_session() as last step before end_session()

## Scoring formula
- Quality: avg review score, lesson violation rate, blocking findings per task
- Efficiency: cost per task vs complexity benchmark, compaction events, kill rate
- Process: phase completion rate, handoff written before IMPLEMENTED
- Outcome: COMPLETE rate, first-attempt review pass rate

## Acceptance Criteria
- session_evaluations table created with migration
- evaluate_session MCP tool computes and stores scores
- Returns structured score card with all 4 dimensions

## Dependencies

- None

## Acceptance Criteria

- [ ] session_evaluations table created in DB schema
- [ ] evaluate_session(session_id) MCP tool implemented
- [ ] All 4 dimension scores computed correctly
- [ ] Tool callable by supervisor before end_session()

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/sessions.ts


## Parallelism

Independent. TASK_2026_326 (nitro-burn flag) depends on this.
