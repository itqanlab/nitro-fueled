# Handoff — TASK_2026_143

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified — added phases/reviews/fix_cycles tables, session/worker migrations, refactored applyMigrations helper)
- packages/mcp-cortex/src/tools/context.ts (new — get_task_context, get_review_lessons, get_recent_changes, get_codebase_patterns, stage_and_commit, report_progress)
- packages/mcp-cortex/src/tools/telemetry.ts (new — log_phase, log_review, log_fix_cycle, get_model_performance, get_task_trace, get_session_summary)
- packages/mcp-cortex/src/index.ts (modified — import + register all 12 new tools, bump version to 0.5.0)

## Commits
- (implementation commit — see git log)

## Decisions
- `stage_and_commit` uses `git commit -F -` with stdin input (not -m flag) to avoid shell injection of the commit message
- All file paths in `stage_and_commit` are sanitized of `'"\\` and wrapped in double-quotes before shell expansion
- `get_review_lessons` uses a static LESSON_FILE_MAP mapping lesson files to covered extensions; `review-general.md` has an empty array meaning "always include"
- `get_codebase_patterns` uses `find` under the hood since native glob in Node has no cross-platform sync API; results capped at 10 files per pattern type
- `report_progress` logs a DB event for any status string but only updates the tasks table for valid task status enum values
- `get_task_context` reads plan.md from disk (not DB) since plans are not stored in DB; truncates to 1500 chars to keep responses compact
- `get_recent_changes` sanitizes task_id to `[A-Z0-9_]` before interpolating into git grep command
- Telemetry tables use soft FKs (REFERENCES with FK pragmas ON) — phases/reviews/fix_cycles reference tasks(id) but not enforced by NOT NULL so rows can exist before tasks are synced
- `applyMigrations()` helper replaces the inline migration loop to handle tasks/sessions/workers with one function

## Known Risks
- `stage_and_commit` shell-invokes git — if the project root contains unusual paths, the `find`-based pattern glob may behave unexpectedly; double-quote wrapping mitigates most cases
- `get_review_lessons` LESSON_FILE_MAP is hardcoded — if new lesson files are added to `.claude/review-lessons/`, they won't be filtered correctly until LESSON_FILE_MAP is updated
- phases/reviews/fix_cycles tables have no data yet — `get_model_performance` will return empty arrays until telemetry is wired into orchestration skill
- No tests were added for the new tools (Testing: skip per task.md)
