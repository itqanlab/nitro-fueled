# Session Evaluation Research Report

**Date**: 2026-04-01
**Scope**: How to evaluate completed orchestration sessions in Nitro-Fueled for continuous
pipeline improvement, token waste reduction, and early failure detection.

---

## 1. Current State — What Data Exists

### 1a. Cortex DB — what is captured per session

The cortex DB (`packages/mcp-cortex/src/db/schema.ts`) is already rich. Here is what is
captured and what is not.

**Sessions table** — captures per-session aggregate:
- `supervisor_model`, `supervisor_launcher`, `mode` — who ran the session
- `total_cost`, `total_input_tokens`, `total_output_tokens` — aggregate token/cost
- `tasks_terminal`, `task_limit`, `loop_status`, `last_heartbeat`
- `config` (JSON blob), `started_at`, `ended_at`

**Workers table** — captures per-worker:
- `worker_type` (build / prep / implement / review / cleanup)
- `model`, `provider`, `launcher`
- `status` (active / completed / failed / killed)
- `stuck_count`, `compaction_count`
- `tokens_json` — full `WorkerTokenStats`: input, output, cache_creation, cache_read,
  combined, context_current_k, context_percent, compaction_count
- `cost_json` — input_usd, output_usd, cache_usd, total_usd
- `progress_json` — message_count, tool_calls, files_read, files_written, last_action
- `outcome`, `retry_number`
- `spawn_to_first_output_ms`, `total_duration_ms`
- `files_changed_count`, `files_changed` (JSON list)
- `review_result`, `review_findings_count`, `workflow_phase`

**Phases table** — captures per-phase within a worker:
- Phase name (PM / Architect / Dev / Review / Fix / Completion / other)
- `model`, `start_time`, `end_time`, `duration_minutes`
- `input_tokens`, `output_tokens`
- `outcome` (COMPLETE / FAILED / SKIPPED / STUCK)

**Reviews table** — captures per review:
- `review_type` (code-style / code-logic / security / visual / other)
- `score` (0–10)
- `findings_count`, `critical_count`, `serious_count`, `minor_count`
- `model_that_built`, `model_that_reviewed`

**Fix cycles table** — captures per fix round:
- `fixes_applied`, `fixes_skipped`, `required_manual`
- `model_that_fixed`, `duration_minutes`

**Handoffs table** — captures build-to-review handoff data:
- `files_changed`, `commits`, `decisions`, `risks`

**Compatibility table** — captures historical model/launcher/task-type outcomes:
- `outcome` (success / failed / killed), `duration_ms`, `cost_estimate`, `review_pass`

**Events table** — raw audit trail of all supervisor/worker events (typed, timestamped).

### 1b. Disk artifacts after a session

Per-task folder (`task-tracking/TASK_YYYY_NNN/`):
- `session-analytics.md` — outcome, duration, phases completed, files modified
- `handoff.md` — files changed, commits, decisions, known risks
- `completion-report.md` — review scores table, findings fixed, files modified, integration
  checklist
- `review-style.md`, `review-logic.md`, `review-security.md` — full review verdicts and
  finding lists (written by Review Workers)
- `status` — terminal status byte (COMPLETE / FAILED / BLOCKED)

Per-session folder (`task-tracking/sessions/SESSION_.../`):
- `log.md` — phase-level event log (timestamped pipe table)
- `state.md` — debug snapshot of supervisor loop configuration

Retrospectives (`task-tracking/retrospectives/`):
- `RETRO_YYYY-MM-DD.md` — cross-task pattern analysis, auto-applied lessons

### 1c. What is currently missing (gaps)

The following data points would be valuable for evaluation but are not being captured today:

| Missing Data Point | Why It Matters |
|--------------------|----------------|
| Fix cycle count per review type | Measures how bad each review category was — not just score but iteration depth |
| Review-lesson violation flag per task | Violating an existing lesson is worse than a new finding; not distinguished today |
| Token breakdown by phase (not just per worker) | Phases table has token fields but they are rarely populated by workers |
| Context % at start of each phase | Tells you whether a worker entered a phase already at high context pressure |
| Number of tool calls per phase | High tool-call-to-output ratio indicates thrashing / fix loop behavior |
| Reason for worker kill (structured enum) | `kill_worker` takes a freetext `reason`; no structured cause taxonomy |
| Handoff quality score | Handoffs are written but never scored; poor handoffs cause review workers to re-read unnecessary files |
| Task re-queue count (same task retried across sessions) | Not tracked; only retry_number per worker within a session is captured |
| Review pass on first attempt vs after fix cycle | `review_result` exists but the distinction "passed on first attempt" vs "passed after N fixes" is not stored |
| Session-level fix cycle total | Fix cycles are per-task; no session aggregate exists |
| Lesson violation count per worker | Workers have no signal for whether they violated lessons during their run |

---

## 2. Proposed Evaluation Rubric

A session evaluation score measures four orthogonal dimensions. Each dimension is scored
0–10. The overall session score is the weighted average.

### Dimensions and Weights

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Quality | 35% | The primary purpose of the pipeline is correct, reviewable code |
| Efficiency | 30% | Token cost and time are the economic constraint |
| Process | 20% | Correct phase sequencing and handoff quality predict future reliability |
| Outcome | 15% | Binary signal: did it actually ship? |

### Dimension 1: Quality (35%)

Measures how good the output was and how hard review had to work.

| Signal | Source | Scoring |
|--------|--------|---------|
| Average review score across all three review types | `reviews` table | 10 = avg ≥ 8.0, 5 = avg 6.0–7.9, 2 = avg < 6.0 |
| Review-lesson violation rate | `reviews` table + `review-lessons/` cross-check | 10 = 0 violations, 7 = 1–2, 4 = 3–5, 0 = 6+ |
| Blocking findings per task | `reviews.critical_count` + `reviews.serious_count` | 10 = 0 blockers avg, 7 = ≤ 2 avg, 3 = 3–5 avg, 0 = > 5 avg |
| Test pass rate | `task_test_reports.status` | 10 = all PASS, 5 = mixed, 0 = any FAIL |
| Fix cycle depth | `fix_cycles.fixes_applied` / total findings | 10 = ≤ 10%, 5 = 10–30%, 0 = > 30% needed fix cycles |

**Quality score** = weighted average of the five signals (equal weight within dimension).

### Dimension 2: Efficiency (30%)

Measures token and time waste relative to task complexity.

| Signal | Source | Scoring |
|--------|--------|---------|
| Cost per task (normalized by complexity) | `sessions.total_cost` / task count, adjusted for Simple/Medium/Complex | Benchmark: Simple = $0.50, Medium = $2.00, Complex = $5.00. Score = 10 if at or under benchmark, scales linearly to 0 at 3x benchmark |
| Compaction events per worker | `workers.compaction_count` | 10 = 0 compactions, 7 = 1 per session, 3 = 2, 0 = 3+ |
| Kill rate | `workers` killed / total spawned | 10 = 0%, 5 = ≤ 10%, 0 = > 20% |
| Retry rate | `workers.retry_number` > 0 / total workers | 10 = 0%, 6 = ≤ 15%, 3 = ≤ 30%, 0 = > 30% |
| Files read per task (proxy for over-reading) | `workers.progress_json.files_read` length avg | 10 = ≤ 15, 7 = ≤ 30, 3 = ≤ 50, 0 = > 50 |

**Efficiency score** = weighted average (equal weight within dimension).

### Dimension 3: Process (20%)

Measures whether the pipeline followed its own rules correctly.

| Signal | Source | Scoring |
|--------|--------|---------|
| Phase completion rate | Phases table: COMPLETE / (COMPLETE + FAILED + STUCK) | 10 = 100%, 7 = ≥ 90%, 3 = ≥ 75%, 0 = < 75% |
| Status transition correctness | Events + DB: did each task follow CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE without backtracking? | 10 = no skips, 0 = any skip detected |
| Handoff written before IMPLEMENTED | Handoffs table: created_at < IMPLEMENTED event timestamp | 10 = all tasks, 5 = ≥ 75%, 0 = < 75% |
| MCP dual-write compliance | Events: did workers emit IN_PROGRESS and IMPLEMENTED events? | 10 = all events present, 5 = some missing, 0 = majority missing |
| Session closed cleanly | `sessions.loop_status = 'stopped'` and `ended_at` populated | 10 = yes, 0 = no |

**Process score** = weighted average (equal weight within dimension).

### Dimension 4: Outcome (15%)

Binary and near-binary signals.

| Signal | Source | Scoring |
|--------|--------|---------|
| COMPLETE rate | tasks terminal COMPLETE / tasks started | 10 = 100%, 7 = ≥ 90%, 3 = ≥ 75%, 0 = < 75% |
| BLOCKED rate | tasks BLOCKED / tasks started | 10 = 0%, 5 = ≤ 10%, 0 = > 10% |
| Review pass on first attempt | `workers.review_result = 'PASS'` on first review worker per task (no preceding fix cycle) | 10 = ≥ 80%, 5 = ≥ 60%, 0 = < 60% |

**Outcome score** = weighted average (equal weight within dimension).

### Overall Score Formula

```
session_score = (quality * 0.35) + (efficiency * 0.30) + (process * 0.20) + (outcome * 0.15)
```

Score bands:
- **9–10**: Exceptional — no action required
- **7–8.9**: Healthy — minor lessons to capture
- **5–6.9**: Needs attention — patterns to address
- **3–4.9**: Poor — systemic issue in at least one dimension
- **0–2.9**: Critical — pipeline is not functioning correctly

---

## 3. What to Add to Logging

These are the specific new data points to capture, ordered by value-to-effort ratio.

### Priority 1 — High value, low effort (add to existing structures)

**a. Review-lesson violation flag per finding**

Currently: review files are plain text. The retrospective command does a text scan to
detect lesson violations after the fact.

Add: in the `reviews` table, add a `lesson_violations_count INTEGER DEFAULT 0` column.
The Review Worker should increment this whenever it detects a finding that matches a
lesson already in `review-lessons/`. This transforms the retrospective's expensive
post-hoc scan into a real-time tracked signal.

**b. Fix cycle linked to review type**

Currently: `fix_cycles` table exists but has no `review_type` foreign key. You cannot
tell whether fix cycles came from style, logic, or security findings.

Add: `review_type TEXT` column to `fix_cycles` table. Populate it when the Fix Worker
logs its cycle.

**c. "First-attempt pass" flag on workers**

Currently: `workers.review_result` says whether the review passed, but not whether a
fix cycle occurred first.

Add: `first_attempt_pass INTEGER DEFAULT 0` to `workers` (1 = review passed with no
preceding fix cycle for this task). Populate in the Completion Worker or supervisor
during reconciliation.

**d. Phase token fields — enforce population**

Currently: `phases.input_tokens`, `phases.output_tokens` exist in schema but are rarely
populated. Workers log phases via `log_phase()` but typically omit token fields.

Change: make token reporting required in `log_phase()` — the MCP tool should log a
warning event if a phase row is written with null tokens. Workers already have token
data in their `progress_json`; they just need to forward it.

**e. Context % at phase start**

Currently: `workers.tokens_json.context_percent` is updated periodically but there is no
per-phase snapshot.

Add: `context_percent_at_start REAL` to `phases` table. Populate it when the worker
calls `log_phase()` at phase entry. This lets you see whether a phase started with an
already-pressured context window — a leading indicator of compaction mid-phase.

### Priority 2 — Medium value, medium effort

**f. Structured kill reason enum**

Currently: `kill_worker(worker_id, reason?)` takes a freetext string. Reason is lost in
the events table as unstructured JSON.

Add: a `kill_reason` column to `workers` with CHECK constraint on values:
`'stuck' | 'timeout' | 'edit_loop' | 'context_full' | 'supervisor_drain' | 'manual' | 'other'`.
The supervisor already knows the cause when it calls `kill_worker` — it just needs to
write it to a typed field.

**g. Session-level fix cycle total**

Currently: fix cycles are only queryable per-task. There is no `total_fix_cycles` on
the sessions table, so evaluating session efficiency requires a JOIN query.

Add: `total_fix_cycles INTEGER DEFAULT 0` to `sessions`. Increment via a session update
call whenever a Fix Worker completes.

**h. Handoff quality score**

Currently: handoffs are written but never scored. A handoff with empty `decisions` and
`risks` is structurally identical to a rich handoff — the Review Worker cannot tell the
difference without reading the content.

Add: `quality_score REAL` to the `handoffs` table. The Review Worker (which reads the
handoff as its first action) should score it on a simple 3-point scale:
- 1.0 = all four sections populated with substantive content
- 0.5 = partially populated (missing risks or decisions)
- 0.0 = skeleton only (empty decisions, empty risks)

This is a 5-second read for the Review Worker and produces a signal with high predictive
value for review duration.

### Priority 3 — Lower frequency, higher effort

**i. Cross-session task retry count**

Currently: `workers.retry_number` tracks retries within a single session. A task that
fails, gets reset to CREATED, and retried in the next session starts from retry_number=0
again — the history is lost.

Add: `lifetime_retry_count INTEGER DEFAULT 0` to `tasks` table. Increment whenever a
task transitions from FAILED/BLOCKED back to CREATED (regardless of session). This
identifies chronic problem tasks.

---

## 4. Token Waste Patterns

Based on analysis of the orchestration skill, auto-pilot skill, session data from
RETRO_2026-03-30 (101 tasks, 147 sessions), and the DB schema, these are the top five
patterns driving unnecessary token consumption.

### Pattern 1 — Fix Cycle Loops (estimated impact: HIGH, ~25–35% of excess cost)

**What happens**: A Review Worker finds blocking issues. A Fix Worker is spawned. Fix
Worker makes partial changes. A second review finds more issues or re-finds the same
ones. Another fix cycle. This chain is the single largest driver of token waste per the
retrospective data: ~250 blocking findings across 101 tasks, ~215 fixed (meaning 35
acknowledged without fix and many requiring multiple fix iterations).

**Root cause**: Review Workers do not have a structured pre-check against existing
lessons before writing findings. They re-discover known bad patterns (23 tasks had `as`
assertions, 18 had hardcoded colors) that are already in `review-lessons/`. These
produce findings that trigger fix cycles for problems that could have been avoided at
implementation time.

**Mechanism**: Each extra fix cycle adds a full Review Worker spawn (full context
window) + a Fix Worker spawn. At 2 compaction events avg per complex task session
(memory data: "simple tasks burning $8–9 in Build Workers, 2 compactions"), a single
unnecessary fix cycle can double session cost.

**Mitigation**: Two interventions reduce this:
1. Build Workers should load `review-lessons/` summary during the Dev phase as an
   implementation checklist, not just as reference. This is currently optional.
2. Session evaluation scoring that surfaces high fix-cycle-depth sessions prompts lesson
   promotion faster.

### Pattern 2 — Compaction Under Context Pressure (estimated impact: HIGH, ~20–30% of excess cost)

**What happens**: A worker loads SKILL.md + reference files + task.md + handoff.md +
multiple code files + produces output, then compacts. After compaction, it must
re-establish context by re-reading key files. This doubles the token cost of the affected
phase.

**Root cause**: The auto-pilot SKILL.md explicitly calls this out with a Load-on-Demand
Protocol (load only the reference needed at the moment it's needed). But orchestration
workers still load reference files eagerly. The SKILL.md note "Re-read this block after
every compaction" itself costs tokens on every compaction event.

**Evidence**: RETRO_2026-03-30 Worker Health: 27 stuck-check events, 7 worker kills,
67 retries. Memory data cites 2 compactions on simple tasks reaching $8–9 cost. A
simple task should cost ≈$0.50.

**Mechanism**: Each compaction event causes the model to regenerate its context
summary (costing output tokens) and then re-read lost context (costing input tokens).
A context window at 80% usage before a compaction means ~80% of all previous input
tokens must be re-loaded.

**Mitigation**: Three interventions:
1. Enforce `context_percent_at_start` logging per phase. Any phase starting above 60%
   is a leading indicator — the supervisor can preemptively spawn a fresh worker.
2. Reduce SKILL.md size for orchestration workers. The orchestration SKILL.md is >10,000
   tokens. A 500-token "quick reference" header that covers 90% of cases, with the full
   spec available on-demand, would reduce cold-start cost substantially.
3. Cap `files_read` per phase at 15. The `progress_json.files_read` field already
   captures this; an alert when it exceeds 15 would catch over-reading workers early.

### Pattern 3 — Redundant Pre-Flight File Reads (estimated impact: MEDIUM, ~10–15% of excess cost)

**What happens**: The orchestration skill's CONTINUATION mode reads `registry.md`,
then task.md, then traverses the dependency chain reading status files. The auto-pilot
SKILL.md explicitly bans this pattern ("NEVER read task.md during pre-flight") but it
still occurs in orchestration workers because the orchestration skill has its own
pre-flight logic that does read task.md.

**Root cause**: Two different pre-flight specifications exist — the supervisor's
(DB-first, no file reads) and the orchestration worker's (file-based dependency
guardrail). In Supervisor mode, the dependency check has already been done by the
supervisor before spawning. The orchestration worker re-does it from files anyway.

**Mechanism**: For a task with 3 transitive dependencies, the pre-flight reads:
`registry.md` + `task.md` + 3x `status` files = 5 file reads before any work begins.
On a context window that is already 30% full from SKILL.md loading, this is meaningful
waste.

**Mitigation**: When a worker is spawned by the Supervisor (WORKER_ID present in
prompt), skip the file-based dependency guardrail — the supervisor has already validated
it. Add a single line to the orchestration SKILL.md: "If WORKER_ID is in the prompt, skip
Step B (Blocked Dependency Guardrail) — supervisor has pre-validated all dependencies."

### Pattern 4 — GLM Provider Failures Triggering Full Re-Spawns (estimated impact: MEDIUM, ~10–15% of excess cost)

**What happens**: GLM-5 workers fail or get stuck (70% success rate, 6 killed out of 20
spawns per RETRO_2026-03-30). The supervisor retries with Claude. The Claude worker
starts from scratch — it does not inherit any progress from the GLM worker.

**Root cause**: There is no partial progress handoff between providers. A GLM worker
that completed 60% of a task (wrote 3 of 5 subtasks) contributes nothing to the Claude
retry worker. The Claude worker re-reads all context and redoes completed work.

**Mechanism**: A failed GLM worker that had 2 compaction events spent approximately
$4–6 in wasted tokens. The Claude retry worker then spends another $2–3 to re-establish
context and redo work. Total waste per GLM kill: ~$6–9 on a task that should cost $2.

**Mitigation**: When a worker is killed, the supervisor should write a minimal "progress
snapshot" event to the handoffs table before killing. The retry worker reads this
snapshot to skip already-completed subtasks. This is a partial implementation of the
handoff mechanism that already exists for build-to-review handoffs.

### Pattern 5 — Over-Verbose Worker Prompt Templates (estimated impact: LOW-MEDIUM, ~5–10% of excess cost)

**What happens**: Worker prompts (in `references/worker-prompts.md`) include full role
descriptions, full SKILL.md references, and full task context in a single prompt blob.
The prompt itself consumes tokens before the worker takes its first action.

**Root cause**: Worker prompts are comprehensive by design — they need to establish
full context for an isolated worker session. But some content is redundant: the worker
will re-read SKILL.md, so duplicating its key rules in the prompt adds tokens without
adding information.

**Mechanism**: A Build Worker prompt that includes the full "HARD RULES" block from the
orchestration SKILL.md (which is already loaded by the worker on startup) doubles the
token cost of those rules. On 50 workers per session, this accumulates.

**Mitigation**: Audit worker prompt templates for content that duplicates what the worker
will independently load from SKILL.md. Replace duplicated rule blocks with a single line:
"Consult SKILL.md for full rules." Estimate reduction: 15–20% of prompt template size.

---

## 5. Recommended Architecture

### Evaluation Trigger

**Both per-task and per-session, but at different granularities.**

Per-task evaluation runs at task completion (inside the Completion Worker or as the
final supervisor step before marking COMPLETE). It computes task-level quality and
efficiency signals and writes them to the DB immediately. This makes the data available
for the session aggregate in real time.

Per-session evaluation runs after the supervisor's loop terminates (all tasks terminal
or `--limit` reached). It aggregates per-task signals into the session score and
produces the session evaluation report. This is the primary artifact for continuous
improvement.

### Where Evaluation Runs

**Not a separate worker. A supervisor-owned MCP tool.**

A separate worker adds a spawn overhead and a fresh context window for what is
essentially a DB aggregation query. The cortex MCP already has `get_session_telemetry`
(aggregated telemetry for a session: total cost, tokens, files changed, review findings,
avg latencies, breakdown by phase and model) and `get_session_summary`. These tools are
the right foundation.

Add a new MCP tool: `evaluate_session(session_id)`. This tool:
1. Reads the DB — sessions, workers, phases, reviews, fix_cycles, handoffs, events.
2. Computes the four-dimension score (Section 2 of this report).
3. Writes results to a new `session_evaluations` table (see below).
4. Returns the score card as structured JSON.

The supervisor calls `evaluate_session(session_id)` as the last step before `end_session()`.
The orchestration skill calls it at the end of interactive sessions too.

The `nitro-retrospective` command can call it for historical sessions to backfill scores.

### Output Format

Two artifacts are produced:

**DB record** (`session_evaluations` table — new table):
```sql
CREATE TABLE session_evaluations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id),
  quality_score   REAL NOT NULL,
  efficiency_score REAL NOT NULL,
  process_score   REAL NOT NULL,
  outcome_score   REAL NOT NULL,
  overall_score   REAL NOT NULL,
  score_version   TEXT NOT NULL DEFAULT '1.0',
  signals_json    TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

The `signals_json` column stores the full breakdown: every signal value that fed into
the score. This enables drill-down without re-computing.

**Markdown report** (`task-tracking/sessions/{SESSION_ID}/evaluation.md`):
```markdown
# Session Evaluation — {SESSION_ID}

## Score Card

| Dimension   | Score | Weight | Weighted |
|-------------|-------|--------|---------|
| Quality     | 7.2   | 35%    | 2.52    |
| Efficiency  | 6.1   | 30%    | 1.83    |
| Process     | 9.0   | 20%    | 1.80    |
| Outcome     | 8.5   | 15%    | 1.28    |
| **Overall** |       |        | **7.43**|

Band: HEALTHY

## Key Signals

### Quality
- Avg review score: 7.1/10
- Lesson violations: 3 (moderate)
- Blocking findings avg: 2.1 per task
- Fix cycle depth: 18% of findings required fixes

### Efficiency
- Cost per task: $1.82 (benchmark for complexity mix: $1.60)
- Compaction events: 4 across 6 workers
- Kill rate: 1/8 workers (12.5%)
- Retry rate: 2/8 workers (25%)

### Process
- Phase completion rate: 94%
- Status transition anomalies: 0
- Handoff written before IMPLEMENTED: 6/6 tasks (100%)

### Outcome
- COMPLETE rate: 5/6 tasks (83%)
- BLOCKED rate: 0/6 tasks
- First-attempt review pass: 4/6 tasks (67%)

## Top Waste Signals

1. Worker WID_abc killed after 2 compactions — TASK_2026_295 (cost: $4.20)
2. Fix cycle depth 45% on TASK_2026_297 — style findings (as assertions x3)
3. 38 files read by build worker on TASK_2026_298 (threshold: 15)

## Improvement Signals

- 3 lesson violations detected (same lessons: review-general.md/as-assertions x2, frontend.md/hardcoded-colors x1)
  → These lessons are being violated repeatedly. Consider promoting to anti-patterns.md.
- GLM worker killed: retry consumed $3.10 in duplicate work
  → Consider reducing GLM worker allocation for this task type (FEATURE).
```

### How Findings Feed Back into the Pipeline

Three feedback loops, ordered by automation level:

**Loop 1 — Automatic (no human in the loop)**:
When `evaluate_session()` detects a signal above a severity threshold (e.g., lesson
violation rate > 30%, or the same lesson violated 3+ times in a session), it appends
a proposed entry to a `pending_lessons` JSON column on the session_evaluations record.
The retrospective command reads these and presents them as the "Proposed Lessons" table
— this is already the pattern the retrospective uses. No new mechanism needed, just a
new source feeding the retrospective's existing pipeline.

**Loop 2 — PO-gated (human approves)**:
The session evaluation report's "Improvement Signals" section surfaces patterns that
require judgment: whether to demote a model, whether to add a guardrail, whether to
create a follow-up task. These are never auto-applied — they go into the "Proposed Tasks"
table of the next retrospective run, following the existing PO-approval workflow.

**Loop 3 — Metric-driven (continuous)**:
Session scores stored in the `session_evaluations` table enable trend queries:
"Is the average Quality score going up or down over the last 10 sessions?" The
`nitro-burn` command (which already provides cost analytics) is the natural home for a
`--trend` flag that renders session score history alongside cost history.

---

## 6. How Other AI Orchestration Systems Do This

Based on analysis of published patterns (as of early 2026):

### LLM-as-Judge Pattern

The dominant industry approach for evaluating LLM pipeline output is the LLM-as-Judge
pattern: a separate model (often a larger, more capable one) evaluates the output of
a task-performing model against a rubric. This is used in systems like DeepEval,
Ragas, and the Anthropic model card evaluation process.

**Relevance to Nitro-Fueled**: The Review Worker is already an LLM-as-Judge — it
evaluates the Build Worker's output. The gap is that the review output (score,
findings, fix cycles) is captured in a structured way in the DB, but the *session-level
pattern* across those reviews is not synthesized into a quality signal in real time. The
evaluation architecture proposed here closes that gap by aggregating the existing
review data into a session score.

**What Nitro-Fueled does better**: Most LLM-as-Judge systems evaluate single outputs.
Nitro-Fueled's reviewer operates on a full task with a handoff artifact, structured
acceptance criteria, and cross-checked file lists. This is a more grounded evaluation
than a single-prompt judge.

### Pipeline Scoring via Telemetry

Systems like LangSmith and Weights & Biases (W&B Weave) attach telemetry collectors to
LLM calls and aggregate per-run metrics (latency, cost, tool call counts, error rates).
They produce run-level scorecards automatically.

**Relevance**: The cortex DB already captures this data at a finer granularity than
LangSmith (it has per-phase breakdowns, per-worker kill reasons, handoff artifacts).
The missing piece is the aggregation-and-scoring layer, which is what `evaluate_session()`
provides.

**Key difference**: LangSmith scores individual traces. Nitro-Fueled needs to score
multi-worker orchestrated sessions where the relationship between workers (build →
review → fix) is the primary quality signal. Standard trace-level tools do not model
this relationship.

### Continuous Improvement Loops

The industry pattern for continuous improvement in AI pipelines is:
1. Capture → 2. Evaluate → 3. Identify patterns → 4. Update prompts/rubrics → 5. Measure delta.

The retrospective command (`/nitro-retrospective`) already implements steps 1, 3, 4,
and 5 (partially) over a filesystem-based data layer. The gap is step 2: there is no
formal session evaluation score, so "is this session better than the last one?" cannot
be answered with a number.

The architecture proposed here adds step 2, making the loop complete.

---

## 7. Suggested Next Tasks

| Title | Type | Rationale | Suggested Priority |
|-------|------|-----------|-------------------|
| Add `evaluate_session` MCP tool and `session_evaluations` DB table | FEATURE | Core infrastructure for all evaluation scoring. Unblocks all other evaluation tasks. | P1-High |
| Add per-phase token capture enforcement to `log_phase` MCP tool | FEATURE | Phase tokens are in schema but not populated. Required for efficiency scoring at phase granularity. | P1-High |
| Add `lesson_violations_count` to reviews table and Review Worker | FEATURE | Turns the most-violated metric (23x `as` assertions in one retro) into a real-time signal rather than a post-hoc text scan. | P1-High |
| Add `context_percent_at_start` to phases table and worker emission | FEATURE | Leading indicator for compaction pressure mid-phase; enables proactive supervisor response. | P2-Medium |
| Add structured `kill_reason` enum to workers table and supervisor | FEATURE | GLM failures account for ~15% of cost overhead; structured reasons enable model routing improvement. | P2-Medium |
| Add `first_attempt_pass` flag to workers and Completion Worker | FEATURE | Distinguishes "good review" from "review that passed only after fix cycles." Key quality signal. | P2-Medium |
| Build `--evaluate-session` flag on `nitro-burn` command | FEATURE | Renders session score history alongside cost trends. Closes the "is the pipeline improving?" feedback loop. | P2-Medium |
| Reduce orchestration SKILL.md to a 500-token quick-reference header | REFACTORING | Cuts cold-start context cost for every orchestration worker. Estimated 10–15% reduction in per-worker baseline cost. | P2-Medium |
| Skip file-based dependency guardrail when WORKER_ID is in prompt | BUGFIX | Eliminates redundant pre-flight file reads in Supervisor-spawned workers. Low-risk, high-frequency saving. | P2-Medium |
| Implement progress snapshot on worker kill for retry workers | FEATURE | Prevents Claude retry workers from redoing work already completed by a killed GLM worker. Addresses Pattern 4. | P3-Low |

---

## Summary

**What the system already does well**: The cortex DB schema is comprehensive. The
review pipeline (Review Worker + fix cycle + completion report) produces structured,
queryable data. The retrospective command successfully detects cross-task patterns and
promotes lessons. The session-analytics.md and handoff.md artifacts provide per-task
ground truth. The `get_session_telemetry` MCP tool already aggregates most of the raw
material needed for evaluation.

**The single biggest gap**: There is no session-level evaluation score. Retrospectives
analyze patterns after the fact across many tasks. But there is no answer to the
question "was session X better or worse than session Y, and why?" Building
`evaluate_session()` as an MCP tool with a four-dimension rubric and a
`session_evaluations` table closes this gap with minimal new infrastructure.

**The top token waste patterns to address first**: Fix cycle loops (caused by lessons
not being checked at implementation time) and compaction under context pressure
(caused by large SKILL.md files and over-reading workers) account for an estimated
45–65% of excess token cost. Both are addressable without architectural changes.

**Recommended implementation order**:
1. `evaluate_session` MCP tool + `session_evaluations` table (unblocks everything)
2. Phase token enforcement + `context_percent_at_start` (efficiency scoring foundations)
3. `lesson_violations_count` on reviews (turns the most-violated retro signal into real-time data)
4. SKILL.md compression + skip-guardrail-in-supervisor-mode (immediate cost reduction)
5. Session score trend in `nitro-burn` (closes the feedback loop)
