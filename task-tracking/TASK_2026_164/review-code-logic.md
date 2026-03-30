# Code Logic Review — TASK_2026_164

## Review Summary

| Metric | Value | Notes |
| --- | --- | --- |
| Overall Score | 4/10 | Core non-Claude telemetry work is only partially complete in the declared task scope. |
| Assessment | NEEDS_REVISION | Two blocking completeness/correctness issues remain. |
| Critical Issues | 1 | Acceptance criterion 3 is still unmet. |
| Serious Issues | 1 | Worker metadata is still wrong for opencode/codex launches. |
| Moderate Issues | 0 | None. |
| Failure Modes Found | 2 | Both affect non-Claude worker operation/reporting. |
| Verdict | FAIL | Declared-scope implementation is not complete or fully correct. |

---

## Findings

### 1. Critical: Non-Claude prompt sanitization was not implemented

- **Files**: `packages/mcp-cortex/src/process/spawn.ts:185-208`, `.claude/skills/auto-pilot/references/worker-prompts.md:186`, `.claude/skills/auto-pilot/references/worker-prompts.md:209-229`, `.claude/skills/auto-pilot/references/worker-prompts.md:356-357`
- **Why this fails**: Acceptance criterion 3 requires Claude-specific tool references to be stripped or remapped when `provider` is `opencode` or `codex`. The opencode/codex launch paths still pass `opts.prompt` through unchanged, and the worker prompt template still explicitly instructs review workers to use the `Agent` tool for parallel sub-agents.
- **Impact**: Non-Claude workers still receive prompts that reference tools not guaranteed to exist in their environment. That leaves the original failure mode in place and means the task is incomplete even if telemetry parsing improved elsewhere.
- **Recommendation**: Add launcher-aware prompt rewriting before spawning `opencode`/`codex` workers, and update the prompt templates so non-Claude launchers do not mention Claude-only tools such as `Agent` or `Skill`.

### 2. Serious: Spawned non-Claude workers are still recorded with launcher `print`

- **File**: `packages/mcp-cortex/src/tools/workers.ts:113-120`
- **Why this fails**: The inserted worker row hardcodes `launcher` to `'print'` for every worker, even when `provider` is `opencode` or `codex`. That means the database metadata for the worker does not match the actual launcher used.
- **Impact**: Downstream reporting, debugging, and any launcher-specific logic that relies on the `workers.launcher` column will misclassify non-Claude workers. For a task focused on opencode/codex telemetry integration, storing incorrect launcher metadata is a logic error and makes the implementation incomplete.
- **Recommendation**: Set `launcher` from the selected provider/launcher mode instead of hardcoding `'print'`.

---

## Scope Note

Review was limited to the task's declared file scope in `task-tracking/TASK_2026_164/task.md`.
