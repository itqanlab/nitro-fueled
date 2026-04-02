# Code Logic Review — TASK_2026_181

## Review Summary

| Metric              | Value                                                              |
|---------------------|--------------------------------------------------------------------|
| Overall Score       | 5/10                                                               |
| Assessment          | NEEDS_REVISION                                                     |
| Critical Issues     | 1                                                                  |
| Serious Issues      | 2                                                                  |
| Moderate Issues     | 1                                                                  |
| Failure Modes Found | 3                                                                  |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The newly-created `docs/mcp-nitro-cortex-design.md` (370 lines) contains **3 occurrences** of `session-orchestrator` inside its Project Structure block (line 49) and MCP Configuration block (lines 322, 324). These are literal stale strings in documentation the task itself created. A developer reading the doc to configure a fresh project will copy the stale JSON key `"session-orchestrator"` into `.mcp.json`, breaking the connection silently — no runtime error until `spawn_worker` is called.

### 2. What user action causes unexpected behavior?

A user initializing a fresh project with `npx @itqanlab/nitro-fueled init`, then following the MCP setup instructions in `docs/mcp-nitro-cortex-design.md`, will configure `.mcp.json` with `"session-orchestrator"` as the server key. The auto-pilot check at Step 3c calls `list_workers` — because the MCP server is registered under the stale key, the call fails, and the supervisor exits with FATAL rather than proceeding.

### 3. What data makes this produce wrong results?

Any `.mcp.json` created by following the sample config in `docs/mcp-nitro-cortex-design.md` (lines 320–332) uses `"session-orchestrator"` as the JSON server key. The backward-compat fallback in `apps/cli/src/utils/mcp-config.ts` (line 49: `servers['nitro-cortex'] ?? servers['session-orchestrator']`) would catch this case in the CLI — but the auto-pilot supervisor does not use that fallback; it calls MCP tools directly by their registered tool names, which depend on the server key being `nitro-cortex`.

### 4. What happens when dependencies fail?

Not applicable to this rename task. No runtime dependencies were introduced.

### 5. What's missing that the requirements didn't mention?

Two additional docs files in the project root (`docs/nitro-fueled-design.md` and `docs/task-template-guide.md`) also contain stale `session-orchestrator` references (3 occurrences and 1 occurrence respectively) and were not included in the task's File Scope. These are user-facing documentation that new users read first. The acceptance criteria says "zero occurrences of `session-orchestrator` in `apps/cli/scaffold/`" — scaffold is clean — but the broader documentation layer still has stale references that were missed from scope.

---

## Failure Mode Analysis

### Failure Mode 1: New Design Doc Contains Stale References It Was Created to Replace

- **Trigger**: Developer reads `docs/mcp-nitro-cortex-design.md` to configure MCP for a new project
- **Symptoms**: Copies the JSON config block from lines 320–332 with `"session-orchestrator"` key; supervisor fails at Step 3c with FATAL because `list_workers` is not reachable under the stale key name
- **Impact**: Hard blocker — auto-pilot cannot be started by any user following the published documentation
- **Current Handling**: The file was created as a new 370-line doc but its Project Structure section and MCP Configuration section were copied/adapted from the old `mcp-session-orchestrator-design.md` without updating the stale names inside code blocks
- **Recommendation**: Replace `session-orchestrator/` (line 49) with `nitro-cortex/` in the project structure block, and replace `"session-orchestrator"` key and `/path/to/session-orchestrator/dist/index.js` in the MCP config JSON block (lines 322, 324) with `"nitro-cortex"` and `/path/to/nitro-cortex/dist/index.js`

### Failure Mode 2: Out-of-Scope Docs Leave a Stale Trail for New Users

- **Trigger**: User reads `docs/nitro-fueled-design.md` first (the "Full design doc" referenced in CLAUDE.md)
- **Symptoms**: Sees references to `mcp-session-orchestrator-design.md` (line 57), `MCP session-orchestrator` (line 157), and `session-orchestrator MCP server` (line 234). Follows the old doc reference on line 57. The referenced file (`mcp-session-orchestrator-design.md`) may still exist alongside the new `mcp-nitro-cortex-design.md`, creating confusion about which is authoritative.
- **Impact**: Serious — confusing onboarding for all new users of the published library
- **Current Handling**: These files were not in the task's File Scope and were not changed
- **Recommendation**: Expand scope to include `docs/nitro-fueled-design.md` and `docs/task-template-guide.md` (4 additional stale references combined)

### Failure Mode 3: `docs/task-template-guide.md` Instructs Workers with Stale Step Description

- **Trigger**: A Build Worker or Review+Fix Worker reads `docs/task-template-guide.md` during orchestration
- **Symptoms**: Step 6 reads "Spawn worker via MCP session-orchestrator" — confusing if the worker searches for an MCP server named `session-orchestrator` to confirm availability
- **Impact**: Moderate — the auto-pilot supervisor does not use this description to route, but it degrades the documentation accuracy and may confuse a worker performing a pre-flight MCP availability check by name
- **Current Handling**: Not in scope; not changed
- **Recommendation**: Update `docs/task-template-guide.md` line 158 to read "Spawn worker via MCP nitro-cortex"

---

## Critical Issues

### Issue 1: `docs/mcp-nitro-cortex-design.md` Contains 3 Stale `session-orchestrator` Strings

- **File**: `docs/mcp-nitro-cortex-design.md` lines 49, 322, 324
- **Scenario**: This file was listed in the task's File Scope and was created as a new file by this task. It is meant to be the canonical post-rename design document. Yet it still contains:
  - Line 49: `session-orchestrator/` as the root directory name in the project structure block
  - Line 322: `"session-orchestrator":` as the JSON key in the MCP config sample
  - Line 324: `/path/to/session-orchestrator/dist/index.js` as the path in the config sample
- **Impact**: Any user following this document to configure their `.mcp.json` will use the stale server key, causing the supervisor's MCP verification (Step 3c) to fail with FATAL
- **Evidence**:
  ```
  Line 49:   session-orchestrator/
  Line 322:  "session-orchestrator": {
  Line 324:  "args": ["/path/to/session-orchestrator/dist/index.js"],
  ```
- **Fix**: Replace all three occurrences in this file — `session-orchestrator/` → `nitro-cortex/`, `"session-orchestrator":` → `"nitro-cortex":`, `/path/to/session-orchestrator/dist/index.js` → `/path/to/nitro-cortex/dist/index.js`

---

## Serious Issues

### Issue 2: `docs/nitro-fueled-design.md` Was Out of Scope But Contains 3 Stale References

- **File**: `docs/nitro-fueled-design.md` lines 57, 157, 234
- **Scenario**: CLAUDE.md points users to this doc as the "Full design doc". It still references `mcp-session-orchestrator-design.md` (line 57), `MCP session-orchestrator` (line 157), and `session-orchestrator MCP server` (line 234)
- **Impact**: Creates a confusing split between the old and new naming for any user who reads this entry-point doc before reading `mcp-nitro-cortex-design.md`
- **Fix**: Include this file in a follow-on fix commit; replace 3 stale occurrences

### Issue 3: `docs/task-template-guide.md` Was Out of Scope But Contains 1 Stale Reference

- **File**: `docs/task-template-guide.md` line 158
- **Scenario**: Workers and users read this guide during task orchestration. Step 6 reads "Spawn worker via MCP session-orchestrator"
- **Impact**: Misleading documentation used during active orchestration flows
- **Fix**: Update line 158 to "Spawn worker via MCP nitro-cortex"

---

## Moderate Issues

### Issue 4: Acceptance Criterion Language Is Narrower Than the Real Problem

- **Location**: `task-tracking/TASK_2026_181/task.md` acceptance criteria
- **Scenario**: The acceptance criteria states "Zero occurrences of `session-orchestrator` in `apps/cli/scaffold/`". The scaffold directory passes this check — it is clean. But the task's own created file (`docs/mcp-nitro-cortex-design.md`) and two other docs outside the scaffold were not covered by the criterion's wording.
- **Impact**: The criterion is technically satisfiable while the broader rename is still incomplete. Future grep checks against only `apps/cli/scaffold/` will continue to pass and miss the active regressions in `docs/`.
- **Fix**: Broaden the acceptance criterion to cover all non-task-archive files in the repository root: "Zero occurrences of `session-orchestrator` in `apps/cli/scaffold/`, `docs/`, `.claude/`, and `CLAUDE.md` (excluding task-tracking archives and the intentional backward-compat fallback in `apps/cli/src/utils/mcp-config.ts`)"

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Zero `session-orchestrator` in `apps/cli/scaffold/` | COMPLETE | Scaffold is clean — grep confirms zero matches |
| All `mcp__session-orchestrator__*` tool refs replaced with `mcp__nitro-cortex__*` | COMPLETE | No such tool refs found in any file in scope |
| Backward-compat fallback in `apps/cli/src/utils/mcp-config.ts` preserved | COMPLETE | Line 49 confirmed: `servers['nitro-cortex'] ?? servers['session-orchestrator']` |
| Scaffold files pass a grep check for zero stale references | COMPLETE | Scaffold passes; but the criterion does not cover `docs/` |
| `docs/mcp-nitro-cortex-design.md` created with correct naming throughout | PARTIAL | File was created but contains 3 stale internal references (lines 49, 322, 324) |

### Implicit Requirements NOT Addressed:

1. The newly-created `docs/mcp-nitro-cortex-design.md` should itself be free of stale references — it is the canonical post-rename document
2. Other user-facing docs (`docs/nitro-fueled-design.md`, `docs/task-template-guide.md`) that onboard new users also need the rename applied

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: `docs/mcp-nitro-cortex-design.md` — the file created by this task to document the renamed server — still contains the old server name in its MCP configuration sample. Any user who follows this config will break their auto-pilot setup silently.

## What a Complete Fix Would Include

1. Update `docs/mcp-nitro-cortex-design.md` lines 49, 322, 324 to replace `session-orchestrator` with `nitro-cortex`
2. Update `docs/nitro-fueled-design.md` (3 occurrences) to reference `nitro-cortex`
3. Update `docs/task-template-guide.md` line 158 to reference `nitro-cortex`
4. Tighten the acceptance criterion to cover all docs outside `task-tracking/` archives
