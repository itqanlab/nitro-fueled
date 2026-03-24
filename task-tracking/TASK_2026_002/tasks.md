# Development Tasks - TASK_2026_002

**Total Tasks**: 5 | **Batches**: 3 | **Status**: 3/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- No existing auto-pilot files: Verified (glob returned empty)
- CLAUDE.md line 41 contains `3. Build auto-pilot skill/command`: Verified
- Orchestration SKILL.md pattern (YAML frontmatter + markdown body): Verified
- Command pattern (orchestrate.md — skill-invoking): Verified
- Registry format and status values: Verified via task-tracking references

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| SKILL.md is large (~300-400 lines); developer may cut corners | MED | Code-logic-reviewer will check for completeness against implementation plan |
| Cross-reference accuracy (MCP tool names, registry columns) | LOW | Verification grep patterns check exact tool names and format strings |

---

## Batch 1: Auto-Pilot Skill IMPLEMENTED

**Developer**: backend-developer
**Tasks**: 1 | **Dependencies**: None

### Task 1.1: Create `.claude/skills/auto-pilot/SKILL.md` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: implementation-plan.md: Component 1 (lines 60-468)
**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md` (frontmatter + section structure)

**Quality Requirements**:
- YAML frontmatter with `name: auto-pilot` and multi-line `description`
- Full structured markdown body — NOT stubs or TODOs
- Must contain ALL 8 core loop steps as specified in the implementation plan
- Must contain the orchestrator-state.md format specification (exact markdown table templates)
- Must contain the MCP tool usage reference table
- Must contain the error handling section (worker failure, MCP unreachable, malformed data, unexpected error, dependency cycle)
- Must contain the key principles section (10 principles)
- Must contain the configuration table with 5 parameters and their defaults
- Must contain the prompt template for spawning workers (including retry context variant)

**Implementation Details**:

The developer MUST read the implementation plan Component 1 (lines 60-468) carefully. The full content structure is specified there. Here is what each section must contain:

1. **YAML Frontmatter**: `name: auto-pilot`, `description` with multi-line description explaining purpose and when to use
2. **Title + One-liner**: `# Auto-Pilot Skill` followed by a one-line summary
3. **Quick Start**: Three usage examples (`/auto-pilot`, `/auto-pilot TASK_YYYY_NNN`, `/auto-pilot --dry-run`)
4. **Your Role: Orchestrator of Orchestrators**: 7 primary responsibilities, 4 "What You Never Do" items
5. **Configuration**: Table with 5 parameters (Concurrency limit=2, Monitoring interval=10min, Stuck threshold=5min, Retry limit=2, MCP retry backoff=30s) with override flags
6. **Core Loop** — 8 steps, each with full procedural logic:
   - Step 1: Read State (Recovery Check) — read orchestrator-state.md if exists, call `list_workers` to reconcile
   - Step 2: Read Registry and Task Folders — parse registry.md, read task.md files, handle missing/malformed
   - Step 3: Build Dependency Graph — classify tasks (UNBLOCKED/IN_PROGRESS/BLOCKED/COMPLETE), cycle detection, missing dependency detection
   - Step 4: Order Task Queue — sort by Priority then Task ID, calculate available spawn slots
   - Step 5: Spawn Workers — prompt template generation (with retry context variant), call `spawn_worker`, update registry to IN_PROGRESS, record in state, handle spawn failure
   - Step 6: Monitor Active Workers — wait interval, call `get_worker_activity` (default) then `get_worker_stats` (escalation), handle health states (healthy/high_context/compacting/stuck/finished), two-strike stuck detection with stuck_count, reset stuck_count for non-stuck workers
   - Step 7: Handle Completions — check completion-report.md, COMPLETE if exists, retry/BLOCKED if not, re-evaluate dependency graph, handle worker still running post-completion
   - Step 8: Loop Termination Check — three conditions (all done -> stop, no unblocked but active -> monitor, unblocked available -> spawn)
7. **orchestrator-state.md Format**: Full markdown template with sections: Loop Status, Configuration table, Active Workers table, Completed Tasks table, Failed Tasks table, Task Queue table, Retry Tracker table. Include the key design properties (atomic overwrite, standard markdown, retry persistence).
8. **MCP Tool Usage Reference**: Table mapping each of the 5 MCP tools to the step where it is used and its purpose. Include the Context Efficiency Rule (default to `get_worker_activity`, escalate to `get_worker_stats`).
9. **Error Handling**: 5 subsections (Worker Failure, MCP Unreachable with 3-retry + 30s backoff, Malformed Task Data, Unexpected Error with state-first preservation, Dependency Cycle)
10. **Key Principles**: 10 numbered principles as listed in the implementation plan

**Verification**:
```
# File exists
Glob: .claude/skills/auto-pilot/SKILL.md

# Has YAML frontmatter
Grep: "name: auto-pilot" in .claude/skills/auto-pilot/SKILL.md

# Has all 8 core loop steps
Grep: "Step 1:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 2:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 3:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 4:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 5:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 6:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 7:" in .claude/skills/auto-pilot/SKILL.md
Grep: "Step 8:" in .claude/skills/auto-pilot/SKILL.md

# Has key sections
Grep: "orchestrator-state.md Format" in .claude/skills/auto-pilot/SKILL.md
Grep: "MCP Tool Usage Reference" in .claude/skills/auto-pilot/SKILL.md
Grep: "Error Handling" in .claude/skills/auto-pilot/SKILL.md
Grep: "Key Principles" in .claude/skills/auto-pilot/SKILL.md
Grep: "Configuration" in .claude/skills/auto-pilot/SKILL.md

# References all 5 MCP tools
Grep: "spawn_worker" in .claude/skills/auto-pilot/SKILL.md
Grep: "list_workers" in .claude/skills/auto-pilot/SKILL.md
Grep: "get_worker_activity" in .claude/skills/auto-pilot/SKILL.md
Grep: "get_worker_stats" in .claude/skills/auto-pilot/SKILL.md
Grep: "kill_worker" in .claude/skills/auto-pilot/SKILL.md

# Has prompt template
Grep: "/orchestrate TASK_" in .claude/skills/auto-pilot/SKILL.md

# Has completion-report.md reference
Grep: "completion-report.md" in .claude/skills/auto-pilot/SKILL.md
```

---

**Batch 1 Verification**:
- `.claude/skills/auto-pilot/SKILL.md` exists with full content
- All 8 core loop steps present
- All 5 MCP tool names referenced
- orchestrator-state.md format specified
- Error handling section complete
- code-logic-reviewer approved

---

## Batch 2: Auto-Pilot Command IMPLEMENTED

**Developer**: backend-developer
**Tasks**: 1 | **Dependencies**: Batch 1 (skill must exist before command references it)

### Task 2.1: Create `.claude/commands/auto-pilot.md` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/auto-pilot.md`
**Spec Reference**: implementation-plan.md: Component 2 (lines 474-618)
**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/orchestrate.md` (skill-invoking command) and `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md` (parameter handling)

**Quality Requirements**:
- Follows existing command pattern: title, description, Usage, Execution Steps, Quick Reference, References
- Includes parameter table with all 5 parameters (TASK_ID, --dry-run, --concurrency, --interval, --retries)
- Includes 5 execution steps: Load Skill, Parse Arguments, Pre-Flight Checks, Display Summary, Handle Mode
- Pre-flight checks: verify registry.md exists, verify MCP via `list_workers`, verify single-task ID exists
- Dry-run output format: dependency graph + wave-based execution plan (exact format from implementation plan)
- Three modes: all-tasks (default), single-task, dry-run
- References section links to: auto-pilot SKILL.md, orchestration SKILL.md, task-tracking reference, MCP design doc, task template guide

**Implementation Details**:

The developer MUST read the implementation plan Component 2 (lines 474-618). The full content structure is specified there. Here is what each section must contain:

1. **Title**: `# Auto-Pilot -- Autonomous Task Processing` with a description paragraph
2. **Usage**: 4 usage examples showing all modes and parameter overrides
3. **Parameters Table**: 5 rows (TASK_ID, --dry-run, --concurrency, --interval, --retries) with Format, Default, Description columns
4. **Execution Steps**:
   - Step 1: Load Skill — read `.claude/skills/auto-pilot/SKILL.md`
   - Step 2: Parse Arguments — regex for task ID (`/^TASK_\d{4}_\d{3}$/`), parse flags
   - Step 3: Pre-Flight Checks — 3 checks (registry exists, MCP reachable via `list_workers`, single-task ID validation)
   - Step 4: Display Summary — formatted summary block showing total tasks, unblocked, in progress, blocked, concurrency, interval, mode
   - Step 5: Handle Mode — three branches: dry-run (show dependency graph + wave execution plan, then STOP), single-task (spawn one, monitor, complete, STOP), all-tasks (enter full loop from SKILL.md)
5. **Quick Reference**: Modes, MCP tools, state file path, skill path
6. **References**: 5 references (auto-pilot SKILL.md, orchestration SKILL.md, task-tracking reference, MCP design doc, task template guide)

**Verification**:
```
# File exists
Glob: .claude/commands/auto-pilot.md

# Has key sections
Grep: "## Usage" in .claude/commands/auto-pilot.md
Grep: "## Execution Steps" in .claude/commands/auto-pilot.md OR "## Execution"
Grep: "## Quick Reference" in .claude/commands/auto-pilot.md
Grep: "## References" in .claude/commands/auto-pilot.md

# Has parameter table
Grep: "--dry-run" in .claude/commands/auto-pilot.md
Grep: "--concurrency" in .claude/commands/auto-pilot.md
Grep: "--interval" in .claude/commands/auto-pilot.md

# Has pre-flight checks
Grep: "registry.md" in .claude/commands/auto-pilot.md
Grep: "list_workers" in .claude/commands/auto-pilot.md

# Has all three modes
Grep: "dry-run" in .claude/commands/auto-pilot.md
Grep: "single-task" in .claude/commands/auto-pilot.md

# References the skill
Grep: ".claude/skills/auto-pilot/SKILL.md" in .claude/commands/auto-pilot.md
```

---

**Batch 2 Verification**:
- `.claude/commands/auto-pilot.md` exists with full content
- All execution steps present
- Parameter table complete
- Pre-flight checks specified
- All three modes documented
- References section links to skill
- code-logic-reviewer approved

---

## Batch 3: CLAUDE.md Update IMPLEMENTED

**Developer**: backend-developer
**Tasks**: 1 | **Dependencies**: Batch 1 and 2 (update only after deliverables exist)

### Task 3.1: Update `CLAUDE.md` Development Priority IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md`
**Spec Reference**: implementation-plan.md: Component 3 (lines 621-636)
**Pattern to Follow**: Lines 39-40 of CLAUDE.md (items 1 and 2 already marked DONE with strikethrough)

**Quality Requirements**:
- Change line 41 from `3. Build auto-pilot skill/command` to `3. ~~Build auto-pilot skill/command~~ DONE`
- Match the exact pattern used for items 1 and 2
- Do NOT modify any other lines

**Implementation Details**:

This is a single-line edit. The developer must:
1. Read `/Volumes/SanDiskSSD/mine/nitro-fueled/CLAUDE.md`
2. Find line 41: `3. Build auto-pilot skill/command`
3. Replace with: `3. ~~Build auto-pilot skill/command~~ DONE`
4. Verify the pattern matches lines 39-40 (which use `~~text~~ DONE`)

**Verification**:
```
# Line changed correctly
Grep: "~~Build auto-pilot skill/command~~ DONE" in CLAUDE.md
```

---

**Batch 3 Verification**:
- CLAUDE.md updated with strikethrough on item 3
- No other lines modified
- code-logic-reviewer approved
