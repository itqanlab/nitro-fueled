# Logic Review — TASK_2026_134

## Score: 6/10

## Summary Table

| Metric              | Value        |
|---------------------|--------------|
| Overall Score       | 6/10         |
| Assessment          | NEEDS_FIXES  |
| Critical Issues     | 2            |
| Serious Issues      | 1            |
| Moderate Issues     | 1            |
| Failure Modes Found | 4            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The Session Log section in the new SKILL.md says "using the pipe-table format below" but there is no table below — only a pointer to `log-templates.md`. An agent reading SKILL.md without loading `log-templates.md` will see the phrase "format below", look below, find nothing, and either guess the format or use the wrong format. The failure is invisible: the log gets written in the wrong format and no error is raised.

### 2. What user action causes unexpected behavior?

Running `/auto-pilot --evaluate` when the agent has loaded only SKILL.md: the Evaluation Mode stub says "Does NOT process the task registry" but does not say the mode exits without entering the Core Loop. An agent that reads only the stub may complete evaluation steps and then fall through into the Core Loop because nothing in the stub says to exit. The reference file (`evaluation-mode.md` line 903) says "EXIT. Evaluation mode does not enter the Core Loop" — but the stub omits this.

### 3. What data makes this produce wrong results?

The new SKILL.md is 37KB — the acceptance criterion was ~15KB. The file still contains the full log event table (~60 rows, ~4KB) duplicated verbatim in both SKILL.md and `log-templates.md`. The goal of reducing context burn is partially defeated: the log templates are loaded twice whenever `log-templates.md` is also read during a session.

### 4. What happens when dependencies fail?

If a reference file is missing (e.g., `references/pause-continue.md` not found), the Load-on-Demand Protocol silently fails — the stub in SKILL.md gives a 1-line summary which may be enough to proceed incorrectly rather than failing loudly. This is not a regression from the original (it was always a file reference), but the refactor introduced more such dependencies.

### 5. What's missing that the requirements didn't mention?

The task said "no behavioral changes — purely structural refactor." One structural change was made that is not strictly necessary: the stale archive log entries in the `## Stale Session Archive Check` section's Session Log Entries sub-table (4 rows) was kept in SKILL.md. These rows also appear in `log-templates.md`. This is minor duplication, but combined with the full log event table duplication, it reinforces that the log template extraction was incomplete.

---

## Failure Mode Analysis

### Failure Mode 1: Dangling "format below" reference in Session Log

- **Trigger**: Agent reads `## Session Log` in SKILL.md. The section says "using the pipe-table format below." No table follows. Only a pointer to `log-templates.md`.
- **Symptoms**: Agent either stops to ask for clarification, guesses the format, or uses a wrong bracketed format (`[HH:MM:SS]`) that the original explicitly prohibited.
- **Impact**: Log entries written in wrong format; compaction recovery (which parses the log) may fail to parse entries correctly.
- **Current Handling**: None — the prose and the pointer contradict each other.
- **Recommendation**: Change "using the pipe-table format below" to "using the pipe-table format (see `references/log-templates.md`)".

### Failure Mode 2: Evaluation Mode stub omits the exit-without-Core-Loop contract

- **Trigger**: Agent reads SKILL.md Evaluation Mode stub. Stub says "Does NOT process the task registry." Agent may infer this means it uses a different registry but still proceeds to the Core Loop.
- **Symptoms**: After evaluation steps complete, supervisor enters the Core Loop and begins spawning real workers against the production task registry.
- **Impact**: Real tasks get spawned during a benchmarking run. Worker cost incurred. Evaluation results corrupted by mixing with production task state.
- **Current Handling**: The full behavior is documented in `evaluation-mode.md` line 903, but only if that reference is loaded. The stub does not trigger loading the reference until the agent decides it needs evaluation mode — which may happen after the Core Loop has already started.
- **Recommendation**: Add to the Evaluation Mode stub: "Exits after Step E10 — does NOT enter the Core Loop."

### Failure Mode 3: SKILL.md is 37KB, not ~15KB — primary goal partially unmet

- **Trigger**: Every invocation of `/auto-pilot` in any mode.
- **Symptoms**: The token burn reduction the task was designed to achieve is only partial. The original was 192KB / ~48K tokens. The new SKILL.md is 37KB. The log event table (~60 rows) was extracted to `log-templates.md` but was also kept verbatim in SKILL.md (lines 87-286 approximately). This duplication means SKILL.md is 2.5x the stated target.
- **Impact**: Sequential mode remains expensive; the stated goal of making sequential mode practical on Sonnet is only partially achieved. Agents reading SKILL.md still load ~4KB of log templates they do not need at startup.
- **Current Handling**: The log table appears in both SKILL.md (full inline) and `log-templates.md` (full copy). They are identical.
- **Recommendation**: Remove the full event table from SKILL.md `## Session Log`. Keep only the 3-line prose stub with the pointer to `log-templates.md` (as the stub format for other sections suggests was intended).

### Failure Mode 4: Sequential mode commit template contains hardcoded TASK_2026_133

- **Trigger**: Sequential mode teardown (Step 7 of `references/sequential-mode.md`).
- **Location**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/sequential-mode.md`, lines 107-119.
- **Symptoms**: Every sequential session commit message contains the literal task ID `TASK_2026_133` in the `Task:` field. This is a stale artifact from the task that wrote the sequential mode content.
- **Impact**: Git history contains incorrect task IDs in sequential session commits for all future sessions.
- **Current Handling**: None — hardcoded.
- **Recommendation**: Replace `TASK_2026_133` with a template variable such as `{task_id}` or a list of task IDs processed, or remove the `Task:` field from the commit template since sequential sessions process multiple tasks.

---

## Critical Issues

### Issue 1: Session Log "format below" with no table below

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:89`
- **Scenario**: Any agent loads SKILL.md and reads the Session Log section.
- **Impact**: Agent reads "pipe-table format below", finds no table, and may use wrong log format throughout the session.
- **Evidence**: Line 89 reads: "The supervisor MUST append every significant event to `{SESSION_DIR}log.md` using the pipe-table format below." Lines 91-93 contain only a load-reference pointer and append-only reminder — no table.
- **Fix**: Change "below" to "(see `references/log-templates.md`)". The load-reference pointer on line 91 is sufficient; the prose should match it.

### Issue 2: Evaluation Mode stub missing exit-without-Core-Loop

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:155-159`
- **Scenario**: Agent reads the Evaluation Mode stub, completes evaluation steps from the reference, then checks SKILL.md for what to do next. The stub's only behavioral signal is "Does NOT process the task registry."
- **Impact**: Agent may enter Core Loop after evaluation, spawning real workers during a benchmark run.
- **Evidence**: `evaluation-mode.md:901-903` says "EXIT. Evaluation mode does not enter the Core Loop." This statement exists only in the reference file, not in the stub. The stub does not say to load the reference before beginning evaluation — the load is triggered by detection of `--evaluate`, which happens at the Load-on-Demand Protocol step. But the stub summary itself is incomplete for an agent that reads stubs first to understand behavior.
- **Fix**: Append to the Evaluation Mode stub: "Exits after Step E10 — does NOT enter the Core Loop."

---

## Serious Issues

### Issue 3: Full log event table duplicated verbatim in SKILL.md and log-templates.md

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:89-286` (the full event table kept inline) vs `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/log-templates.md:1-78` (the extracted copy)
- **Scenario**: Agent loads SKILL.md at startup (always), then loads `log-templates.md` on demand. Both files contain the identical ~60-row event table.
- **Impact**: The core goal of the task — reduce startup context burn — is only partially achieved. SKILL.md is 37KB vs the ~15KB acceptance criterion. The duplication consumes ~4KB of always-loaded context for content that was supposed to be on-demand only.
- **Fix**: Remove the full event table from SKILL.md `## Session Log`. Keep the 3-line stub and the load-reference pointer. The original's "format below" pattern was preserved even though the table was extracted — the table should have been removed from SKILL.md.

---

## Moderate Issues

### Issue 4: Sequential mode commit template contains hardcoded task ID

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/sequential-mode.md:107`
- **Scenario**: Every sequential session teardown generates a commit message.
- **Impact**: All future sequential session commits will have `Task: TASK_2026_133` in the body — incorrect for any task other than the one that created this file.
- **Fix**: Replace the hardcoded `TASK_2026_133` on line 107 with `{TASK_IDs processed this session}` or remove the `Task:` field from the sequential session commit template since sequential sessions may process multiple tasks.

---

## Content Completeness Assessment

The content from the original 3558-line SKILL.md is accounted for across the new files. The 3722-line total (new SKILL.md + 7 references) exceeds the original by 164 lines — this is consistent with headers, navigation prose, and minor expansions added during extraction. No content appears to be lost from the original.

The three items called out in the task review focus (Session Log stub format block, Evaluation Mode exit clarity, load-on-demand protocol) are addressed as follows:

| Check | Result |
|-------|--------|
| Session Log stub has load-reference pointer | PASS — line 91 points to log-templates.md |
| Session Log still has "format below" dangling reference | FAIL — line 89 says "below" with no table below |
| log.md format block (3-row example) preserved | PASS — in SKILL.md lines 452-467 (under state.md Format) |
| Evaluation Mode exit-without-Core-Loop visible from stub | FAIL — not mentioned in stub |
| Load-on-demand protocol complete | PASS — lines 116-128 cover all 7 references |
| Log event table extracted to log-templates.md | PASS — log-templates.md is complete |
| Log event table removed from SKILL.md | FAIL — table still fully present in SKILL.md |

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| SKILL.md reduced to ~15KB | PARTIAL | 37KB delivered, 2.5x over target due to log table duplication |
| Each mode extracted into reference file | COMPLETE | 7 reference files created, all modes covered |
| Load-on-demand protocol in SKILL.md | COMPLETE | Lines 116-128 |
| Log templates extracted | PARTIAL | Extracted to log-templates.md but also kept verbatim in SKILL.md |
| Worker prompts extracted | COMPLETE | worker-prompts.md matches original |
| All modes still work | COMPLETE | All 8 modes have stubs + references |
| No behavioral changes | MOSTLY — 2 stub accuracy gaps noted (dangling "below", missing exit statement) |

---

## Verdict

**Recommendation**: NEEDS_FIXES

**Confidence**: HIGH

**Top Risk**: The dangling "pipe-table format below" in Session Log (Issue 1) is a live ambiguity that will cause wrong log formats to be written in every session where `log-templates.md` is not loaded immediately. Combined with the log table duplication defeating ~4KB of the context reduction goal, two of the three fixes are one-line changes.

**Fixes required before APPROVED**:
1. SKILL.md line 89: change "below" to "(see `references/log-templates.md`)".
2. SKILL.md Evaluation Mode stub: add one sentence "Exits after Step E10 — does NOT enter the Core Loop."
3. SKILL.md Session Log: remove the full ~60-row event table (lines approximately 91-285 of the original inline table) — keeping only the 3-line prose + load-reference pointer. This brings SKILL.md toward the ~15KB target.
4. sequential-mode.md line 107: replace hardcoded `TASK_2026_133` with a template variable.
