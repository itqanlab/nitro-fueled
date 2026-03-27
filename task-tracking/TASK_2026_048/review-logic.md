# Code Logic Review — TASK_2026_048

## Summary

The four specification files implement a coherent retrospective loop with reasonable safety rails. The happy path is well-described, but several logic gaps create conditions where a conflicting entry could slip through undetected, where the idempotency rule can be bypassed within the same day, and where critical AC items are partially or silently unaddressed.

## Review Scores

| Criterion | Score |
|-----------|-------|
| Acceptance criteria coverage | 6/10 |
| Logic correctness | 6/10 |
| Edge case handling | 4/10 |
| Safety (no stubs, no placeholders, no bypasses) | 5/10 |
| Overall Score | 5/10 |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **Conflict detection keyword match is too shallow.** Step 4 says "search for keywords related to the new entry." An LLM will decide what counts as a related keyword. If the new finding is "always validate IPC input" and the existing lesson says "sanitize renderer-sent data," the keyword overlap is low. The LLM may classify them as unrelated and auto-write a duplicate or contradicting entry. There is no specification of how to compute relatedness — similarity threshold, required overlap, or required exact-topic match.
- **"Recurring-despite-lesson" promotion gate is vague.** Step 5b says "Patterns that already have a matching lesson but keep being violated in 3+ tasks → promote to anti-patterns.md." "Matching lesson" uses the same fuzzy keyword logic. A lesson can be present yet not matched, leaving the promotion to the LLM's judgment with no checkable rule.
- **No-args mode uses session directory ambiguity.** Step 1 says "analyze the most recent session directory." Session directories are named `SESSION_YYYY-MM-DD_HH-MM-SS`. If two sessions ran on the same date, the "most recent" is the lexicographically last directory name. This is correct in practice, but the spec does not state the sort order. An LLM that sorts by creation time vs alphabetically vs modification time can pick a different session.
- **orchestrator-history.md Quality line metric "recurring patterns" is computed differently in two places.** In SKILL.md Step 8b it counts "unique finding categories that appeared in 3 or more tasks reviewed this session." In the command's Step 3, "recurring" means 3+ tasks across the analyzed scope, which may span multiple sessions. These two definitions are independent, but a future reader of orchestrator-history.md cannot tell whether the number refers to this-session or all-time. No label distinguishes them.

### 2. What user action causes unexpected behavior?

- **Running `/retrospective` twice on the same date for different scopes** (e.g., first `--since 2026-03-01`, then `--all`) will cause the idempotency rule to skip all writes on the second run even if the second scope covers new tasks not in the first run. The idempotency key is only the date. A user doing incremental analysis on the same calendar day gets silently blocked after the first run.
- **Running `/retrospective --since` with a date that has no `completion-report.md` files** will scan every TASK folder, find no valid dates, and correctly output the "no completed tasks" message — but the spec does not say whether it should still write an empty RETRO file. A partial file (header only) written then abandoned is not ruled out.
- **Running `/retrospective` immediately after a task is marked IMPLEMENTED (not COMPLETE)** will include it if reading the registry but exclude it when reading `completion-report.md` (which does not exist yet). The spec says read `completion-report.md` for verification, which is the right approach, but the registry-based `--all` path says "all tasks with status COMPLETE" — this is internally consistent. However, the default no-args path says "tasks completed in that session" without defining "completed" — it could be interpreted as any terminal state, not strictly COMPLETE.

### 3. What data makes this produce wrong results?

- **Review files with non-standard naming.** Step 2 reads `review-code-*.md` OR `code-style-review.md`, `code-logic-review.md`, `code-security-review.md`. The actual files in the repo use `review-code-logic.md`, `review-code-style.md`, `review-security.md` (confirmed in TASK_2026_036). The glob `review-code-*.md` catches the first two but misses `review-security.md` (which has no `code-` prefix). Pattern detection over security findings will be systematically incomplete.
- **Scores not present in completion-report.md (n/a rows).** A task whose review workers did not run will have no Review Scores table. The spec says write `n/a` if unavailable, but does not say whether to include such tasks in the average denominator. An LLM may include the task (as 0) or exclude it, producing different averages on different runs.
- **Multiple RETRO files exist but the most recent has a corrupt date in the filename.** The planner's `Step 1b` says "read the most recent one" — sorted how? Lexicographically on `RETRO_YYYY-MM-DD.md` works if dates are ISO-formatted, which the spec mandates. But a manually created file `RETRO_latest.md` would sort after all dated files alphabetically, causing the planner to read a wrong file.

### 4. What happens when dependencies fail?

- **`retrospectives/` directory missing on first run.** Step 5a says "create the directory if it does not exist." This is correctly specified.
- **`completion-report.md` present but Review Scores table is absent.** The spec says to read the table for scores. No fallback is given for a valid file without that specific table. The LLM may hallucinate a score or write `n/a` inconsistently.
- **Session log files missing (no sessions directory).** Step 2 reads `task-tracking/sessions/*/log.md`. If no sessions have been run (fresh project using retrospective for the first time), this glob returns nothing. The spec does not explicitly say this is graceful — it relies on the general "if metric unavailable, write n/a" rule in Important Rules, but the Worker Health section of the report has no explicit n/a fallback in its format template.
- **`task-tracking/registry.md` missing for `--all` mode.** No handling is specified. The command would likely error or produce empty results silently.

### 5. What's missing that the requirements didn't mention?

- **Previous retrospective comparison is specified in the task.md** ("comparison to previous retro") but is absent from the command spec entirely. The Quality Trends table has no comparison-to-previous column.
- **Conflict detection for anti-patterns.md specifically.** Step 4 says "before auto-writing any lesson or anti-pattern" — but anti-patterns.md has a distinct section-based format (headings like `## Silent Failures`). Checking for keyword conflicts in free-form paragraphs is different from checking in a lessons file where each line is a standalone rule. The spec does not distinguish between these two target formats.
- **No rate limit or guard on auto-apply volume.** If 20 new non-conflicting lessons emerge in one retrospective run, all 20 are auto-written. There is no PO review gate on volume — only on conflict. A single large `--all` run could substantially rewrite the lessons files without any human checkpoint.
- **The "violated existing lessons" finding type has no auto-apply action.** Pattern detection in Step 3 identifies "violated existing lessons" as a finding category, but Step 5b only auto-applies new lessons and promotes recurring patterns. A violated lesson never triggers any automatic reinforcement of the existing lesson's wording. The cycle of "lesson written, still violated" can loop indefinitely.

---

## Findings

### Blocking

**B1: Review file glob pattern misses `review-security.md`**

The command spec (Step 2) says read `review-code-*.md` OR `code-style-review.md`, `code-logic-review.md`, `code-security-review.md`. The actual naming convention in the repo is `review-code-style.md`, `review-code-logic.md`, `review-security.md`. The security file does not match either glob. Pattern detection over security findings will be systematically missing from every retrospective run. This means the "Recurring Patterns" table will never surface security anti-patterns from organic review data, which is precisely the highest-value signal the retrospective exists to capture.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/retrospective.md`, line 26.
Evidence: Confirmed by reading `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/TASK_2026_036/` — security review file is named `review-security.md`, not `review-code-security.md`.

**B2: Idempotency rule makes same-day re-runs across different scopes a no-op**

The idempotency key is `[RETRO_{YYYY-MM-DD}]`. If a user runs `/retrospective --since 2026-03-01` in the morning and then `/retrospective --all` in the afternoon of the same day, the afternoon run finds the tag already present and skips all writes — including lessons derived from the broader scope that weren't captured by the morning run. The second run produces a misleading "already applied" outcome. The idempotency rule conflates "the report for this date already exists" with "all safe updates for this date are already written," which is not true when scope changes.

Fix: the idempotency check should additionally verify whether the current scope is a strict subset of the previous scope. Or simpler: include scope hash or flag suffix in the tag, e.g., `[RETRO_2026-03-27--all]` vs `[RETRO_2026-03-27--since-2026-03-01]`.

**B3: Conflict detection relies on unspecified keyword similarity — no checkable rule exists**

Step 4 says "search for keywords related to the new entry" and "if an existing entry covers the same topic with a different conclusion." Neither "related" nor "same topic" is defined. There is no similarity threshold, no required exact-phrase match, no required field overlap. This is entirely at the LLM's judgment. In practice this means:

- Two entries can cover the same pattern and both be written if the LLM uses different words to describe them.
- A genuinely contradictory pair can both be written if the LLM judges their "topics" to be different.

The conflict detection spec gives the appearance of safety without providing an implementable rule. The "CRITICAL" label in the heading makes this worse — it signals to readers that the safety is robust.

---

### Serious

**S1: `orchestrator-history.md` Quality line "recurring patterns" metric is session-scoped but may be confused with all-time scope**

SKILL.md Step 8b says count "unique finding categories that appeared in 3 or more tasks reviewed this session." A session of 2 reviewed tasks will always write `0` regardless of historical patterns. But the `orchestrator-history.md` entry sits next to all-time metrics like total cost, and a reader has no way to know the recurring patterns count is session-scoped. The label should say "this session" or "session-scope."

More critically: Step 8b says "This data is already partially available from Step 8c; compute the Quality line using the same worker log collection pass." Step 8c runs AFTER Step 8b. The ordering is inverted. Step 8c is specified as running "After Step 8b completes." This means when Step 8b runs, Step 8c has not yet executed, so the worker log collection pass Step 8b references does not yet exist. The Quality line cannot use "the same worker log collection pass" from Step 8c if 8c hasn't run.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, lines 804-809, 816-818.

**S2: "Comparison to previous retro" from task.md AC is absent from command spec**

The task.md description says the Quality Trends section should include "comparison to previous retro." The command spec's report template (Step 5a) has no comparison column in the Quality Trends table and no instruction to read a prior RETRO file for baseline values. This is an accepted AC item that was not implemented.

**S3: No-args mode "most recent session" definition is ambiguous**

Step 1 says "analyze the most recent session directory." Sort order is not specified. The session directory names include timestamps in `YYYY-MM-DD_HH-MM-SS` format, which sort correctly lexicographically. But if any non-conforming directory exists under `task-tracking/sessions/`, lexicographic sort breaks. The spec should state: "the session directory whose name sorts last lexicographically among entries matching `SESSION_YYYY-MM-DD_HH-MM-SS`."

**S4: No auto-apply volume guard — large `--all` runs can rewrite lessons files without PO checkpoint**

A first run of `/retrospective --all` on a project with 48 completed tasks could generate dozens of non-conflicting new lessons, all auto-applied without any human review gate. The only gate is conflict detection. This is inconsistent with the project's principle of PO approval before significant changes. The spec should either cap auto-apply at N entries per run or present a preview list to the PO before writing.

**S5: "Violated existing lessons" finding type has no output action**

Step 3 identifies "Violated existing lessons" as a pattern type. Neither Step 5a nor Step 5b specifies any action for this finding beyond listing it. The report template has no section or column for violated lessons. The only output location is implicitly the Recurring Patterns table, but that table's header implies new patterns, not existing ones being re-violated. This finding category is collected but effectively discarded in the output pipeline.

---

### Minor

**M1: `--since` flag reads `completion-report.md` to verify date, but does not specify which field to read**

A `completion-report.md` does not have a standard date field in the spec or in the observed example (TASK_2026_036). The LLM must infer the completion date from context (e.g., task registry, file modification time, or report content). If the registry row is the authoritative date source, the spec should say so explicitly.

**M2: Worker Health report template has no n/a fallback row**

The report template's Worker Health table uses `N` placeholders. The Important Rules section says write "n/a" for unavailable metrics, but the template does not show the n/a form. When no session logs exist (fresh project), an LLM may write `0` (incorrect — 0 means zero events were detected, not that the data source is missing) or `n/a` inconsistently.

**M3: The scaffold copy (`packages/cli/scaffold/.claude/commands/retrospective.md`) is byte-for-byte identical to the primary command**

This is correct behavior for a scaffold file. However, there is no mechanism (in this or any spec) to keep the scaffold in sync with the primary. If the primary command is updated in a future task, the scaffold diverges silently. This is a process gap, not a logic bug in this implementation.

**M4: "Acknowledged-but-unfixed findings" in Step 3 has no corresponding report section**

The report template has no column or section for acknowledged-but-unfixed findings. These are collected in Step 3 but have no output location in Step 5a or Step 5b. They would have to be inferred as a sub-row of the Recurring Patterns table, which is not specified.

**M5: Planner's Pro Tips section (line 8 / section 12) partially duplicates the formal Retrospective Check in sections 3a and 3b**

The pro tip says "Check `task-tracking/retrospectives/` before planning new tasks." The formal protocol in 3a already mandates this check as Step 1b. Having it in both places creates a risk of future divergence if the formal protocol changes but the pro tip is not updated.

---

## Verdict

**PASS WITH NOTES**

The structural intent is sound and the happy path is specified well enough for an LLM to execute a useful first run. However, three issues must be addressed before this is production-reliable:

1. The security review file glob pattern must be corrected to match the actual naming convention (`review-security.md`). This is a functional bug that silently drops security data.
2. The conflict detection must be given a checkable rule — "same topic" must be defined in concrete terms, not left to LLM judgment.
3. The idempotency rule must handle multiple same-day runs with different scopes.

The remaining serious findings (execution order in 8b/8c, missing comparison-to-previous, volume guard) are real gaps but do not render the command dangerous or incorrect — they make it incomplete. They should be addressed in a follow-up task or as amendments before the first production run.
