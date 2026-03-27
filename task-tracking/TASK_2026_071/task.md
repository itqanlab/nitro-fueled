# Task: Fix Worker Must Create Follow-On Tasks for Deferred Findings

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Provider   | default     |
| Testing    | skip        |

## Description

When a Fix Worker skips a finding as "too risky" or "out of scope", it currently writes
"Deferred" or "out of scope — not applied" in the completion report and exits. No follow-on
task is created. The finding is silently dropped — it will never be fixed unless the PO
manually notices the note.

Observed case: TASK_2026_049 deferred workspace-signals.ts file size (298 lines > 200 limit)
with no follow-on task created.

## Fix

Update Fix Worker prompt in auto-pilot/SKILL.md — three changes:

1. Step 3d: require a follow-on task when skipping minor findings as risky
2. Out-of-scope rule: require a follow-on task for significant out-of-scope findings
3. Exit gate: add check that all deferred findings have a follow-on task

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` — First-Run and Retry Fix Worker prompts
