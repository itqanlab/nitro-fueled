# Implementation Plan — TASK_2026_105

## Overview

Add the OPS task type to the orchestration system across 5 files. All changes are pure markdown/specification updates — no code changes required.

## Change Plan

### File 1: `task-tracking/task-template.md`

**Change**: Add `OPS` to the Type field enum in the Metadata table.

**Location**: In the `## Metadata` table, the `Type` field value cell.

**Action**: Append `| OPS` to the type options list.

---

### File 2: `.claude/skills/orchestration/references/strategies.md`

**Changes**:
1. Add `OPS` row to the **Strategy Overview** table
2. Add a new **OPS (Operational Configuration)** section after the DEVOPS section with:
   - "When to use" description
   - ASCII workflow diagram (`PM → DevOps Engineer → QA`)
   - Trigger keywords list
   - DEVOPS vs OPS disambiguation table
3. Update the **Strategy Selection Summary** decision tree to include OPS check (positioned after DEVOPS, before CREATIVE)

---

### File 3: `.claude/skills/orchestration/SKILL.md`

**Changes**:
1. Add `OPS` row to the **Strategy Quick Reference** table in the header
2. Add `OPS` row to the **Task Type Detection** table in the Workflow Selection Matrix
3. Update the keyword priority note to mention OPS disambiguation from DEVOPS

---

### File 4: `.claude/skills/orchestration/references/agent-catalog.md`

**Changes**:
1. Update `nitro-devops-engineer` **Triggers** section to mention OPS strategy (Phase 2)
2. Update **Agent Selection Matrix** to add OPS routing row

---

### File 5: `.claude/skills/orchestration/references/checkpoints.md`

**Changes**:
1. Add `OPS` row to the **Checkpoint Applicability by Strategy** table

---

## Batch Plan

### Batch 1 (nitro-systems-developer): All 5 files

All changes are small, independent markdown updates with no cross-file dependencies. A single developer can implement all 5 in one batch.

**Tasks**:
- 1.1: Update task-template.md — add OPS to Type enum
- 1.2: Update strategies.md — add OPS strategy overview, section, and decision tree
- 1.3: Update SKILL.md — add OPS to routing tables and keyword detection
- 1.4: Update agent-catalog.md — add OPS to devops-engineer triggers and selection matrix
- 1.5: Update checkpoints.md — add OPS row to applicability table

## Consistency Rules

Across all files, these values must be consistent character-for-character:
- Type name: `OPS` (uppercase)
- Pipeline: `PM → DevOps Engineer → QA`
- Disambiguation: DEVOPS = novel infrastructure design, OPS = known pattern configuration
