# Task: /retrospective Command — Post-Session Analysis and Learning Loop

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |

## Description

Build a `/retrospective` command that analyzes completed work, detects recurring patterns, auto-updates review lessons and anti-patterns, and proposes tasks for systemic issues. This closes the feedback loop: Operations → Errors → Analysis → Improvements → Better Operations.

### Usage

```
/retrospective                    # analyze last session
/retrospective --all              # analyze all completed tasks
/retrospective --since 2026-03-25 # analyze from date
```

### Analysis Pipeline

**Step 1 — Collect** (read existing artifacts)
- All `completion-report.md` files → review scores, findings fixed, findings acknowledged
- All `review-code-*.md` files → blocking/serious/minor counts by category
- Session logs (from `sessions/` or `orchestrator-history.md`) → worker failures, stuck events, retries, cost
- `review-lessons/` → existing lessons
- `anti-patterns.md` → existing anti-patterns

**Step 2 — Pattern Detection**
- Same finding type in 3+ tasks → systemic issue
- Review scores below 6/10 → which task types/complexities produce worse code?
- Worker stuck/killed rate → what causes failures?
- Acknowledged-but-not-fixed findings → tech debt accumulating
- Lessons that exist but keep being violated → lesson is unclear or too weak

**Step 3 — Conflict Detection** (critical safety check)
Before auto-writing any lesson or anti-pattern:
- Read all existing entries in the target file
- Search for related keywords/topics
- If an existing entry covers the same topic with a different conclusion → CONFLICT
- Conflicts go to the report as "CONFLICT — needs PO decision" and are NOT auto-written
- Only write when no conflict exists

**Step 4 — Output**

4a. **Persist report** → `task-tracking/retrospectives/RETRO_{date}.md` with:
- Quality trends (avg scores, blocking counts, comparison to previous retro)
- Recurring patterns (with task IDs and finding categories)
- Worker health (stuck rate, kill rate, retry rate)
- Conflicts detected (existing lessons vs new findings)
- Proposed tasks (systemic issues that need dedicated work)

4b. **Auto-apply safe updates**:
- New lessons with no conflicts → append to `review-lessons/`
- Patterns recurring despite existing lesson → promote to `anti-patterns.md`
- Tag each with `[RETRO_{date}]` source for traceability

4c. **Present to PO**:
- Conflicts requiring decision
- Proposed tasks (never auto-create — wait for approval)
- Summary of what was auto-applied

### Planner Integration

Update `planner.md` to check for retrospective reports during `/plan` and `/plan status`:
- If `task-tracking/retrospectives/` has reports, read the most recent one
- Factor findings into task prioritization
- Surface unresolved conflicts or proposed tasks that haven't been actioned

### Supervisor Integration

At auto-pilot shutdown, add 3-4 lines of quality metrics to `orchestrator-history.md`:
```
**Quality**: avg review 6.5/10, 3 blocking fixed, 1 recurring pattern
```
This gives a quick signal without running the full retrospective.

## Dependencies

- None (reads existing artifacts, works with or without session directories from TASK_2026_034)

## Acceptance Criteria

- [ ] `/retrospective` command reads all completion reports and review files
- [ ] Pattern detection identifies findings appearing in 3+ tasks
- [ ] Conflict detection checks existing lessons/anti-patterns before writing
- [ ] Conflicts flagged as "PO decision required" — never auto-written
- [ ] Safe updates auto-appended to review-lessons with `[RETRO_{date}]` tag
- [ ] Recurring-despite-lesson patterns promoted to anti-patterns.md
- [ ] Report persisted to `task-tracking/retrospectives/RETRO_{date}.md`
- [ ] Proposed tasks presented to PO without auto-creating
- [ ] Planner reads most recent retrospective on `/plan` and `/plan status`
- [ ] Auto-pilot shutdown writes quality summary to orchestrator-history.md
- [ ] `--all` and `--since` flags work for scoping the analysis window

## References

- `.claude/review-lessons/` — existing review lessons
- `.claude/anti-patterns.md` — existing anti-patterns checklist
- `task-tracking/*/completion-report.md` — per-task completion data
- `task-tracking/*/review-code-*.md` — per-task review findings
- `.claude/agents/planner.md` — Planner consultation flow (Sections 3a, 3b)
- `.claude/skills/auto-pilot/SKILL.md` — supervisor shutdown sequence

## File Scope

- `.claude/commands/retrospective.md`
- `.claude/agents/planner.md`
- `.claude/skills/auto-pilot/SKILL.md`
- `packages/cli/scaffold/.claude/commands/retrospective.md`
