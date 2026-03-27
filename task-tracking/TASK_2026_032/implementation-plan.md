# Implementation Plan — TASK_2026_032

## Overview

Add per-worker log files and post-session analytics to the auto-pilot supervisor specification.
All changes are in `.claude/skills/auto-pilot/SKILL.md`.

## Change 1: Update Session Directory Files Table

**Location**: Lines ~184-189 (Files inside the session directory section)
**Change**: Remove "(future)" placeholders from analytics.md and worker-logs/ rows.

Before:
```
| `analytics.md` | TASK_032 (future) | Post-session analytics. Not created by this task. |
| `worker-logs/` | (future) | Per-worker log files. Not created by this task. |
```

After:
```
| `analytics.md` | auto-pilot | Post-session analytics generated at supervisor stop (Step 8c). |
| `worker-logs/` | auto-pilot | Per-worker log files written at each worker completion (Step 7h). |
```

## Change 2: Add New Log Events to Session Log Table

**Location**: After line 125 (the `Loop stopped` row in the Session Log event table)
**Change**: Add WORKER LOG and ANALYTICS events

New rows to append (before the closing blank line of the table):
```
| Worker log written | `\| {HH:MM:SS} \| auto-pilot \| WORKER LOG — TASK_X ({Build\|Review}): {duration}m, ${X.XX}, {N} files changed \|` |
| Worker log failed | `\| {HH:MM:SS} \| auto-pilot \| WORKER LOG FAILED — TASK_X: {reason} \|` |
| Analytics written | `\| {HH:MM:SS} \| auto-pilot \| ANALYTICS — {N} tasks completed, total ${X.XX} \|` |
```

## Change 3: Add Step 7h — Write Worker Log File

**Location**: After Step 7g (line ~567), before the `### Worker Recovery Protocol` heading
**Change**: Add new sub-step 7h

Content:
```markdown
**7h. Write worker log file (best-effort — never block on failure):**

After any worker completion (successful or failed), write `{SESSION_DIR}worker-logs/{label}.md`:

1. **Fetch exit stats**: Call `get_worker_stats(worker_id)` to get final tokens and cost.
   - If the call fails, set cost = `"unknown"` and tokens = `"unknown"`.
   - Note: For workers killed in Step 6, `kill_worker` returns `final_stats` with cost — use that value instead.

2. **Compute duration**: `duration_minutes = (current_time - spawn_time_from_state)` in minutes.

3. **Get files modified**: Run:
   ```
   git log --grep="TASK_X" --pretty=format: --name-only | sort | uniq | grep -v '^$'
   ```
   This finds all commits mentioning `TASK_X` in their message and extracts unique file paths.
   If git fails, set files_modified = `["unknown"]`.

4. **Get phase timestamps** (Build Workers only): Filter `{SESSION_DIR}log.md` rows containing `TASK_X` — these are the phase transition entries written by the orchestration skill.

5. **Get review verdicts** (Review Workers only): For each review file in `task-tracking/TASK_X/`:
   - Read `code-style-review.md` — extract the Verdict line (e.g., `**Verdict**: PASS WITH NOTES`)
   - Read `code-logic-review.md` — extract the Verdict line
   - Read `code-security-review.md` if it exists — extract the Verdict line
   - If a file doesn't exist, omit it from the verdicts list.

6. **Write** `{SESSION_DIR}worker-logs/{label}.md`:

```markdown
# Worker Log — {label}

## Metadata

| Field | Value |
|-------|-------|
| Task | TASK_X |
| Worker Type | Build \| Review \| Cleanup |
| Label | {label} |
| Model | {model} |
| Spawn Time | {spawn_time} |
| Completion Time | {current_time} |
| Duration | {duration_minutes}m |
| Outcome | {IMPLEMENTED \| COMPLETE \| FAILED \| STUCK} |

## Exit Stats

| Metric | Value |
|--------|-------|
| Total Tokens | {total_tokens} |
| Input Tokens | {input_tokens} |
| Output Tokens | {output_tokens} |
| Cache Read Tokens | {cache_read_tokens} |
| Cache Write Tokens | {cache_write_tokens} |
| Cost | ${cost_usd} |

## Files Modified

{List each file on its own line as: - path/to/file}
{If none detected: "No committed files detected."}

## Phase Timeline (Build Workers)

{Filter {SESSION_DIR}log.md for rows containing TASK_X — list each as:}
{| {HH:MM:SS} | {event} |}
{If no phase entries found: "No phase transitions recorded."}

## Review Verdicts (Review Workers)

| Review | Verdict |
|--------|---------|
| Code Style | {verdict} |
| Code Logic | {verdict} |
| Security | {verdict} |
{Omit rows for reviews that were not run.}
```

7. **Log** the event: `| {HH:MM:SS} | auto-pilot | WORKER LOG — TASK_X ({Build|Review}): {duration}m, ${cost}, {N} files changed |`

8. **If any step fails**, log: `| {HH:MM:SS} | auto-pilot | WORKER LOG FAILED — TASK_X: {reason} |` and continue. Never let worker log writing block the supervisor loop.
```

## Change 4: Add Step 8c — Generate Session Analytics

**Location**: After Step 8b (the `### Step 8b: Append to Session History` section ends around line 624)
**Change**: Add new Step 8c

Content:
```markdown
### Step 8c: Generate Session Analytics

After Step 8b completes (on every session stop):

1. **Collect worker log data**: Read all files in `{SESSION_DIR}worker-logs/`. For each file, extract: task_id, worker_type, duration, cost, total_tokens, files_modified count, review verdicts (for Review Workers).

2. **Compute session totals**:
   - Total duration: `session_stop_time - session_start_time` in minutes
   - Total cost: sum of all worker costs (exclude `"unknown"`)
   - Total tokens: sum of all worker total_tokens (exclude `"unknown"`)
   - Tasks completed: count of unique task_ids with COMPLETE outcome
   - Tasks failed: count of tasks in Failed Tasks table in state.md

3. **Compute per-task breakdown**: For each task_id, find its Build Worker log (if any) and Review Worker log (if any). Sum their costs and durations.

4. **Compute retry stats**: From `{SESSION_DIR}state.md` Retry Tracker table — count tasks with retry_count > 0 and sum total retries.

5. **Compute review quality**:
   - Count verdicts: PASS, PASS WITH NOTES, FAIL per review type
   - List tasks that had at least one FAIL or BLOCKING finding

6. **Count new lessons**: Run:
   ```
   git log --since="{session_start_time}" --pretty=format: --name-only -- .claude/review-lessons/ | grep -v '^$' | sort | uniq
   ```
   Count distinct files that changed. If git fails, set to `"unknown"`.

7. **Compute efficiency metrics**:
   - Average cost per task: total_cost / tasks_completed (if tasks_completed > 0)
   - Average duration per task: total_duration / tasks_completed (if tasks_completed > 0)
   - Total files changed: sum of files_modified counts across all worker logs

8. **Write** `{SESSION_DIR}analytics.md`:

```markdown
# Session Analytics — {SESSION_ID}

**Generated**: {current_datetime}
**Session**: {session_start_time} — {session_stop_time}

## Summary

| Metric | Value |
|--------|-------|
| Total Duration | {total_duration}m |
| Total Cost | ${total_cost} |
| Total Tokens | {total_tokens} |
| Tasks Completed | {tasks_completed} |
| Tasks Failed | {tasks_failed} |
| Tasks Blocked | {tasks_blocked} |
| Total Workers Spawned | {total_workers} |
| Total Files Changed | {total_files_changed} |

## Per-Task Breakdown

| Task | Type | Build Cost | Build Duration | Review Cost | Review Duration | Total Cost | Outcome |
|------|------|-----------|----------------|-------------|-----------------|------------|---------|
| TASK_X | FEATURE | $X.XX | Xm | $X.XX | Xm | $X.XX | COMPLETE |
{Rows for each task processed this session. Use "—" for missing worker types (e.g., no Review Worker yet).}

## Retry Stats

| Metric | Value |
|--------|-------|
| Tasks Requiring Retries | {N} |
| Total Extra Retries | {N} |
| Max Retries for Any Task | {N} |

## Review Quality

| Review Type | PASS | PASS WITH NOTES | FAIL |
|-------------|------|-----------------|------|
| Code Style | {N} | {N} | {N} |
| Code Logic | {N} | {N} | {N} |
| Security | {N} | {N} | {N} |

## Lessons Generated

| Metric | Value |
|--------|-------|
| Review Lesson Files Updated | {N} |

## Efficiency Metrics

| Metric | Value |
|--------|-------|
| Avg Cost per Task | ${X.XX} |
| Avg Duration per Task | {X}m |
| Total Files Changed (all workers) | {N} |
```

9. **Log** the event: `| {HH:MM:SS} | auto-pilot | ANALYTICS — {N} tasks completed, total ${X.XX} |`

10. **If analytics generation fails**, log a warning and continue — never let it block session stop.
```

## Summary of Changes

| Change | File | Location |
|--------|------|----------|
| Update files table | SKILL.md | Lines ~184-189 |
| Add 3 log events | SKILL.md | Session Log table |
| Add Step 7h (worker logs) | SKILL.md | After Step 7g |
| Add Step 8c (analytics) | SKILL.md | After Step 8b |

## Acceptance Criteria Verification

- [ ] Worker logs include phase timestamps → Phase Timeline section from log.md
- [ ] Worker logs include token count → Exit Stats table from get_worker_stats
- [ ] Worker logs include cost → Exit Stats table from get_worker_stats
- [ ] Worker logs include files modified → Files Modified section from git log --grep
- [ ] Review worker logs include review verdicts → Review Verdicts section
- [ ] analytics.md generated at supervisor stop → Step 8c
- [ ] Analytics include total cost/duration/tokens → Summary table
- [ ] Analytics include per-task breakdown → Per-Task Breakdown table
- [ ] Analytics include failure/retry stats → Retry Stats table
- [ ] Analytics include review scores summary → Review Quality table
