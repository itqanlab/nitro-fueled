# Retrospective — Post-Session Analysis and Learning Loop

Analyze completed tasks for recurring patterns, update review lessons, and propose improvements.

## Usage

```
/retrospective                    # analyze last session
/retrospective --all              # analyze all completed tasks
/retrospective --since 2026-03-25 # analyze from date
```

## Execution

### Step 1 — Parse Arguments

- No args: analyze the most recent session directory (`task-tracking/sessions/*/`) and tasks completed in that session.
- `--all`: include all tasks with status `COMPLETE` in `task-tracking/registry.md`.
- `--since YYYY-MM-DD`: include tasks with a completion date on or after the given date. Read each candidate `completion-report.md` to verify completion date.

### Step 2 — Collect Data

Read these artifacts for every task in scope:

- `task-tracking/TASK_*/completion-report.md` — Review Scores table (style/logic/security scores), findings fixed count, files modified count.
- `task-tracking/TASK_*/review-code-*.md` OR `task-tracking/TASK_*/code-style-review.md`, `code-logic-review.md`, `code-security-review.md` — blocking/serious/minor finding counts, verdicts per review type.
- `task-tracking/sessions/*/log.md` — stuck and killed events, retry events.
- `.claude/review-lessons/*.md` — existing lessons content (all files).
- `.claude/anti-patterns.md` — existing anti-patterns.

If no completion reports exist within the analyzed scope, output: "No completed tasks found in the analyzed scope." and stop.

### Step 3 — Pattern Detection

Scan findings across all tasks in scope and identify:

- **Recurring findings**: same finding type or category appearing in 3 or more tasks → systemic issue. Group by category (e.g., "File size violation", "Missing access modifier", "Missing error handling").
- **Low-scoring task types**: review scores below 6/10 — note which task types or complexity levels correlate with lower scores.
- **Worker health issues**: count stuck events and killed events from session logs; identify what precedes stuck events (task type, complexity, phase).
- **Acknowledged-but-unfixed findings**: findings marked acknowledged but not resolved across multiple tasks — accumulating tech debt.
- **Violated existing lessons**: findings that match an existing lesson in `.claude/review-lessons/*.md` — the lesson exists but is still being violated.

### Step 4 — Conflict Detection (CRITICAL)

Before auto-writing any lesson or anti-pattern:

1. Read ALL existing entries in the target file.
2. Search for keywords related to the new entry.
3. If an existing entry covers the same topic with a **different** conclusion or contradicts the new entry → mark as CONFLICT.
4. Conflicts MUST NOT be auto-written. Record them in the report under "Conflicts Detected" for PO decision.
5. Only write entries with zero conflicts.

### Step 5 — Output

#### 5a. Persist Report

Write to `task-tracking/retrospectives/RETRO_{YYYY-MM-DD}.md` (create the `retrospectives/` directory if it does not exist):

```markdown
# Retrospective Report — RETRO_{YYYY-MM-DD}

## Scope
[Time range or task list analyzed — e.g., "Session SESSION_2026-03-27_06-29-32 (N tasks)" or "All completed tasks (N total)"]

## Quality Trends

| Metric | Value |
|--------|-------|
| Tasks Analyzed | N |
| Avg Code Style Score | X/10 |
| Avg Code Logic Score | X/10 |
| Avg Security Score | X/10 |
| Total Blocking Findings | N |
| Blocking Findings Fixed | N |
| Blocking Findings Acknowledged | N |

## Recurring Patterns (3+ tasks)

| Pattern | Count | Task IDs | Category |
|---------|-------|----------|----------|

## Worker Health

| Metric | Value |
|--------|-------|
| Workers Stuck | N |
| Workers Killed | N |
| Total Retries | N |
| Sessions Analyzed | N |

## Conflicts Detected (PO Decision Required)

| Topic | Existing Entry | New Finding | Source Tasks |
|-------|----------------|-------------|--------------|

## Auto-Applied Updates

| Type | File | What Was Added | Source Tag |
|------|------|----------------|------------|

## Proposed Tasks

| Title | Type | Rationale | Suggested Priority |
|-------|------|-----------|-------------------|
```

#### 5b. Auto-Apply Safe Updates

Only apply entries with no conflicts:

- New lessons with no conflicts → append to the appropriate `.claude/review-lessons/*.md` file, tagged `[RETRO_{YYYY-MM-DD}]`.
- Patterns that already have a matching lesson but keep being violated in 3+ tasks → promote to `.claude/anti-patterns.md`, tagged `[RETRO_{YYYY-MM-DD}]`.

**Idempotency rule**: Before writing any entry, search the target file for an existing `[RETRO_{YYYY-MM-DD}]` tag with the same source date. If found, skip — the retrospective for this date has already been applied.

#### 5c. Present to User

After writing the report and applying safe updates:

1. Show the conflicts table — these require PO decision before anything is written.
2. Show the proposed tasks table — NEVER auto-create tasks, only propose.
3. Summarize what was auto-applied (lessons added, anti-patterns promoted).

## Important Rules

- NEVER auto-create tasks — propose only, always wait for explicit PO approval.
- NEVER auto-write conflicting entries — flag every conflict for PO decision.
- All auto-applied entries must carry a `[RETRO_{YYYY-MM-DD}]` tag for traceability.
- Running the command twice on the same date must not duplicate entries (idempotency via date tag check).
- If a metric is unavailable (e.g., no review workers ran), write "n/a" for that value.

## Skill Path

`.claude/skills/orchestration/SKILL.md` — not invoked directly; this command is self-contained.
