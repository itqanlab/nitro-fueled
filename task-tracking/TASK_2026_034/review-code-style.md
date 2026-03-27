# Code Style Review — TASK_2026_034

## Summary

The task introduces session-scoped state directories, a unified three-column event log, and an
`active-sessions.md` registry. The orchestration/SKILL.md addition is clean and consistent.
The `active-sessions.md` seed file is correct. However, auto-pilot/SKILL.md has a pervasive
path-update miss: at least nine locations still reference the old `orchestrator-state.md` without
the `{SESSION_DIR}` prefix, and one cross-reference points to a section that does not exist.
These are not cosmetic issues — an agent reading the file will find contradictory path
instructions and cannot determine which to follow.

---

## Findings

### BLOCKING

#### B1: `orchestrator-state.md` used without `{SESSION_DIR}` in nine locations

auto-pilot/SKILL.md contains nine lines that still reference the bare
`orchestrator-state.md` path after this task was supposed to replace all such references
with `{SESSION_DIR}state.md`.

Affected lines:

| Line | Text |
|------|------|
| 39 | `7. **Persist state** to \`orchestrator-state.md\` for compaction survival` |
| 64 | `Write the active configuration into \`orchestrator-state.md\`.` |
| 351 | `4. Record serialized tasks in orchestrator-state.md under a new \`## Serialized Reviews\` table:` |
| 371 | `check the \`## Serialized Reviews\` table in orchestrator-state.md.` |
| 404 | `- Record in \`orchestrator-state.md\` active workers table:` |
| 419 | `2. For each active worker in \`orchestrator-state.md\`:` |
| 443 | `- Check \`orchestrator-state.md\` for this worker's \`stuck_count\`.` |
| 471 | `- Look up \`expected_end_state\` from \`orchestrator-state.md\` for this worker` |
| 1004 | `- Write current state to \`orchestrator-state.md\`.` |
| 1020 | `1. Write current state to \`orchestrator-state.md\` **FIRST** (state preservation is top priority).` |
| 1037 | `4. **orchestrator-state.md is your private memory** across compactions` |

The implementation plan specified path substitution across all write and read points (Components
3, 4, 6). The work was done in the named components (Steps 1, 5f, 6e, 8, and the format
section), but untouched sections — Primary Responsibilities, Configuration, Step 3c, Step 4
Serialization check, Step 5d, Step 6 active-worker loop, Step 6 stuck detection, Step 7
expected-state lookup, Error Handling (MCP Unreachable + Unexpected Error), and Key Principles
— were missed entirely.

An agent reading this skill will see `{SESSION_DIR}state.md` in some steps and
`orchestrator-state.md` in others and cannot tell which to use. This is the most critical
issue in the review.

**Fix**: Replace all remaining bare `orchestrator-state.md` references with
`{SESSION_DIR}state.md`.

---

#### B2: "Active Sessions File section" referenced but does not exist

auto-pilot/SKILL.md line 196:
```
5. Register in `task-tracking/active-sessions.md` (append row — see Active Sessions File section).
```

No `## Active Sessions File` section exists anywhere in auto-pilot/SKILL.md. The format for
the active-sessions.md row (columns: Session, Source, Started, Tasks, Path) is documented only
in the implementation plan and in the `active-sessions.md` seed file itself, not in the skill.

An agent following step 5 of the Session Lifecycle will see the cross-reference, fail to find
the section, and either guess the row format or halt.

**Fix**: Either add a `## Active Sessions File` section to auto-pilot/SKILL.md documenting
the row format, or replace the cross-reference with the inline row format:
`| {SESSION_ID} | auto-pilot | {HH:MM} | {N} | task-tracking/sessions/{SESSION_ID}/ |`

---

### SERIOUS

#### S1: Inconsistent casing for `Loop Status` field name

Two lines use different casing for the same state.md field:

- Line 203 (Session Lifecycle "On stop"): `Loop Status: STOPPED` (Title Case)
- Line 534 (Step 8 termination table): `loop_status: STOPPED` (snake_case)

The state.md format example at line 865 uses `**Loop Status**: RUNNING | STOPPED` (Title Case).
The snake_case variant at line 534 is the odd one out. An agent reading Step 8 will write
`loop_status:` while Step 1 recovery reads `Loop Status:` — a parse miss.

**Fix**: Change line 534 to `Loop Status: STOPPED` to match the format section and the On-stop
lifecycle instruction.

---

#### S2: "Primary Responsibilities" bullet 7 still names `orchestrator-state.md`

Line 39:
```
7. **Persist state** to `orchestrator-state.md` for compaction survival
```

This is the visible role summary at the top of the skill. Workers and the supervisor itself use
this as a quick orientation. It contradicts the Session Directory section introduced 124 lines
later. A reader who only skims Primary Responsibilities will form the wrong mental model before
encountering the correction.

This is already captured under B1 but flagged separately because it is in the high-visibility
summary section and the contradiction is especially jarring there.

**Fix**: Update to `Persist state to \`{SESSION_DIR}state.md\` for compaction survival`

---

#### S3: Step 8b history entry section heading mismatch

The history entry in Step 8b (line 564) uses the heading `### Event Log`, but the live log
file (log.md) is titled `# Session Log` in its header. The implementation plan (Component 7)
specifies the history heading as `### Event Log` intentionally to distinguish it from the
full session log, which is fine — but the instruction at line 568:

```
{copy full event table from {SESSION_DIR}log.md}
```

does not explain that the `Source` column is to be dropped when pasting into the history. The
implementation plan (Component 7) explicitly states: "Drop the `Source` column — it adds noise
in the history where source is already implied." This instruction is absent from the actual
SKILL.md. An agent copying the table will include the Source column, producing a three-column
history entry when the format example shows only two (`| Time | Event |`).

**Fix**: Add an inline note after the copy instruction: "Drop the `Source` column from the
copied rows. History entries use two columns only: `| Time | Event |`."

---

#### S4: Configuration section still says "Write active configuration into `orchestrator-state.md`"

Line 64:
```
When the loop starts, merge command-line overrides with these defaults. Write the active
configuration into `orchestrator-state.md`.
```

This is in the `## Configuration` section, which is one of the untouched areas from B1. Beyond
being a stale path, the sentence is ambiguous: it says "write configuration into
`orchestrator-state.md`" but does not say when relative to Session Directory setup. Startup
order matters because `SESSION_DIR` must be known before the state file can be written.

The Session Lifecycle section defines the correct order (Session Directory created first, then
log.md, then active-sessions.md registration). The Configuration section should reference this
ordering rather than implying an independent write.

**Fix**: Update to `{SESSION_DIR}state.md` and add a note: "Written as part of Session
Lifecycle startup (after Session Directory is created)."

---

### MINOR

#### M1: Trailing blank line in `active-sessions.md` seed file

`/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/active-sessions.md` contains:

```
# Active Sessions

| Session | Source | Started | Tasks | Path |
|---------|--------|---------|-------|------|

```

There is a blank line after the separator row with no content rows. This is cosmetically fine
and will not break parsing, but agents that detect "table has rows" by counting non-blank lines
after the header could count zero rows correctly. The empty trailing line is noise. Minor —
pre-existing pattern in many markdown files, not introduced by this task specifically.

---

#### M2: Missing blank line between Step 3b end and Step 3c heading

auto-pilot/SKILL.md line 341-342:
```
- Continue to Step 4 with default ordering (Priority then Task ID). No consultation needed.
### Step 3c: File Scope Overlap Detection
```

`### Step 3c` begins immediately after the last line of `IF plan.md does NOT exist` with no
blank line separator. Every other `### Step N` heading in the file has a preceding blank line.
This is a pre-existing issue (not introduced by TASK_2026_034) but worth noting for the next
pass.

---

#### M3: `{SESSION_DIR}` placeholder syntax consistency — orchestration vs auto-pilot

Both files use `{SESSION_DIR}` as the placeholder. Consistent. Both files use
`{YYYY-MM-DD}_{HH-MM}` for the timestamp format. Consistent. Both files use
`SESSION_{YYYY-MM-DD}_{HH-MM}` as the `SESSION_ID` pattern. Consistent.

The only minor divergence: orchestration/SKILL.md uses `{HH:MM:SS}` in the startup entry
example at line 227 (inline code), while auto-pilot/SKILL.md consistently uses `{HH:MM:SS}`
throughout the Session Log event table. These match — no issue.

---

#### M4: `active-sessions.md` format not documented in the skill that writes it

The implementation plan (Component 8) specifies the active-sessions.md row format. The
orchestration/SKILL.md step 5 says `append row with source \`orchestrate\`, Tasks \`1\`, path
\`{SESSION_DIR}\`` — this is sufficient for an agent to construct the row. The auto-pilot
Session Lifecycle step 5 says "see Active Sessions File section" which is a broken reference
(B2 above). The format of the row is implied but never shown in auto-pilot/SKILL.md.

This is partly covered by B2 (blocking). Even if B2 is resolved by adding a section, the
orchestration skill should also show the exact row format rather than describing it in prose,
for symmetry with how auto-pilot's log events are shown as exact pipe-table rows.

---

## Review Summary Table

| Category | Score | Notes |
|----------|-------|-------|
| Consistency | 4/10 | 11 stale path references; inconsistent `loop_status` vs `Loop Status` |
| Clarity | 6/10 | New sections are well-written; broken cross-reference and missing column-drop instruction hurt clarity |
| Format | 8/10 | Pipe-table rows consistent throughout; `{SESSION_DIR}` placeholder syntax uniform; separator `---` discipline maintained in orchestration/SKILL.md; active-sessions.md matches spec |
| Overall | 5/10 | Core architecture is correct; execution missed too many path-substitution sites |

---

## Verdict

**NEEDS REVISION**

Two blocking issues must be fixed before this task can be considered complete:

1. All remaining `orchestrator-state.md` bare references in auto-pilot/SKILL.md must be updated
   to `{SESSION_DIR}state.md`. This is a grep-and-replace operation with approximately 11 target
   sites. Several are in high-frequency code paths (Primary Responsibilities, Error Handling,
   Key Principles) that agents load as orientation context.

2. The "Active Sessions File section" cross-reference must be resolved — either by adding the
   missing section or by inlining the row format.

The two serious issues (S1, S3) should also be fixed: `loop_status` vs `Loop Status` casing
will cause a state parse miss on recovery, and the missing "drop Source column" instruction will
produce malformed history entries. S2 and S4 are duplicates of B1 but need separate attention
because they are in high-visibility locations.

The orchestration/SKILL.md addition is well-executed. The `active-sessions.md` seed file is
correct. The structural discipline (separators, heading hierarchy, pipe-table row format for
log entries) is consistent throughout the new content. The defect is exclusively in the
incomplete path substitution in auto-pilot/SKILL.md.
