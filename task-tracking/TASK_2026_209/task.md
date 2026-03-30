# Task: Write Implement Worker prompt and exit gate

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Simple         |
| Preferred Tier        | light          |
| Model                 | default        |
| Testing               | skip           |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |
| Worker Mode           | single         |

## Description

Create the Implement Worker prompt section in `.claude/skills/auto-pilot/references/worker-prompts.md`.

The Implement Worker picks up from PREPPED status, reads the prep handoff contract, and executes only the development loop — no PM, no Architect.

**Prompt must define:**
- Read prep-handoff.md as FIRST action (cortex `read_handoff(task_id, worker_type='prep')` with file fallback)
- Run Team Leader MODE 2 (dev loop: assign batch, implement, verify, next batch)
- Run Team Leader MODE 3 (final verification after all batches complete)
- Write handoff.md in existing build handoff format for Review Worker
- Call `write_handoff(task_id, worker_type='build')` via cortex MCP
- Set status to IMPLEMENTED and commit implementation + handoff

**Agent routing:** Same as current Build Worker — select by task type and file scope (nitro-backend-developer, nitro-frontend-developer, nitro-devops-engineer, nitro-systems-developer).

**Exit gate:** Same as current Build Worker — handoff.md exists with 4 sections, all tasks.md batches COMPLETE, status=IMPLEMENTED.

## Dependencies

- TASK_2026_208 — needs PREPPED/IMPLEMENTING statuses defined
- TASK_2026_205 — prep handoff format must be defined first

## Acceptance Criteria

- [ ] Implement Worker prompt section exists in worker-prompts.md
- [ ] Reads prep-handoff.md first with cortex MCP + file fallback
- [ ] Runs Team Leader MODE 2/3 only, no PM or Architect
- [ ] Exit gate matches current Build Worker exit gate

## References

- TASK_2026_205 — Prep Worker prompt (defines prep-handoff.md format)
- `.claude/skills/auto-pilot/references/worker-prompts.md` (existing Build Worker prompt)

## File Scope

- `.claude/skills/auto-pilot/references/worker-prompts.md`

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_205 — both modify worker-prompts.md
