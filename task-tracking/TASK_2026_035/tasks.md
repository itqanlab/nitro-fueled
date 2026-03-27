# Development Tasks - TASK_2026_035

**Total Tasks**: 4 | **Batches**: 2 | **Status**: 1/2 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- `code-style-reviewer.md` and `code-logic-reviewer.md` exist and are standalone — confirmed. No changes needed to either.
- `code-security-reviewer.md` does NOT exist — must be created. Confirmed via directory listing.
- Auto-pilot SKILL.md and orchestration SKILL.md exist at expected paths — confirmed.
- Model strings `claude-sonnet-4-6` and `claude-opus-4-5` are used in the existing codebase — confirmed from plan notes and state.md references.

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| review-lead.md is procedural prose — if steps are ambiguous, a Sonnet model may improvise incorrectly | HIGH | Use numbered steps for all phases; no prose paragraphs. Sub-worker prompt templates must be copy-paste ready with no placeholders requiring interpretation. |
| Auto-pilot SKILL.md edits may mis-scope — plan references line numbers that may have shifted | MED | Developer must read the actual file sections before editing, not assume line numbers are exact. Locate by section heading, not line number. |

---

## Batch 1: New Agent Files - IMPLEMENTED

**Developer**: systems-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Create review-lead.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md`
**Status**: IMPLEMENTED

**Description**: Create the Review Lead orchestrator agent. This is the most critical deliverable. It defines a 5-phase workflow:

**Phase 1 — Context Generation**
Generate `task-tracking/TASK_[ID]/review-context.md` before any sub-workers are spawned. Steps:
1. Read `task-tracking/TASK_[ID]/task.md` — extract File Scope section
2. Run `git log --oneline -10` to identify the implementation commit
3. Run `git diff [impl_commit]^ [impl_commit] -- [files]` to get the diff
4. Read `CLAUDE.md` — extract conventions relevant to file types changed
5. Read `.claude/review-lessons/review-general.md` — extract relevant rules
6. Write `task-tracking/TASK_[ID]/review-context.md` with: Task Scope, Git Diff Summary, Project Conventions, Style Decisions from Review Lessons, and Scope Boundary (CRITICAL) sections

**Phase 2 — Spawn Parallel Reviewers**
Call MCP `spawn_worker` three times WITHOUT waiting between calls. Model routing (hard-coded, not overridable):
- Style Reviewer: label `TASK_YYYY_NNN-REVIEW-STYLE`, model `claude-sonnet-4-6`
- Logic Reviewer: label `TASK_YYYY_NNN-REVIEW-LOGIC`, model `claude-opus-4-5`
- Security Reviewer: label `TASK_YYYY_NNN-REVIEW-SECURITY`, model `claude-sonnet-4-6`

Each sub-worker prompt must be fully self-contained (no conversation history). Include the three sub-worker prompt templates verbatim from implementation-plan.md (Style, Logic, Security prompts). On per-reviewer spawn failure: log, continue, mark as "skipped" — do not block.

**Phase 3 — Monitor and Collect**
Poll each sub-worker via `get_worker_activity` on a 2-minute interval. Mark `finished` workers as complete. Kill `stuck` workers after two consecutive stuck checks. Wait until all sub-workers reach `finished` or `failed`. Verify report files exist after all sub-workers finish. If a report file is missing, note the gap and continue. Continuation support: before spawning, check which report files already have a Verdict section — skip those reviewer types.

**Phase 4 — Fix Phase**
Apply fixes directly (do NOT spawn a Fix Worker). Priority order: Critical/Blocking > Serious > Minor. Steps:
1. Read all existing review reports
2. Build unified finding list sorted by severity
3. For each finding: read the relevant file, apply the fix
4. Only fix files within the task's File Scope
5. Out-of-scope findings go to `task-tracking/TASK_[ID]/out-of-scope-findings.md` — do NOT apply
6. After all fixes: `git add [changed files]` and commit with message `fix(TASK_[ID]): address review findings`
If fixes exceed 20 distinct changes, log partial fix note and continue.

**Phase 5 — Completion**
Execute the same Completion Phase as defined in `.claude/skills/orchestration/SKILL.md`:
1. Write `task-tracking/TASK_[ID]/completion-report.md` — include Review Scores table with scores from all three reports
2. Update `task-tracking/registry.md` — set status to COMPLETE (FINAL action before exit)
3. Update `task-tracking/plan.md` if it exists
4. Commit: `docs: add TASK_[ID] completion bookkeeping`

**Exit Gate** — verify before exiting:
- [ ] `review-context.md` exists
- [ ] At least 2 of 3 review report files exist (style + logic minimum)
- [ ] Fix commit exists in git log
- [ ] `completion-report.md` exists
- [ ] Registry shows COMPLETE for this task
- [ ] All changes are committed
If any check fails, attempt to fix it. If Exit Gate cannot be passed, write `exit-gate-failure.md` and exit.

**Frontmatter required**:
```yaml
---
name: review-lead
description: Review Lead orchestrator — spawns parallel reviewer sub-workers via MCP, collects results, applies fixes, completes task
---
```

**Style note**: Use numbered steps for all phases — no prose paragraphs. Sub-worker prompt templates must be copy-paste ready. Match the formatting conventions used in existing agent files.

**Spec Reference**: implementation-plan.md lines 33-271

---

### Task 1.2: Create code-security-reviewer.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/code-security-reviewer.md`
**Status**: IMPLEMENTED

**Description**: Create the standalone security reviewer agent. Model it on the structure of `code-style-reviewer.md` and `code-logic-reviewer.md` — reads task folder, runs review, writes `review-security.md`, exits.

**Frontmatter required**:
```yaml
---
name: code-security-reviewer
description: Security reviewer focusing on OWASP patterns, input validation, secret exposure, and injection vulnerabilities
---
```

**Mindset section**: Checklist-driven OWASP pattern matcher. Not a deep-reasoning reviewer. Looking for known vulnerability classes: input validation gaps, path traversal, secret exposure, injection points, insecure defaults. Also checks orchestration-specific risks: prompt injection in agent files, unsafe shell execution, unvalidated MCP inputs.

**Checklist section** — check all files in scope against:

For markdown agent/skill files:
- Prompt injection vectors (instructions that could override agent behavior)
- Hardcoded credentials or tokens in example code
- Shell commands that could be injected (e.g., unquoted variables)
- Path traversal risks in file operation instructions

For TypeScript/JavaScript files:
- `eval()` or `Function()` usage
- Unvalidated external input passed to shell commands
- Sensitive data written to logs
- Insecure `fs` operations (no path sanitization)
- Dependencies with known CVEs (check package.json)
- Hardcoded secrets / API keys

For configuration files:
- Tokens or secrets in config
- Overly permissive file/network permissions
- Exposed debug endpoints

**Required output format** — write `review-security.md` with this structure:
- Review Summary table: Overall Score (X/10), Assessment (APPROVED/NEEDS_REVISION/REJECTED), Critical Issues count, Serious Issues count, Minor Issues count, Files Reviewed count
- OWASP Checklist Results table: Input Validation, Path Traversal, Secret Exposure, Injection (shell/prompt), Insecure Defaults — each PASS/FAIL with notes
- Critical Issues section (file:line, problem, impact, fix)
- Serious Issues section (same format)
- Minor Issues section (brief list)
- Verdict: Recommendation (APPROVE/REVISE/REJECT), Confidence (HIGH/MEDIUM/LOW), Top Risk

**Mandatory lesson update**: After completing review, append new security patterns to `.claude/review-lessons/review-general.md` (or a new `security.md` if security-specific patterns accumulate).

**Spec Reference**: implementation-plan.md lines 275-358

---

**Batch 1 Verification**:
- Both files exist at their absolute paths
- Frontmatter is valid YAML
- review-lead.md uses numbered steps (not prose) for all phases
- Sub-worker prompt templates are present verbatim
- Exit Gate checklist is present in review-lead.md
- code-security-reviewer.md has all three checklist sections (markdown, TypeScript, config)
- code-security-reviewer.md has the OWASP checklist table in the output format

---

## Batch 2: Update Skill Files - IMPLEMENTED

**Developer**: systems-developer
**Tasks**: 2 | **Dependencies**: Batch 1 complete

### Task 2.1: Update auto-pilot/SKILL.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Status**: IN PROGRESS

**Description**: Four distinct changes to make in this file. Read the file first to locate section boundaries by heading — do not rely on line numbers from the plan as they may have shifted.

**Change 1 — Replace "First-Run Review Worker Prompt" section**
Locate the section headed "First-Run Review Worker Prompt" (currently around line 739). Replace its entire content with the new "First-Run Review Lead Prompt" template from implementation-plan.md lines 371-431. The new prompt instructs the Review Lead to: update registry to IN_REVIEW, verify MCP is available, check for existing artifacts (continuation support), generate review-context.md, spawn 3 sub-workers in parallel, monitor sub-workers every 2 minutes, apply fixes directly (no Fix Worker), commit fixes, execute Completion Phase, and pass the Exit Gate checklist.

**Change 2 — Replace "Retry Review Worker Prompt" section**
Locate the section headed "Retry Review Worker Prompt" (currently around line 808). Replace its entire content with the new "Retry Review Lead Prompt" from implementation-plan.md lines 433-465. This is the continuation-mode prompt for when a Review Lead was previously interrupted.

**Change 3 — Add model routing note in Step 5c**
Locate Step 5 of the Core Loop (the "Spawn Workers" step, around line 428-465). In the subsection that describes how `model` is passed to `spawn_worker`, add this note:
> For Review Lead workers, always pass `model: claude-sonnet-4-6` regardless of the task's Model field. The task's Model field applies to Build Workers only.

**Change 4 — Update state.md worker_type documentation**
Locate the section documenting the `state.md` active workers table format (around line 457). Update the `worker_type` field description to note that Review Lead workers have `worker_type = "ReviewLead"` (distinct from the old `"Review"` type) so the Supervisor can log correctly. Update any example state.md format entry accordingly.

**Style note**: Match existing style exactly — numbered lists, the same `{TASK_YYYY_NNN}` placeholder conventions, and the same EXIT GATE checklist format used in all other prompt templates in the file.

**Spec Reference**: implementation-plan.md lines 364-487

---

### Task 2.2: Update orchestration/SKILL.md - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md`
**Status**: IN PROGRESS

**Description**: Three distinct changes to make. Read the file first to locate sections by heading.

**Change 1 — Update Review Worker Exit Gate table**
Locate the "Review Worker Exit Gate" table (around lines 419-429). Find the row:
```
| Review files exist | Glob task folder for review-*.md | At least style + logic reviews present |
```
Replace it with two rows:
```
| Review files exist | Glob task folder for review-*.md | review-context.md + at least style + logic reviews present |
| Security review | Glob task folder for review-security.md | Present (or note if sub-worker failed) |
```

**Change 2 — Add Review Lead note in Completion Phase**
Locate the "Completion Phase" section (around lines 310-380). After the "Scope Note" at the top of that section, add this note block:
```
> **Review Lead Note**: In Review Lead mode (spawned by Supervisor using the
> Review Lead pattern), the completion phase is executed directly by the Review
> Lead after all sub-worker reviews are collected and fixes applied. The Review
> Lead reads the sub-worker reports directly from the task folder.
```

**Change 3 — Add review-context.md to Phase Detection table**
Locate the Phase Detection table (around lines 130-139). Add a new row for `review-context.md`:
```
| review-context.md  | Review Lead context generated — spawn sub-workers |
```
This allows continuation mode to resume correctly when a Review Lead was interrupted after context generation but before sub-worker spawning.

**Spec Reference**: implementation-plan.md lines 490-540

---

**Batch 2 Verification**:
- Both skill files have been modified (not rewritten)
- "First-Run Review Lead Prompt" heading replaces "First-Run Review Worker Prompt" heading
- "Retry Review Lead Prompt" heading replaces "Retry Review Worker Prompt" heading
- Model routing note is present in Step 5c of auto-pilot SKILL.md
- `worker_type = "ReviewLead"` documented in state.md format section of auto-pilot SKILL.md
- Review Worker Exit Gate table in orchestration SKILL.md has the two updated rows
- Review Lead Note is present in the Completion Phase of orchestration SKILL.md
- `review-context.md` row is present in the Phase Detection table of orchestration SKILL.md
