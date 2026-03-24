# Task: Per-Task Model Selection

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | FEATURE    |
| Priority   | P2-Medium  |
| Complexity | Medium     |

## Description

Add the ability to specify which Claude model a task should use. Currently, all workers spawn with the default model (`claude-opus-4-6`). Users need to control model selection per task for cost optimization — high-risk/complex tasks use Opus, simpler tasks use Sonnet or Haiku.

**Changes needed across two repos:**

### Nitro-Fueled (this repo)
1. **Task template** (`task-tracking/task-template.md`): Add an optional `Model` field to the Metadata table with valid values: `claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 | default`. When omitted or set to `default`, the Supervisor uses the system default.
2. **Auto-pilot skill** (`.claude/skills/auto-pilot/`): When the Supervisor spawns a worker, read the task's Model field and pass it to `spawn_worker`'s `model` parameter. If not set, use the existing default behavior.
3. **Registry reporting** (`task-tracking/registry.md`): Add a `Model` column to the registry so completed tasks show which model was used. This gives visibility into cost decisions.
4. **Orchestrator state** (`task-tracking/orchestrator-state.md`): Include the model in the Active Workers table so the Supervisor log shows which model each worker is running.
5. **/create-task command**: Add Model as an optional field during task creation (default: `default`).

### Session Orchestrator (`/Volumes/SanDiskSSD/mine/session-orchestrator/`)
6. **Worker stats reporting**: Include the model name in `get_worker_stats` and `get_worker_activity` responses so the caller knows which model was used. The model is already stored in the worker registry — just needs to be surfaced in the response.

## Dependencies

- None

## Acceptance Criteria

- [ ] task-template.md includes an optional Model field with valid enum values
- [ ] Auto-pilot reads the Model field from task.md and passes it to spawn_worker
- [ ] Workers spawn with the correct model as specified in the task
- [ ] Tasks without a Model field (or set to `default`) use the system default model
- [ ] Registry shows which model was used for each completed task
- [ ] Orchestrator-state Active Workers table includes the model column
- [ ] get_worker_stats response includes the model name
- [ ] /create-task prompts for model selection (optional, defaults to `default`)

## References

- Session orchestrator repo: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Task template: `task-tracking/task-template.md`
- Token calculator (model pricing): `session-orchestrator/src/core/token-calculator.ts`
