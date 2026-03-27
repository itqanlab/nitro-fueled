# Code Style Review — TASK_2026_070

## Score: 7/10

## Summary

The changes are well-structured and follow existing patterns. Documentation is clear and
the new section is internally consistent. Three issues worth addressing: one structural
inconsistency that will confuse future readers, one cross-reference that refers to
a section using a non-standard citation form, and one step that instructs itself to act
as a later sub-step while being numbered as a primary step.

---

## Findings

### WARNING — Startup Sequence "Step 4" conflicts with the Session Lifecycle "Step 4" label

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 201-207 (Startup Sequence) and line 233 (Session Lifecycle > On startup)

The Startup Sequence table now reads:

```
0. Stale Session Archive Check
1. MCP validation
2. Concurrent Session Guard
3. Session Directory creation
4. Log stale archive check results to session log
5. Step 1: Read State
6. Enter Core Loop
```

Step 4 is an unnumbered, unlabeled prose action ("Log stale archive check results to session
log") inserted between session directory creation and the Core Loop's Step 1. It has no bold
label or named section heading, which breaks the visual pattern of every other step in this
list (each other step is bolded and cross-references a named section).

Immediately below at line 222, the `Session Lifecycle > On startup` section starts its own
numbered list. Its step 4 is "Append first log entry to log.md" — which is a different action
from Startup Sequence step 4. The two "step 4" labels in close proximity describe different
things and will confuse a reader scanning both sections.

The existing review lesson at `.claude/review-lessons/review-general.md` (line 60) calls this
exact pattern out: "Step numbering in command docs must be flat and sequential." The same
principle applies to SKILL.md.

**Recommendation**: Either give Startup Sequence step 4 a bold label that distinguishes it
from a procedural step (e.g., bold "Post-startup archive log flush" as a note rather than a
numbered step), or merge the logging action into step 3's description so the Startup Sequence
stays at 5 items (0-3, then the Core Loop).

---

### WARNING — Cross-reference in auto-pilot.md uses non-standard anchor form

**Location**: `.claude/commands/auto-pilot.md`, line 48

```
run the Stale Session Archive Check defined in `.claude/skills/auto-pilot/SKILL.md` under `## Stale Session Archive Check`
```

Every other cross-reference in this file and in SKILL.md uses the form `(see ## Section Name)`
inside parentheses following the label, e.g.:

```
**MCP validation** (see ## MCP Requirement)
**Concurrent Session Guard** (see ## Concurrent Session Guard)
```

The new 3a step uses a different form: prose sentence with a backtick-delimited heading at the
end. This inconsistency is minor in isolation but will cause contributors adding future steps
to pick the wrong pattern. The anchor style used in the Startup Sequence table is the established
convention for this file.

**Recommendation**: Rewrite as `(see ## Stale Session Archive Check in .claude/skills/auto-pilot/SKILL.md)`
or align with however other cross-file references are written elsewhere in the file.

---

### SUGGESTION — Step 8b note instructs the reader to treat it as "Step 8d" in practice

**Location**: `.claude/skills/auto-pilot/SKILL.md`, line 1022

```
> Note: ... Treat this as "Step 8d" in practice — run it last in the session stop sequence.
```

This note tells a supervisor implementing Step 8b to silently rename it to 8d when executing
it. Step 8 is a named section heading ("Step 8b: Write Session Summary"). Saying "treat this
as 8d in practice" introduces a ghost step label that does not appear as a heading anywhere in
the document. A reader following the steps in order will encounter Step 8b, read the note, then
look for Step 8d and not find it.

If the commit must happen after 8c, the cleanest fix is to add an explicit Step 8d heading for
the commit action and move this content there. The note approach leaves the document in a
contradictory state: the heading says 8b, the note says 8d.

This is a clarity/maintenance issue, not a blocker, but it is the kind of thing that causes
a worker in a compaction-recovery scenario to execute the commit at the wrong point in the
sequence.

---

### SUGGESTION — "Print:" and log row formats differ between the Algorithm and Session Log Entries table

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 306-325 (Stale Session Archive Check section)

The Algorithm section uses `Print:` for console output:

```
Print: `STALE ARCHIVE — archived {SESSION_ID}`
```

The Session Log Entries table uses `STALE ARCHIVE — archived {SESSION_ID}` in the log row.

These are describing two different outputs (console vs log.md), which is fine. However the
distinction between "Print" (console) and "log entry" (file write) is not explicitly stated
anywhere in the section. The existing event log format table in the main Event Log section
(around line 143) only shows log row formats, not console prints. A worker reading this for
the first time may not know whether `Print:` means write to log.md, write to stdout, or both.

Other sections in SKILL.md use `Log:` to mean append to log.md and print for console output,
but this is not defined explicitly in the new section.

**Recommendation**: Add a one-line note after the algorithm ("Print statements go to stdout;
log entries are written after Session Directory creation per the table below") to make the
distinction unambiguous.

---

### SUGGESTION — .gitignore comment says "never committed" but the gitignore pattern uses glob syntax that only matches one level deep

**Location**: `.gitignore`, lines 7-9

```
# Session runtime state (never committed)
task-tracking/sessions/*/state.md
task-tracking/active-sessions.md
```

The glob `task-tracking/sessions/*/state.md` correctly matches one level of session directory
depth (e.g., `task-tracking/sessions/SESSION_2026-03-24_22-00-00/state.md`). This is correct
given the documented directory structure. This is not a bug, but worth calling out: if the
session directory nesting changes in the future, this pattern silently stops excluding
`state.md` files.

The comment "never committed" accurately describes the intent. No action required unless
the structure changes — this is informational only.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The "Step 8d" ghost label in the commit note (`SKILL.md` line 1022) is the highest-risk item.
A worker following steps mechanically after compaction recovery will execute the commit at step
8b, before 8c writes analytics.md, defeating the purpose of the ordering note. The note is
trying to compensate for a structural defect in the step numbering.

### 2. What would confuse a new team member?

The Startup Sequence step 4 ("Log stale archive check results") has no bold label and no
cross-reference, breaking the visual pattern of every other step in the list. A contributor
trying to extend the startup sequence will not know whether to continue the numbered + bold
pattern or the unlabeled prose pattern.

### 3. What's the hidden complexity cost?

The new section introduces two slightly different cross-reference forms in the same two-file
system (command doc and SKILL.md). This is low cost now but accumulates: each new step added
to auto-pilot.md by a different contributor will follow whichever form they see first, resulting
in three forms within another six months.

### 4. What pattern inconsistencies exist?

- Cross-reference style in `auto-pilot.md` line 48 diverges from the established `(see ## Section)` form used everywhere else in the file.
- Startup Sequence step 4 is prose-only while all other steps are bolded and linked.

### 5. What would I do differently?

Add an explicit `### Step 8d: Commit Session Artifacts` heading after step 8c and move the
git commit block there. Remove the "treat as 8d" note — the heading would replace it. This
gives the commit action a first-class identity in the document and removes the contradiction
between the label (8b) and the note (8d).
