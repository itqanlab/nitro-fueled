# Code Style Review — TASK_2026_007

## Summary

NEEDS_REVISION — Both documents are well-structured and internally consistent, but the task left a stale cross-reference in a sibling doc, the agent count is wrong, and the command list in CLAUDE.md is incomplete.

| Metric          | Value          |
|-----------------|----------------|
| Overall Score   | 6/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 1              |
| Serious Issues  | 3              |
| Minor Issues    | 2              |
| Files Reviewed  | 2 (+1 sibling) |

## Blocking Issues

### Issue 1: Stale cross-reference in docs/task-template-guide.md not updated

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/docs/task-template-guide.md:188`
- **Problem**: The task-template-guide still references the OLD filename `docs/claude-orchestrate-package-design.md`. This file was renamed to `docs/nitro-fueled-design.md` as part of this task, but the reference in the sibling doc was not updated. That file no longer exists — this is a broken link.
- **Impact**: Any agent or developer following the task-template-guide will hit a dead reference. Since this is a documentation task specifically about renaming and updating references, missing this in a directly-related doc is a scope failure.
- **Fix**: Update line 188 of `docs/task-template-guide.md` to reference `docs/nitro-fueled-design.md`.

## Serious Issues

### Issue 1: Agent count is wrong — CLAUDE.md says "15" but there are 16

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md:13`
- **Problem**: Line 13 says "15 agent definitions" but there are 16 `.md` files in `.claude/agents/`. The extra agent is `systems-developer.md`, which is not mentioned in either CLAUDE.md or the design doc. It also does not fit neatly into the "core" or "project" categories described in the design doc.
- **Tradeoff**: An incorrect count erodes trust in the documentation. A reader who counts 16 files will wonder which number to believe.
- **Recommendation**: Either update the count to 16 and add `systems-developer` to the appropriate agent category in the design doc, or acknowledge it as a new/experimental agent. The design doc's core agent list (lines 42-46) also needs updating if this agent is meant to ship.

### Issue 2: CLAUDE.md command list is incomplete

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md:18`
- **Problem**: The Project Structure section lists commands as `/orchestrate, /plan, /auto-pilot, /review-*, /create-task`. Actual commands in `.claude/commands/` also include `/initialize-workspace`, `/project-status`, and `/orchestrate-help`. These are omitted from CLAUDE.md.
- **Tradeoff**: A new contributor reading CLAUDE.md will not discover these commands. For a documentation task, completeness matters.
- **Recommendation**: Update the command list to include all 10 commands, or at minimum add "etc." to signal the list is not exhaustive. The design doc (line 27) also only lists a subset.

### Issue 3: Design doc scaffold structure diverges from CLAUDE.md structure

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/docs/nitro-fueled-design.md:19-35` vs `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md:9-25`
- **Problem**: The design doc shows a `scaffold/` top-level directory with `.claude/` nested inside it (lines 19-35), representing what gets copied to target projects. CLAUDE.md shows the current repo structure with `.claude/` at the top level. Neither document clarifies the relationship between these two views. A reader could reasonably wonder: is `scaffold/` supposed to exist? (It does not — `packages/` and `scaffold/` directories do not exist yet.)
- **Tradeoff**: The design doc describes future state; CLAUDE.md describes current state. This is acceptable in principle but neither document makes the distinction explicit.
- **Recommendation**: Add a brief note in the design doc scaffold section indicating this is the planned structure (e.g., "What will be copied during `init` (not yet implemented):"). CLAUDE.md already marks `packages/` as "(TBD)" which is adequate.

## Minor Issues

### Issue 1: Hardcoded absolute path in Dependencies section

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md:33`
- **Details**: The Dependencies section contains a hardcoded local path `/Volumes/SanDiskSSD/mine/session-orchestrator/`. This is machine-specific and will not be valid for any other contributor or machine. Same path appears in the design doc at line 55.
- **Fix**: Consider noting this is a local development path, or make it configurable via `.mcp.json` reference only.

### Issue 2: Development Priority item 5 shows stale status

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md:49`
- **Details**: Item 5 "Fix workspace agent setup" is marked `IN_PROGRESS` with strikethrough formatting (`~~...~~`). Strikethrough typically indicates "done", but the status says IN_PROGRESS — contradictory visual signals. Either remove the strikethrough or update the status.

## File-by-File Analysis

### CLAUDE.md

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: The file is well-organized with clear sections. Naming is consistent ("nitro-fueled" used throughout, no old "claude-orchestrate" references). Markdown formatting is clean. However, the agent count is factually wrong (15 vs 16) and the command listing is incomplete. The Development Priority section has a formatting inconsistency on item 5.

### docs/nitro-fueled-design.md

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: The design doc is comprehensive and well-structured. The rename from `claude-orchestrate` is complete within this file — no stale references to the old name. Tables are properly formatted. The state machine ASCII diagram (lines 96-100) is clear. The task template example (lines 104-126) is useful. The Supervisor Loop description (lines 151-167) is detailed and actionable.

The main concern is the scaffold structure describing a future state without marking it as such, and the `systems-developer` agent being absent from the agent lists.

## Pattern Compliance

| Pattern              | Status | Concern |
|----------------------|--------|---------|
| Naming consistency   | PASS   | "nitro-fueled" used consistently in both reviewed files |
| Cross-references     | FAIL   | task-template-guide.md still references old filename |
| Heading levels       | PASS   | Logical H1 -> H2 -> H3 hierarchy in both files |
| Table formatting     | PASS   | All tables are well-aligned |
| Structure ordering   | PASS   | Sections flow logically (vision -> architecture -> details) |
| Completeness         | FAIL   | Agent count wrong, command list incomplete |

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The blocking issue is the broken cross-reference in `docs/task-template-guide.md`. This task's explicit goal was to rename from `claude-orchestrate` to `nitro-fueled` throughout, and a directly-related doc was missed. The serious issues (wrong agent count, incomplete command list) further indicate the documentation was not fully verified against the actual filesystem state.
