# Implementation Plan — TASK_2026_035

## Summary

Replace the monolithic Review Worker (one session, sequential style + logic + security reviews) with a two-tier pattern: the Supervisor spawns a **Review Lead** session, which then spawns three parallel reviewer sub-workers via MCP with model routing per review type. The Review Lead then applies fixes and handles completion.

This requires:
1. A new agent file: `.claude/agents/review-lead.md`
2. A new agent file: `.claude/agents/code-security-reviewer.md` (does not exist — must be created)
3. Modified prompt templates in `.claude/skills/auto-pilot/SKILL.md`
4. Minor updates to `.claude/skills/orchestration/SKILL.md`

---

## Investigation Findings

**Evidence base for this plan:**

- Auto-pilot SKILL.md:739-806 — Current "First-Run Review Worker Prompt" (the target to replace)
- Auto-pilot SKILL.md:808-861 — Current "Retry Review Worker Prompt" (also needs updating)
- Auto-pilot SKILL.md:428-465 — Step 5: Spawn Workers — where worker type and model are passed to MCP
- Auto-pilot SKILL.md:5b — `model` field from task.md is passed to `spawn_worker`; if absent/default, system default is used
- Orchestration SKILL.md:310-379 — Completion Phase that Review Lead must execute
- Orchestration SKILL.md:419-429 — Review Worker Exit Gate (Review Lead must still satisfy)
- `.claude/agents/code-style-reviewer.md` — Already standalone: reads task folder, writes report, exits. No changes needed.
- `.claude/agents/code-logic-reviewer.md` — Already standalone: reads task folder, writes report, exits. No changes needed.
- No `code-security-reviewer.md` exists in `.claude/agents/` — must be created.

---

## Files to Create

### 1. `.claude/agents/review-lead.md`

**Purpose**: Defines the Review Lead role — a lightweight Sonnet orchestrator that generates review context, spawns three parallel reviewer sub-workers via MCP, collects results, applies fixes, and completes the task.

**Key sections to include:**

#### Frontmatter
```yaml
---
name: review-lead
description: Review Lead orchestrator — spawns parallel reviewer sub-workers via MCP, collects results, applies fixes, completes task
---
```

#### Role description
The Review Lead is NOT a reviewer itself. It orchestrates review sub-workers. It runs in a dedicated MCP session with model `claude-sonnet-4-6`. Its job has four phases: Context, Spawn, Fix, Complete.

#### Phase 1: Context Generation

Before spawning reviewers, the Review Lead generates `task-tracking/TASK_[ID]/review-context.md` containing:

```markdown
# Review Context — TASK_[ID]

## Task Scope
- Task ID: [ID]
- Task type: [from task.md]
- Files in scope: [File Scope section from task.md — these are the only files reviewers may touch]

## Git Diff Summary
[Output of: git diff HEAD~1 -- [files in scope]]
[Or: git log --oneline -5 to find the implementation commit, then diff against it]
[List each file changed with a brief description of what changed]

## Project Conventions
[Key conventions from CLAUDE.md relevant to this task's file types]
[Example: "Agent files are markdown with YAML frontmatter. Skill files use pipe-table log format."]

## Style Decisions from Review Lessons
[Relevant rules from .claude/review-lessons/review-general.md]
[Include only rules relevant to the file types being reviewed]

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
[List from File Scope section of task.md]
Issues found outside this scope: document only, do NOT fix.
```

Generation steps:
1. Read `task-tracking/TASK_[ID]/task.md` — extract File Scope section
2. Run `git log --oneline -10` to identify the implementation commit
3. Run `git diff [impl_commit]^ [impl_commit] -- [files]` to get the diff
4. Read `CLAUDE.md` — extract conventions relevant to file types changed
5. Read `.claude/review-lessons/review-general.md` — extract relevant rules
6. Write `task-tracking/TASK_[ID]/review-context.md`

#### Phase 2: Spawn Parallel Reviewers

The Review Lead calls MCP `spawn_worker` three times **without waiting between calls** to achieve parallelism.

**Model routing table** (hard-coded in the Review Lead, not overridable at this stage):

| Review Type     | Model                | Rationale |
|-----------------|----------------------|-----------|
| Code Style      | claude-sonnet-4-6    | Pattern matching, conventions — no deep reasoning needed |
| Code Logic      | claude-opus-4-5      | Needs deep reasoning, edge case analysis |
| Security        | claude-sonnet-4-6    | Checklist-driven OWASP patterns |

**Sub-worker spawn parameters for each reviewer:**

Style Reviewer:
```
label: "TASK_YYYY_NNN-REVIEW-STYLE"
model: "claude-sonnet-4-6"
prompt: [see Sub-Worker Prompt Templates below]
working_directory: [project root]
```

Logic Reviewer:
```
label: "TASK_YYYY_NNN-REVIEW-LOGIC"
model: "claude-opus-4-5"
prompt: [see Sub-Worker Prompt Templates below]
working_directory: [project root]
```

Security Reviewer:
```
label: "TASK_YYYY_NNN-REVIEW-SECURITY"
model: "claude-sonnet-4-6"
prompt: [see Sub-Worker Prompt Templates below]
working_directory: [project root]
```

After all three `spawn_worker` calls succeed, record the three worker IDs.

**On spawn failure for any individual reviewer:**
- Log the failure
- Continue spawning remaining reviewers
- Mark the failed reviewer as "skipped" — do not block on it
- A skipped reviewer produces no report; the fix phase proceeds with reports that do exist

#### Sub-Worker Prompt Templates

Each sub-worker prompt must be **fully self-contained** — all context is in files, nothing in conversation history.

**Style Reviewer Prompt:**
```
You are the code-style-reviewer agent for TASK_[ID].

AUTONOMOUS MODE — no human at this terminal. Do NOT pause.

Your ONLY job:
1. Read task-tracking/TASK_[ID]/review-context.md (scope, conventions, git diff)
2. Read task-tracking/TASK_[ID]/task.md (File Scope section — review ONLY these files)
3. Read each file in the File Scope
4. Run your style review following your agent instructions
5. Write your report to task-tracking/TASK_[ID]/review-code-style.md
6. Append new lessons to .claude/review-lessons/review-general.md (or create if missing)
7. EXIT

Do NOT fix any issues. Do NOT modify source files. Write the report only.
Do NOT review files outside the task's File Scope.

Working directory: [project_root]
Task folder: task-tracking/TASK_[ID]/
Review context: task-tracking/TASK_[ID]/review-context.md
```

**Logic Reviewer Prompt:**
```
You are the code-logic-reviewer agent for TASK_[ID].

AUTONOMOUS MODE — no human at this terminal. Do NOT pause.

Your ONLY job:
1. Read task-tracking/TASK_[ID]/review-context.md (scope, conventions, git diff)
2. Read task-tracking/TASK_[ID]/task.md (File Scope section — review ONLY these files)
3. Read each file in the File Scope
4. Run your logic review following your agent instructions
5. Write your report to task-tracking/TASK_[ID]/review-code-logic.md
6. Append new lessons to .claude/review-lessons/review-general.md (or create if missing)
7. EXIT

Do NOT fix any issues. Do NOT modify source files. Write the report only.
Do NOT review files outside the task's File Scope.

Working directory: [project_root]
Task folder: task-tracking/TASK_[ID]/
Review context: task-tracking/TASK_[ID]/review-context.md
```

**Security Reviewer Prompt:**
```
You are the code-security-reviewer agent for TASK_[ID].

AUTONOMOUS MODE — no human at this terminal. Do NOT pause.

Your ONLY job:
1. Read task-tracking/TASK_[ID]/review-context.md (scope, conventions, git diff)
2. Read task-tracking/TASK_[ID]/task.md (File Scope section — review ONLY these files)
3. Read each file in the File Scope
4. Run your security review following your agent instructions
5. Write your report to task-tracking/TASK_[ID]/review-security.md
6. Append new lessons to .claude/review-lessons/review-general.md (or create if missing)
7. EXIT

Do NOT fix any issues. Do NOT modify source files. Write the report only.
Do NOT review files outside the task's File Scope.

Working directory: [project_root]
Task folder: task-tracking/TASK_[ID]/
Review context: task-tracking/TASK_[ID]/review-context.md
```

#### Phase 3: Monitor and Collect

Poll each sub-worker via MCP `get_worker_activity` on a 2-minute interval (lighter interval than Supervisor — sub-workers are faster and more focused than full build/review workers).

When checking each sub-worker:
1. Call `get_worker_activity(worker_id)`
2. If health is `finished`: mark that reviewer as complete
3. If health is `stuck` (two consecutive checks): call `kill_worker`, mark as failed (no report)
4. If health is `healthy` / `high_context` / `compacting`: wait next interval

**Wait until all sub-workers reach `finished` or `failed` state.**

After all sub-workers finish, verify report files exist:
- `task-tracking/TASK_[ID]/review-code-style.md` — from Style Reviewer
- `task-tracking/TASK_[ID]/review-code-logic.md` — from Logic Reviewer
- `task-tracking/TASK_[ID]/review-security.md` — from Security Reviewer

If a report file is missing (sub-worker failed without writing it), note the gap and continue. Do not halt if only one or two reviewers produced reports.

**Continuation support** (Review Lead was restarted):
- Check which report files already exist before spawning
- Skip spawning sub-workers for review types that already have a complete report file
- A report is "complete" if it contains a Review Summary table and a Verdict section

#### Phase 4: Fix Phase

The Review Lead applies fixes directly. It does NOT spawn a separate Fix Worker (simpler, faster, and the Review Lead has full context from all three reports).

Fix priority order:
1. **Critical / Blocking** issues from any review — fix first
2. **Serious** issues from any review — fix second
3. **Minor** issues — fix where practical

Steps:
1. Read all review reports that exist
2. Build a unified finding list sorted by severity (critical/blocking > serious > minor)
3. For each finding: read the relevant file, apply the fix
4. Only fix files within the task's File Scope (as listed in review-context.md)
5. If a finding references a file outside scope: add a note to `task-tracking/TASK_[ID]/out-of-scope-findings.md` — do NOT apply the fix
6. After all fixes are applied: `git add [changed files]` and commit with message: `fix(TASK_[ID]): address review findings`

If fixes are too extensive (more than 20 distinct changes across files), log a note that the Review Lead applied what it could, then continue to completion.

#### Phase 5: Completion

Execute the same Completion Phase defined in `.claude/skills/orchestration/SKILL.md` lines 310-379:
1. Write `task-tracking/TASK_[ID]/completion-report.md` (include Review Scores table with scores from all three reports)
2. Update `task-tracking/registry.md` — set status to COMPLETE
3. Update `task-tracking/plan.md` if it exists
4. Commit: `docs: add TASK_[ID] completion bookkeeping`

**Write registry update as the FINAL action before exit.**

#### Exit Gate

Before exiting, verify:
- [ ] `review-context.md` exists
- [ ] At least 2 of 3 review report files exist (style + logic minimum)
- [ ] Fix commit exists in git log
- [ ] `completion-report.md` exists
- [ ] Registry shows COMPLETE for this task
- [ ] All changes are committed

If any check fails, attempt to fix it. If Exit Gate cannot be passed, write `exit-gate-failure.md` and exit.

---

### 2. `.claude/agents/code-security-reviewer.md`

**Purpose**: Standalone security reviewer. Reads task folder + review-context.md, runs a security-focused review, writes `review-security.md`, exits. Modeled on the same structure as `code-style-reviewer.md` and `code-logic-reviewer.md`.

**Key sections to include:**

#### Frontmatter
```yaml
---
name: code-security-reviewer
description: Security reviewer focusing on OWASP patterns, input validation, secret exposure, and injection vulnerabilities
---
```

#### Mindset
Checklist-driven OWASP pattern matcher. Not a deep-reasoning reviewer — looking for known vulnerability classes: input validation gaps, path traversal, secret exposure, injection points, insecure defaults. Also checks orchestration-specific risks: prompt injection in agent files, unsafe shell execution, unvalidated MCP inputs.

#### Checklist

The security reviewer checks all files in scope against this checklist (adapted for this project's file types):

**For markdown agent/skill files:**
- Prompt injection vectors (instructions that could override agent behavior)
- Hardcoded credentials or tokens in example code
- Shell commands that could be injected (e.g., unquoted variables)
- Path traversal risks in file operation instructions

**For TypeScript/JavaScript files:**
- `eval()` or `Function()` usage
- Unvalidated external input passed to shell commands
- Sensitive data written to logs
- Insecure `fs` operations (no path sanitization)
- Dependencies with known CVEs (check package.json)
- Hardcoded secrets / API keys

**For configuration files:**
- Tokens or secrets in config
- Overly permissive file/network permissions
- Exposed debug endpoints

#### Required Output Format

```markdown
# Security Review — TASK_[ID]

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | X/10                                 |
| Assessment       | APPROVED / NEEDS_REVISION / REJECTED |
| Critical Issues  | X                                    |
| Serious Issues   | X                                    |
| Minor Issues     | X                                    |
| Files Reviewed   | X                                    |

## OWASP Checklist Results

| Category                    | Status  | Notes |
|-----------------------------|---------|-------|
| Input Validation            | PASS/FAIL | |
| Path Traversal              | PASS/FAIL | |
| Secret Exposure             | PASS/FAIL | |
| Injection (shell/prompt)    | PASS/FAIL | |
| Insecure Defaults           | PASS/FAIL | |

## Critical Issues
[Same format as code-style-reviewer.md — file:line, problem, impact, fix]

## Serious Issues
[Same format]

## Minor Issues
[Brief list]

## Verdict
**Recommendation**: APPROVE / REVISE / REJECT
**Confidence**: HIGH / MEDIUM / LOW
**Top Risk**: [Single biggest concern]
```

#### Mandatory Lesson Update

Same instruction as other reviewers: after completing review, append new security patterns to `.claude/review-lessons/review-general.md` (or a new `security.md` file if security-specific patterns accumulate).

---

## Files to Modify

### 1. `.claude/skills/auto-pilot/SKILL.md`

**Location of changes**: The "Worker Prompt Templates" section, specifically "First-Run Review Worker Prompt" (line 739) and "Retry Review Worker Prompt" (line 808).

**What to change:**

Replace the content of **"First-Run Review Worker Prompt"** (lines 739-806) with a new **"First-Run Review Lead Prompt"**:

```
REVIEW LEAD — TASK_YYYY_NNN

AUTONOMOUS MODE — no human at this terminal. Do NOT pause.

You are the Review Lead for TASK_YYYY_NNN. Your job is to orchestrate
parallel review sub-workers via MCP, then fix findings and complete the task.

Read your full instructions from: .claude/agents/review-lead.md

Follow these rules strictly:

1. FIRST: Update task-tracking/registry.md — set status to IN_REVIEW.
   This signals the Supervisor that review has begun.

2. Verify MCP is available: call mcp__session-orchestrator__list_workers.
   If MCP is unavailable, STOP and write exit-gate-failure.md explaining
   that MCP is required for parallel review spawning.

3. Check for existing review artifacts (continuation support):
   - review-context.md exists? -> skip context generation
   - review-code-style.md exists with Verdict? -> skip Style Reviewer spawn
   - review-code-logic.md exists with Verdict? -> skip Logic Reviewer spawn
   - review-security.md exists with Verdict? -> skip Security Reviewer spawn

4. Generate review-context.md (if not already done).

5. Spawn review sub-workers in parallel via MCP (for any not yet done):
   - Style Reviewer: model claude-sonnet-4-6
   - Logic Reviewer: model claude-opus-4-5
   - Security Reviewer: model claude-sonnet-4-6
   Full sub-worker prompts are in .claude/agents/review-lead.md.

6. Monitor sub-workers via mcp__session-orchestrator__get_worker_activity
   every 2 minutes until all reach finished or failed state.

7. Apply fixes directly (do NOT spawn a Fix Worker). Fix in priority order:
   critical/blocking first, then serious, then minor.
   Only fix files in the task's File Scope.

8. Commit fixes: git commit with message "fix(TASK_YYYY_NNN): address review findings"

9. Execute the Completion Phase (per .claude/skills/orchestration/SKILL.md):
   - Write completion-report.md
   - Update registry.md to COMPLETE (FINAL action before exit)
   - Update plan.md if it exists
   - Commit: "docs: add TASK_YYYY_NNN completion bookkeeping"

10. EXIT GATE — Before exiting, verify:
    - [ ] review-context.md exists
    - [ ] At least style + logic review files exist
    - [ ] Fix commit exists in git log
    - [ ] completion-report.md exists
    - [ ] Registry shows COMPLETE for this task
    - [ ] All changes are committed
    If any check fails, fix it. If you cannot pass, write exit-gate-failure.md.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

Replace the content of **"Retry Review Worker Prompt"** (lines 808-861) with a new **"Retry Review Lead Prompt"**:

```
REVIEW LEAD — CONTINUATION MODE
TASK_YYYY_NNN — retry attempt {N}

The previous Review Lead {reason: stuck / crashed / stopped}.

AUTONOMOUS MODE — follow these rules strictly:

1. FIRST: Ensure registry.md shows IN_REVIEW for this task.
   If it shows IMPLEMENTED, set it to IN_REVIEW.

2. Check existing review artifacts to determine where to resume:
   - review-context.md exists? -> context generation done
   - review-code-style.md with Verdict? -> style review done
   - review-code-logic.md with Verdict? -> logic review done
   - review-security.md with Verdict? -> security review done
   - Fix commit in git log? -> fix phase done
   - completion-report.md? -> completion phase done
   Resume from the first incomplete step.

3. For any review type not yet complete, spawn a sub-worker via MCP.
   Full spawn instructions in .claude/agents/review-lead.md.

4. Continue from where the previous Review Lead stopped.
   Do NOT restart completed phases.

5. Complete all remaining phases: fixes, completion, exit gate.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

**Also change**: The label format in Step 5c of the Core Loop (line ~451):
- Current: `"TASK_YYYY_NNN-TYPE-REVIEW"` (e.g., `"TASK_2026_003-FEATURE-REVIEW"`)
- No change needed to the label format — "REVIEW" still correctly describes the Review Lead worker

**Also change**: The "model" passed to `spawn_worker` for Review Lead:
- The Review Lead itself runs on `claude-sonnet-4-6` (lightweight orchestrator)
- The `model` field in task.md controls the Build Worker model, not the Review Lead
- The Review Lead prompt should instruct the worker to use `claude-sonnet-4-6` explicitly
- Add a note in Step 5c: "For Review Lead workers, always pass `model: claude-sonnet-4-6` regardless of the task's Model field. The task's Model field applies to Build Workers only."

**Also change**: Session log rows — add a new event row for the Review Lead spawning sub-workers. This happens inside the Review Lead session, not the Supervisor session, so no new Supervisor log rows are needed. The existing "Worker spawned" and "Review done" rows are sufficient.

**Also change**: The Review Worker Exit Gate check in the existing prompt at line 791. The new Review Lead Exit Gate now requires:
- `review-context.md` (new requirement)
- Style + logic review files (same as before)
- Security review file (new requirement — but treated as "at least 2 of 3")

Update the Exit Gate check in the Review Worker Prompt to add `review-context.md` and `review-security.md` as checks.

**Also change**: The "state.md" active workers table documentation (around line 457). Update the `worker_type` field description to note that Review Lead workers have `worker_type = "ReviewLead"` (distinct from the old `"Review"` type) so the Supervisor can log correctly. Update the example state.md format accordingly.

---

### 2. `.claude/skills/orchestration/SKILL.md`

**Location of changes**: The "Review Worker Exit Gate" table (line 419-429) and the Completion Phase section (lines 310-380).

**What to change:**

**In the Review Worker Exit Gate table** (line 419-429), update the "Review files exist" row:

Current:
```
| Review files exist | Glob task folder for review-*.md | At least style + logic reviews present |
```

Replace with:
```
| Review files exist | Glob task folder for review-*.md | review-context.md + at least style + logic reviews present |
| Security review | Glob task folder for review-security.md | Present (or note if sub-worker failed) |
```

**In the Completion Phase** section, update the Review Scores table in the completion-report.md template:

Current:
```markdown
## Review Scores
| Review | Score |
|--------|-------|
| Code Style | X/10 |
| Code Logic | X/10 |
| Security | X/10 |
```

This already includes Security — no change needed to the template itself.

**Add a new note** in the "Completion Phase" section (after the "Scope Note" at line 312):

```
> **Review Lead Note**: In Review Lead mode (spawned by Supervisor using the
> Review Lead pattern), the completion phase is executed directly by the Review
> Lead after all sub-worker reviews are collected and fixes applied. The Review
> Lead reads the sub-worker reports directly from the task folder.
```

**In the Phase Detection table** (line 130-139), add a new continuation checkpoint:

Current table has no entry for `review-context.md`. Add:
```
| review-context.md  | Review Lead context generated — spawn sub-workers |
```

This tells the orchestration skill (if ever invoked in continuation mode on a task that a Review Lead started) where to resume.

---

## Design Notes

### Why Review Lead applies fixes directly (not via Fix Worker)

Spawning a Fix Worker adds a third level of nesting (Supervisor → Review Lead → Fix Worker) and requires the Review Lead to wait for yet another worker, poll it, and handle its failures. The Review Lead already has all review context loaded — it is the correct agent to apply fixes. Fixes for agent/skill markdown files are also low-risk (no compilation, no tests to run), making direct application safe.

Exception: if a task's fixes involve TypeScript CLI code and the scope is large (20+ changes), the Review Lead should note this in the completion report as "partial fix — see review files for remaining findings." This is preferable to an unbounded fix session that risks context overflow.

### Why the Review Lead uses Sonnet (not Opus) for orchestration

The Review Lead's job during the orchestration phases (context generation, spawn, poll, fix coordination) is mechanical: read files, call MCP tools, write a markdown context file. It does not need deep reasoning for this. Sonnet is sufficient and reduces cost. The fix phase may occasionally encounter tricky logic — if the Review Lead is Sonnet and cannot confidently fix a complex logic issue, it should document the finding as "unable to fix — requires manual review" rather than producing a wrong fix.

### Continuation support design

Every phase the Review Lead completes writes a file to the task folder. This means any restart can determine exactly where to resume by checking which files exist. This follows the same pattern as Build Workers (checking for context.md, task-description.md, implementation-plan.md, tasks.md).

Continuation checkpoints:
- `review-context.md` exists → context phase done
- `review-code-style.md` with Verdict section → style sub-worker done
- `review-code-logic.md` with Verdict section → logic sub-worker done
- `review-security.md` with Verdict section → security sub-worker done
- Fix commit in `git log` with `fix(TASK_[ID]):` message → fix phase done
- `completion-report.md` exists → completion phase done

### Sub-worker failure handling

If a sub-worker fails (killed for being stuck, MCP error on spawn, or exits without writing a report file):
- The Review Lead logs the failure
- It does not retry the sub-worker (retry adds complexity; the Supervisor handles Review Lead retries at a higher level)
- It proceeds with whatever reports exist
- Minimum viable: style + logic reports. If both are missing, the Review Lead writes `exit-gate-failure.md` and exits — the Supervisor will retry the entire Review Lead

### Scope of changes to existing reviewer agents

Both `code-style-reviewer.md` and `code-logic-reviewer.md` are already standalone — they read task folder, write a report, exit. No changes are needed to their agent definitions.

The sub-worker prompts (in `review-lead.md`) override a few behaviors for sub-worker mode:
- "Do NOT fix issues" — reviewers only write reports; the Review Lead applies fixes
- "Do NOT pause" — autonomous mode
- "Write report to [specific path]" — explicit file path to avoid ambiguity

These overrides live in the sub-worker prompts, not in the agent files. The agent files remain unchanged and continue to work in interactive mode (e.g., when invoked directly via `/review-code`).

### Model string to use

Based on the current codebase, the model strings used in auto-pilot SKILL.md reference:
- `claude-opus-4-5` (from state.md format examples at line 457)
- `claude-sonnet-4-6` (current session model, as documented in system context)

Use these exact strings in the Review Lead agent:
- Style Reviewer: `claude-sonnet-4-6`
- Logic Reviewer: `claude-opus-4-5`
- Security Reviewer: `claude-sonnet-4-6`
- Review Lead itself: `claude-sonnet-4-6`

---

## Acceptance Criteria Mapping

| Acceptance Criterion | Implementation |
|---|---|
| Supervisor spawns Review Lead instead of monolithic Review Worker | New "First-Run Review Lead Prompt" in auto-pilot SKILL.md replaces "First-Run Review Worker Prompt" |
| Review Lead generates `review-context.md` before spawning reviewers | Phase 1 of review-lead.md |
| Review Lead spawns 3 parallel review sub-workers via MCP | Phase 2 of review-lead.md — three `spawn_worker` calls without waiting between them |
| Style and Security reviewers use Sonnet, Logic reviewer uses Opus | Model routing table in Phase 2 of review-lead.md; model passed explicitly in `spawn_worker` call |
| All 3 reviews run in parallel and produce independent report files | Sub-workers are spawned simultaneously; each writes its own file (review-code-style.md, review-code-logic.md, review-security.md) |
| Review Lead collects results and runs fix phase after all reviews complete | Phase 3 (monitor/collect) and Phase 4 (fix) of review-lead.md |
| Review Lead handles sub-worker failures | Per-reviewer failure handling in Phase 3: kill stuck workers, continue with partial results |
| Completion report, registry update, and lessons captured by Review Lead | Phase 5 (completion) of review-lead.md — mirrors existing Completion Phase from orchestration SKILL.md |
| Sub-workers respect task file scope | review-context.md includes explicit scope boundary; sub-worker prompts include "review ONLY files in File Scope" instruction |
| Total review phase wall time reduced (~40% faster) | 3 parallel reviews vs. 3 sequential reviews — wall time approaches time of slowest single reviewer |
| Total review phase cost reduced (~30-40% cheaper) | 2 of 3 reviewers use Sonnet; only Logic reviewer uses Opus |

---

## Files Summary

**CREATE:**
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/review-lead.md`
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/code-security-reviewer.md`

**MODIFY:**
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` — replace Review Worker prompt templates; add Review Lead model routing note in Step 5c; update state.md worker_type documentation
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md` — update Review Worker Exit Gate table; add Review Lead note in Completion Phase; add review-context.md to phase detection table

**NO CHANGES:**
- `.claude/agents/code-style-reviewer.md` — already standalone, no changes needed
- `.claude/agents/code-logic-reviewer.md` — already standalone, no changes needed

---

## Developer Notes

The developer implementing this task is working entirely with markdown files (agent definitions and skill documentation). There is no TypeScript code in scope. The primary skill is writing clear, unambiguous procedural instructions for AI agents.

The most critical deliverable is `review-lead.md` — it must be precise enough that a Sonnet model can follow it without improvising. Use numbered steps, not prose paragraphs, for all phases. The sub-worker prompt templates inside `review-lead.md` must be copy-paste ready — no placeholders that the Review Lead would have to interpret.

When writing the auto-pilot SKILL.md changes, match the existing style exactly: numbered lists, the same `{TASK_YYYY_NNN}` placeholder conventions, and the same EXIT GATE checklist format used in all other prompt templates in that file.
