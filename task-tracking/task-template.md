# Task: [Title]

<!-- Replace [Title] with a concise name for this task -->

## Metadata

| Field      | Value                                                                         |
|------------|-------------------------------------------------------------------------------|
| Type       | [FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE] |
| Priority   | [P0-Critical | P1-High | P2-Medium | P3-Low]                                 |
| Complexity | [Simple | Medium | Complex]                                                   |

<!-- Type: Determines the agent workflow sequence (see Workflow Selection Matrix in SKILL.md)
       FEATURE       — PM -> [Research] -> Architect -> Team-Leader -> QA
       BUGFIX        — [Research] -> Team-Leader -> QA
       REFACTORING   — Architect -> Team-Leader -> QA
       DOCUMENTATION — PM -> Developer -> Style Reviewer
       RESEARCH      — Researcher -> [conditional implementation]
       DEVOPS        — PM -> Architect -> DevOps Engineer -> QA
       CREATIVE      — [ui-ux-designer] -> content-writer -> frontend-developer

     Priority: Determines queue ordering in auto-pilot (P0 first, P3 last)

     Complexity: Influences strategy selection weighting
       Simple  — less than 2 hours
       Medium  — 2 to 8 hours
       Complex — more than 8 hours -->

## Description

[What needs to be built, fixed, or changed. Be specific enough for the PM agent to produce requirements without further clarification.]

## Dependencies

- None

<!-- List task IDs this depends on. Auto-pilot uses this to build the dependency
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

<!-- Point to existing code, design docs, or external resources the developer
     will need. Helps the Architect ground decisions in codebase evidence. -->
