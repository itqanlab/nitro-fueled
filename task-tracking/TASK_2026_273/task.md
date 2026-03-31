# Task: Research — Per-Harness Prompt Templates and Supervisor Routing Spec

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | RESEARCH                     |
| Priority              | P3-Low                       |
| Complexity            | Simple                       |
| Preferred Tier        | light                        |
| Model                 | default                      |
| Testing               | skip                         |
| Worker Mode           | single                       |

## Description

Part 2 of 2 — Multi-Launcher Architecture Design (depends on TASK_2026_272).

Extend `docs/multi-launcher-design.md` with the prompt strategy and Supervisor routing spec.

**Per-harness prompt templates** — replace the fragile translation/adapter approach (find-and-replace tool names in prompts) with per-harness prompt variants. Each worker type gets a prompt written natively for each supported harness and stored in `worker-prompts.md`. The Supervisor picks the right variant based on the selected launcher. Document the strategy and provide at least one worked example (e.g., Review+Fix Worker prompt for claude-code vs opencode).

**Why no translation** — document explicitly why the adapter approach is rejected: text substitution is fragile, tool capabilities are not 1:1 across harnesses (e.g., opencode may not support parallel sub-agents), and prompts drift independently. Per-harness templates are the correct model.

**Supervisor routing logic** — document how the Supervisor selects a valid `(launcher, provider, model)` triple: read launcher list, read provider list, apply compatibility matrix, select best available combination for the task's tier/complexity, inject into spawn_worker call.

**Update TASK_2026_270 and TASK_2026_271** — once the design doc is complete, update both task descriptions to reference `docs/multi-launcher-design.md` as the spec they implement against.

## Dependencies

- TASK_2026_272 — data model and API spec must exist before prompt strategy is designed

## Acceptance Criteria

- [ ] `docs/multi-launcher-design.md` extended with per-harness prompt template strategy
- [ ] At least one worker type has example prompt variants for two different harnesses
- [ ] Adapter/translation approach is explicitly rejected with documented reasoning
- [ ] Supervisor `(launcher, provider, model)` selection algorithm is documented
- [ ] TASK_2026_270 and TASK_2026_271 descriptions updated to reference the design doc

## References

- Part 1 output: `docs/multi-launcher-design.md` (created by TASK_2026_272)
- Current worker prompts: `.claude/skills/auto-pilot/references/worker-prompts.md`
- Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`
- Tasks to update: TASK_2026_270, TASK_2026_271

## File Scope

- docs/multi-launcher-design.md
- task-tracking/TASK_2026_270/task.md
- task-tracking/TASK_2026_271/task.md

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_272 — depends on it. Wave 2, after TASK_2026_272 completes.
