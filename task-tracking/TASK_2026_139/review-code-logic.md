# Code Logic Review — TASK_2026_139

## Verdict: PASS_WITH_NOTES
Score: 7/10

---

## Acceptance Criteria Coverage

| AC | Status | Notes |
|----|--------|-------|
| Supervisor queries `query_tasks` instead of reading registry.md in the core loop | COVERED | Step 2 cortex path documents `get_tasks()` replacing registry.md reads |
| Supervisor queries `query_tasks` for status instead of reading per-task status files | COVERED | Step 7a cortex path documented in cortex-integration.md |
| Dependency graph built from `tasks` table query, not file reads | COVERED | Step 3 + cortex-integration.md Step 3 section |
| Events logged via `log_event` instead of appending to log.md | COVERED | Event Logging Cortex Path section in parallel-mode.md |
| log.md rendered from DB at session end (human-readable audit trail preserved) | COVERED | Step 8b cortex path renders log.md via `query_events` before history append |
| Session state persisted via cortex instead of state.md overwrites | PARTIAL | state.md still written as snapshot alongside cortex calls — by design, but the AC says "instead of", which is not what the implementation says (both run). Not a bug — the handoff documents this as intentional. No blocking issue. |
| orchestrator-history.md replaced by `query_events` | PARTIAL | Step 8b explicitly preserves the file-append on BOTH paths ("Do NOT skip it"). The cortex-integration.md summary says "both paths run". The AC says "replaced by" — the implementation adds cortex as additive, not a replacement. Same deliberate design choice documented in handoff decisions. Not a blocking issue. |
| Fallback to file-based reads when cortex_available = false | COVERED | Every new section has a documented fallback path |
| `escalate_to_user` config option added, default false | COVERED | SKILL.md config table updated |
| Token savings verified: supervisor loop overhead reduced by ~95% | MISSING | No documentation of token savings analysis or verification anywhere in the changed files. This AC was likely aspirational/post-implementation verification, not a documentation requirement. Noted but not blocking for a documentation task. |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `escalate_to_user=false` NEED_INPUT suppression path has no documented behavior when `escalate_to_user = false` AND a worker has emitted `NEED_INPUT`. The event sits in the DB unacknowledged — the supervisor simply never calls `query_events(event_type='NEED_INPUT')`. This is logically sound but **nothing documents what happens to the NEED_INPUT event**. It is never acknowledged, never logged as "seen and skipped", and persists in the DB indefinitely. Future sessions that enable `escalate_to_user=true` may surface stale NEED_INPUT events from prior runs.

### 2. What user action causes unexpected behavior?

A user running two parallel sessions where session A has `escalate_to_user=true`: step 7f-escalate calls `query_events(session_id={session_id}, event_type='NEED_INPUT')`. The `session_id` filter isolates queries correctly. This path looks safe. However, a user who enables `--escalate`, then starts a session without cortex (cortex_available=false), sees only "ESCALATE disabled — cortex unavailable" in SKILL.md inline text — **but the actual log row written at runtime per log-templates.md is `ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false`**. These are not identical strings. An implementer reading SKILL.md to know what to log will write the wrong string.

### 3. What data makes this produce wrong results?

The SUPERVISOR_COMPLETE event's `data` payload in the event mapping table (line 1281) lists `completed, failed, blocked` as data keys. The actual `log_event` call in Step 8b.2b includes `total_cost_usd` and `stop_reason` in addition to those three keys. The mapping table is a subset — it doesn't say "at minimum these keys", it implies these are all the keys. An implementer using the mapping table as the definitive schema for the SUPERVISOR_COMPLETE data payload will omit `total_cost_usd` and `stop_reason`, producing an incomplete event record in the DB.

### 4. What happens when dependencies fail?

All new cortex calls are documented as best-effort with explicit fallback paths — this is consistently applied. `end_session()` failure is logged and swallowed. `log_event()` failure is logged and swallowed. `read_handoff()` failure skips injection but does not block spawn. These failure modes are handled correctly.

One gap: `query_events(session_id=X)` in Step 8b (the log.md render step) — if this call fails, there is no documented behavior. Does the supervisor skip the render and continue with whatever log.md already has? Does it abort Step 8b? The text says "call `query_events(session_id={session_id})`" then "Use the returned events to verify log.md is complete" — no failure branch is written for this call despite the rest of the section being best-effort oriented.

### 5. What's missing that the requirements didn't mention?

**Stale NEED_INPUT event accumulation**: When `escalate_to_user=false`, NEED_INPUT events accumulate unacknowledged in the cortex DB across sessions. No TTL, no cleanup, no acknowledgment. A later run with `--escalate` enabled will surface all prior unacknowledged questions, potentially from tasks already COMPLETE.

**`cortex_available` detection timing for sequential mode**: sequential-mode.md says cortex detection happens "at startup (same as parallel mode — call `get_tasks()` in step 4, set flag)." Step 4 of sequential mode is "Read registry once" — but the note says "call `get_tasks()` in step 4, set flag, cache for session." This instruction is embedded after the teardown block in sequential-mode.md as a note, making it easy to miss. The ordering of where cortex detection is actually documented relative to where it logically belongs (early in sequential flow, not as a note after step 7) is confusing and could cause an implementer to miss it.

---

## Findings

### Serious — parallel-mode.md: Event Logging mapping table — SUPERVISOR_COMPLETE data schema is incomplete

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Event type mapping table (line ~1281)

The mapping table row for `SUPERVISOR STOPPED` → `SUPERVISOR_COMPLETE` lists `data keys: completed, failed, blocked`. The actual call in Step 8b.2b sends `{ completed, failed, blocked, total_cost_usd, stop_reason }`. An implementer building the log_event call from the mapping table will produce a SUPERVISOR_COMPLETE event missing two fields that are critical for analytics queries (`total_cost_usd` for cost tracking, `stop_reason` for session health analysis). The table is the only place in the document that defines the event schema — it should be authoritative.

**Impact**: Analytics queries on `SUPERVISOR_COMPLETE` events will have inconsistent data depending on whether the implementer used the table or Step 8b as the reference. `query_events(event_type='SUPERVISOR_COMPLETE')` will return records where half have cost data and half do not.

**Fix**: Update the mapping table row to list `data keys: completed, failed, blocked, total_cost_usd, stop_reason` to match Step 8b.2b exactly.

---

### Serious — SKILL.md vs log-templates.md: Mismatched log strings for escalate_disabled event

**File**: `.claude/skills/auto-pilot/SKILL.md` (line 71) vs `.claude/skills/auto-pilot/references/log-templates.md` (line 80)

SKILL.md documents the warning as: `"ESCALATE disabled — cortex unavailable"` (freeform inline text in a blockquote, lowercase "disabled").

log-templates.md documents the log row as: `ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false` (uppercase "DISABLED", additional phrase appended).

These are the same event. Two different files give two different authoritative strings for what to write. An implementer reading SKILL.md for the warning format will write a log entry that does not match the template in log-templates.md, making it impossible to reliably grep or query for this event.

**Impact**: Monitoring, log analysis, and the Session History render step (which matches events by type/text) will produce inconsistent results for this event.

**Fix**: Normalize SKILL.md to match log-templates.md exactly: `ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false`.

---

### Minor — parallel-mode.md: Step 8b `query_events` render call has no failure branch

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 8b, "If cortex_available = true (render log.md before appending history)" block (line ~1045)

All other cortex calls in the new sections have explicit failure handling ("if it fails, log and continue"). The `query_events(session_id={session_id})` call in Step 8b has none. The natural behavior would be to treat it as best-effort (skip the render, continue with existing log.md), but this is not stated.

**Impact**: An implementer may handle this differently than intended — either aborting Step 8b on failure or silently swallowing it. Neither is documented as correct.

**Fix**: Add one line after the `query_events` call: "If `query_events` fails: skip the render step and continue with whatever log.md already contains. Log: `CORTEX LOG FAILED — query_events: {error[:100]}`."

---

### Minor — parallel-mode.md: Stale NEED_INPUT events from prior sessions not addressed

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 7f-escalate

When `escalate_to_user = false`, NEED_INPUT events emitted by workers are never queried and never acknowledged. They persist in the DB with no expiration. When a subsequent session runs with `--escalate`, step 7f-escalate will call `query_events(..., event_type='NEED_INPUT')` — if the API returns all unacknowledged NEED_INPUT events regardless of session_id, stale events from prior sessions surface as live interrupts.

The call is `query_events(session_id={session_id}, event_type='NEED_INPUT')` — this IS scoped to the current session_id, which prevents cross-session bleed as long as the session_id filter is enforced by the cortex schema. If it is, this is not a bug. If the cortex `query_events` implementation does not filter by session_id when session_id is provided, it becomes a bug.

**Impact**: Low if cortex enforces session_id filtering (likely the case). Medium if it does not. Since this is a documentation task and the cortex schema is defined in TASK_2026_138, this is an assumption worth stating explicitly in the step.

**Fix**: Add a note to Step 7f-escalate: "The `session_id` filter ensures only NEED_INPUT events from the current session are returned. Events from prior sessions are isolated by session_id."

---

## Data Flow Analysis

```
Worker emits NEED_INPUT:
  log_event(event_type='NEED_INPUT', data={question}) → cortex DB

Supervisor at phase boundary (Step 7f):
  IF escalate_to_user=true AND cortex_available=true:
    query_events(session_id, 'NEED_INPUT') → returns unack'd events
    → display question to user
    → log_event('INPUT_PROVIDED', {answer, task_id}) → acknowledges
    → resume loop
  ELSE (escalate_to_user=false OR cortex unavailable):
    [NO ACTION] ← GAP: event sits in DB unacknowledged forever

Step 8b (session end):
  cortex path:
    query_events(session_id) → verify log.md complete [no failure branch ← GAP]
    → append missing rows to log.md
    log_event('SUPERVISOR_COMPLETE', {completed, failed, blocked, total_cost_usd, stop_reason})
  file path:
    append to orchestrator-history.md only

Step 8d:
  git add + git commit (session artifacts)
  THEN: end_session(session_id, summary=...) [best-effort, failure logged]
  fallback: skip end_session
```

### Gap Points Identified
1. SUPERVISOR_COMPLETE data schema in event mapping table is missing two fields vs the actual call
2. No failure branch for `query_events()` in the log.md render block in Step 8b
3. NEED_INPUT events are never acknowledged when `escalate_to_user=false` — accumulate silently

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| query_tasks instead of registry.md reads | COMPLETE | |
| query_tasks for status checks | COMPLETE | |
| Dependency graph from DB | COMPLETE | |
| log_event for event logging | COMPLETE | |
| log.md rendered from DB at session end | COMPLETE | |
| Session state via cortex | PARTIAL | Both cortex and file paths run simultaneously — by design but AC says "instead of" |
| orchestrator-history.md replaced | PARTIAL | Both paths run — by design per handoff decisions |
| Fallback when cortex_available=false | COMPLETE | All sections documented |
| escalate_to_user config option | COMPLETE | |
| Token savings verified | MISSING | Not documented in changed files |

### Implicit Requirements NOT Addressed
1. Stale NEED_INPUT event lifecycle when escalate_to_user=false — events accumulate without a cleanup path
2. No acknowledgment protocol documented for NEED_INPUT events that are intentionally skipped (non-escalate sessions)

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| cortex_available=false | YES | All sections have fallback path | |
| escalate_to_user=true + cortex unavailable | YES | Forced to false at startup, warning logged | Log string mismatch between SKILL.md and log-templates.md |
| end_session() failure | YES | Logged, loop continues | |
| read_handoff() failure | YES | Prompt injection skipped, worker reads file | |
| log_event() failure | YES | Inline log entry written, continues | |
| query_events() failure in Step 8b render | NO | No failure branch documented | Minor gap |
| NEED_INPUT with escalate_to_user=false | PARTIAL | Event is ignored (correct) but never acknowledged | Accumulates in DB |
| SUPERVISOR_COMPLETE data completeness | NO | Mapping table omits two fields | Serious gap |

---

## Verdict

**Recommendation**: PASS_WITH_NOTES
**Confidence**: HIGH
**Top Risk**: SUPERVISOR_COMPLETE event schema mismatch between the mapping table and Step 8b.2b — this will cause inconsistent data in cortex analytics queries.

## What Robust Implementation Would Include

- Event mapping table as the single authoritative schema for all event data payloads — Step 8b.2b should reference the table, not define its own inline schema
- Explicit failure handling for every cortex read call, not just write calls
- An acknowledgment or TTL mechanism for NEED_INPUT events so they do not accumulate across sessions
- A single canonical log string for each event, defined once in log-templates.md, referenced by prose in parallel-mode.md and SKILL.md (not redefined inline)
