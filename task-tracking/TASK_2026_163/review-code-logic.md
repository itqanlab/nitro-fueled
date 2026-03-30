# Code Logic Review — TASK_2026_163

## Review Summary

| Metric | Value |
| --- | --- |
| Overall Score | 3/10 |
| Assessment | NEEDS_REVISION |
| Critical Issues | 2 |
| Serious Issues | 3 |
| Moderate Issues | 0 |
| Failure Modes Found | 5 |
| Verdict | FAIL |

---

## Findings

### 1. `create_task` and `bulk_create_tasks` can report success even when the DB upsert failed

- **Severity**: Critical
- **Acceptance Criteria Impacted**: `create_task` must create the DB record in one call; `bulk_create_tasks` must create all tasks fully.
- **Files**:
  - `packages/mcp-cortex/src/tools/task-creation.ts:231-245`
  - `packages/mcp-cortex/src/tools/task-creation.ts:303-317`
  - `packages/mcp-cortex/src/tools/tasks.ts:104-173`
- **Issue**: Both creation paths call `handleUpsertTask(...)` but never inspect its returned `ToolResult`. `handleUpsertTask` reports validation and SQL failures by returning `{ ok: false, reason: ... }` inside the tool payload instead of throwing. That means file creation and git commit still proceed, and the tool can return success even though no DB row was inserted.
- **Why it matters**: This violates the core contract of the feature: the tool is supposed to create the folder, files, DB record, and commit as one lifecycle operation.
- **Fix**: Parse the `ToolResult` from `handleUpsertTask` and fail the operation before committing if the payload is not `ok: true`.

### 2. The required `/nitro-create-task` MCP-first fallback update was not implemented

- **Severity**: Critical
- **Acceptance Criteria Impacted**: `/nitro-create-task` command updated to use MCP tools when available with file fallback.
- **Files**:
  - `.claude/commands/nitro-create-task.md:20-35`
  - `.claude/commands/nitro-create-task.md:111-165`
  - `task-tracking/TASK_2026_163/task.md:56`
  - `task-tracking/TASK_2026_163/task.md:71`
- **Issue**: The command file still instructs raw folder scanning, raw file creation, and a best-effort `upsert_task` call. It never prefers the new `create_task` MCP tool, nor does it describe a fallback path that only activates when cortex is unavailable.
- **Why it matters**: This leaves the user-facing workflow on the old manual path, so the task does not satisfy acceptance criterion 8 even if the backend tools exist.
- **Fix**: Update `.claude/commands/nitro-create-task.md` so the primary path calls `create_task`/`bulk_create_tasks`/`validate_task_sizing`, with the current file-writing flow retained only as the fallback.

### 3. Sizing validation omits two mandatory checks from the spec and does not read the sizing rules source of truth

- **Severity**: Serious
- **Acceptance Criteria Impacted**: `create_task` rejects oversized tasks with sizing violation details; `validate_task_sizing` checks against `sizing-rules.md`; `bulk_create_tasks` validates each task individually against sizing rules.
- **Files**:
  - `packages/mcp-cortex/src/tools/task-creation.ts:83-105`
  - `packages/mcp-cortex/src/tools/task-creation.ts:182-205`
  - `packages/mcp-cortex/src/tools/task-creation.ts:216-219`
  - `task-tracking/TASK_2026_163/task.md:25-29`
  - `task-tracking/sizing-rules.md:15-27`
- **Issue**: `validateSizing()` only checks description line count, acceptance-criteria count, and file-scope count. It never evaluates the required "Complex + multiple architectural layers" rule or the "multiple unrelated functional areas" rule. It also does not read `task-tracking/sizing-rules.md` at all despite the task requiring validation against that file.
- **Why it matters**: Oversized cross-layer or multi-area tasks will pass validation when the spec says they must be rejected.
- **Fix**: Implement the missing checks and anchor the validator to the canonical sizing rules document instead of a partially hardcoded subset.

### 4. `task.md` is generated from a bespoke string template instead of the canonical `task-template.md`

- **Severity**: Serious
- **Acceptance Criteria Impacted**: `create_task` writes `task.md` populated from `task-tracking/task-template.md`.
- **Files**:
  - `packages/mcp-cortex/src/tools/task-creation.ts:108-160`
  - `task-tracking/task-template.md:1-115`
- **Issue**: `buildTaskMd()` hardcodes its own reduced markdown structure. The implementation never reads `task-tracking/task-template.md`, so changes to the canonical template will not flow into created tasks.
- **Why it matters**: This is a direct mismatch with the acceptance criterion and the repository's source-of-truth template rule.
- **Fix**: Load `task-tracking/task-template.md`, substitute the task values into that structure, and avoid maintaining a second hand-written template.

### 5. The registered tool enums do not match the valid task types defined by the canonical template

- **Severity**: Serious
- **Acceptance Criteria Impacted**: Completeness of `create_task` and `bulk_create_tasks` against the task template source of truth.
- **Files**:
  - `packages/mcp-cortex/src/index.ts:489-517`
  - `task-tracking/task-template.md:7-17`
- **Issue**: The new tool schemas accept `BUG`, `REFACTOR`, `DOCS`, `TEST`, and `CHORE`, but the canonical template defines valid task types as `FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | OPS | CREATIVE | CONTENT | SOCIAL | DESIGN`. The schemas also omit valid template types such as `OPS`, `CONTENT`, `SOCIAL`, and `DESIGN`.
- **Why it matters**: Legitimate task types from the canonical template are rejected, while non-canonical values are accepted. That breaks alignment with the repository's task model.
- **Fix**: Replace the hardcoded enums with the actual canonical set from `task-template.md` or a shared constant derived from the same source.

---

## Completeness Check

| Requirement | Status | Notes |
| --- | --- | --- |
| `create_task` creates folder, task.md, status file, DB record, and git commit in one call | PARTIAL | Folder/files/commit exist, but DB creation can fail silently because upsert result is ignored. |
| `create_task` rejects oversized tasks with sizing violation details | PARTIAL | Rejects three checks only; missing required architectural-layer and unrelated-area checks. |
| `validate_task_sizing` standalone tool checks against sizing-rules.md | FAIL | Rules are partially hardcoded and the file is never read. |
| `get_next_task_id` returns correct next ID by scanning task-tracking/ folders | PASS | Disk scan and collision increment are implemented. |
| `bulk_create_tasks` creates multiple tasks with sequential IDs, wired dependencies, and single git commit | PARTIAL | Sequential IDs and single commit exist, but DB insert failures can be silently ignored. |
| `bulk_create_tasks` validates each task individually against sizing rules | PARTIAL | Per-task validation exists, but only against an incomplete subset of the required rules. |
| Collision guard: if folder exists, auto-increment ID | PASS | `getNextTaskIdFromDisk()` increments past occupied folders. |
| `/nitro-create-task` command updated to use MCP tools when available with file fallback | FAIL | Command file still uses the manual path and `upsert_task`, not `create_task`. |

---

## Stub Check

No explicit `TODO`, placeholder, or stub-return implementations were found in the reviewed source files. The failures are due to incomplete logic and missing integration work rather than literal stubs.
