# Task: [Title]

<!-- Replace [Title] with a concise name for this task -->

## Metadata

| Field          | Value                                                                         |
|----------------|-------------------------------------------------------------------------------|
| Type           | [FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE] |
| Priority       | [P0-Critical | P1-High | P2-Medium | P3-Low]                                 |
| Complexity     | [Simple | Medium | Complex]                                                   |
| preferred_tier | [light | balanced | heavy | auto]                                             |
| Provider       | [claude | glm | opencode | default]                                           |
| Model          | [model name or default]                                                       |

<!-- Type: Determines the agent workflow sequence (see Workflow Selection Matrix in SKILL.md)
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

     preferred_tier: Auto-estimated at task creation time. Do NOT set manually unless overriding.
       light    — maps to Simple complexity (glm-4.7, lightweight model)
       balanced — maps to Medium complexity (glm-5, full orchestration)
       heavy    — maps to Complex complexity (claude-opus-4-6, top reasoning)
       auto     — fallback sentinel; Supervisor uses Complexity field routing if preferred_tier is absent or "auto"
     Omit or set to "auto" to let the Supervisor use the Complexity field for routing.

     Provider: Which AI provider to use for this task's worker session
       claude    — Claude subscription (best reasoning, full orchestration)
       glm       — Z.AI GLM via same claude CLI with env var override (saves Claude quota)
       opencode  — OpenCode CLI single-shot (non-Claude models, no orchestration)
       default   — auto-selected by Supervisor routing table based on task type/complexity

     Model: Specific model to use (or "default" to let Supervisor routing table decide)
       Claude models: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001
       GLM models:    glm-5, glm-4.7, glm-4.5-air
       OpenAI models: openai/gpt-5.4, openai/gpt-4.1, openai/gpt-4.1-mini, openai/o4-mini
     Omit both Provider and Model (or set to "default") to use the routing table. -->

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
