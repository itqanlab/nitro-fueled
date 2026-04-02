# Task: Phase-Level Model Routing in Orchestration Skill


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add phase-level model routing to the orchestration skill. Currently one model is used for an entire task. Different phases have different cognitive demands: PM and test writing are mechanical (light tier), Architect and security review require deep reasoning (heavy tier), Dev implementation is moderate (balanced tier). Add a phase-model config that the orchestration skill reads to select the appropriate model per phase. The config maps phase names to tiers: pm→light, architect→heavy, dev→balanced, review-logic→heavy, review-security→heavy, review-style→light, test-writing→light. The task-level preferred_tier and work_type fields remain as defaults when no phase override applies. NOTE TO USER: Run one full Medium task end-to-end with phase routing enabled and compare output quality and cost vs a baseline run before rolling out broadly.

## Dependencies

- TASK_2026_274
- TASK_2026_275

## Acceptance Criteria

- [ ] Orchestration skill reads phase-model config and selects model per phase
- [ ] Default phase-tier mapping documented: pm→light, architect→heavy, dev→balanced, review-logic→heavy, review-security→heavy, review-style→light, test-writing→light
- [ ] Task-level preferred_tier still applies as fallback when phase config is absent
- [ ] Test validation: run one full Medium task with phase routing and verify quality + cost vs baseline before broad rollout

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/orchestration/SKILL.md
- .claude/skills/orchestration/references/agent-catalog.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_274 or TASK_2026_275 — depends on both. Wave 3, after both complete.
