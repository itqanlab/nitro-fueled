# Task: [Title]

<!-- Replace [Title] with a concise name for this task -->

## Metadata

| Field      | Value                                                                         |
|------------|-------------------------------------------------------------------------------|
| Type       | [FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE] |
| Priority   | [P0-Critical | P1-High | P2-Medium | P3-Low]                                 |
| Complexity | [Simple | Medium | Complex]                                                   |
| Model      | [claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 | default]    |
| Testing    | [required \| optional \| skip]                                               |

<!-- Type: Determines agent workflow sequence (see Workflow Selection Matrix in SKILL.md)
       FEATURE       — PM -> [Research] -> Architect -> Team-Leader -> QA
       BUGFIX        — [Research] -> Team-Leader -> QA
       REFACTORING   — Architect -> Team-Leader -> QA
       DOCUMENTATION — PM -> Developer -> Style Reviewer
       RESEARCH      — Researcher -> [conditional implementation]
       DEVOPS        — PM -> Architect -> DevOps Engineer -> QA
       CREATIVE      — [ui-ux-designer] -> content-writer -> frontend

     Priority: Determines queue ordering in auto-pilot (P0 first, P3 last)

     Complexity: Determines model selection and worker strategy
       Simple  — single layer, follow established patterns, ≤3 files
       Medium  — 1-2 layers, some architectural decisions needed, 4-7 files
       Complex — cross-cutting concerns, novel architecture, creative problem-solving

     Model: Optional. Controls which Claude model the Supervisor uses when spawning a worker for this task.
       claude-opus-4-6            — Most capable, highest cost. Use for complex/high-risk tasks.
       claude-sonnet-4-6          — Balanced capability and cost. Use for most tasks.
       claude-haiku-4-5-20251001  — Fastest and cheapest. Use for simple/mechanical tasks.
       default                    — Uses the system default model (set by DEFAULT_MODEL env var in session-orchestrator). Omit this field or set to "default" to use the system default. -->

<!-- Testing: Optional override for the test type decision matrix.
       required — force test phase even if task type would normally skip
       optional — run tests if framework detected (default for most task types)
       skip     — suppress test phase entirely (use for tasks that touch no testable code)
     Omit this field to use the default matrix behavior based on task type. -->

## Description

[What needs to be built, fixed, or changed. Be specific enough for PM agent to produce requirements without further clarification.]

## Dependencies

- None

<!-- List task IDs this depends on. Auto-pilot uses this to build a dependency
     graph and determine which tasks are unblocked.
     Format: TASK_YYYY_NNN — brief description of what this task needs from that one
     Use "None" if this task is independent. -->

## Acceptance Criteria

- [ ] [What "done" looks like — measurable, verifiable outcome]
- [ ] [Another criterion]

<!-- These feed into: PM requirements generation AND QA verification criteria.
     Write them as checkboxes so QA can verify each one. -->

## References

- [Files, docs, URLs, or related tasks relevant to this work]

<!-- Point to existing code, design docs, or external resources that developer
     will need. Helps Architect ground decisions in codebase evidence. -->

## File Scope

- [None]

<!-- Files this task will create or modify. Build workers populate this after implementation.
     Used by supervisor to detect overlapping file scopes between concurrent tasks.
     If overlap is detected, reviews are serialized to prevent cross-task interference. -->
