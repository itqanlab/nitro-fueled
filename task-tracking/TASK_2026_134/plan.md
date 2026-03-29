# Implementation Plan — TASK_2026_134

## Overview

Split `.claude/skills/auto-pilot/SKILL.md` (192KB) into a slim core (~15KB) + 7 reference files.

## File Map

### Core SKILL.md — KEEP (slim down)

Retain these sections verbatim:
- Frontmatter (lines 1-11)
- Quick Start (lines 17-27)
- Your Role: Supervisor (lines 28-53)
- Configuration (lines 54-78)
- Registry Write Safety (lines 79-86)
- MCP Requirement / HARD FAIL (lines 1278-1307)
- Session Directory + Startup Sequence (lines 1309-1369)
- Active Sessions File (lines 1372-1407)
- Stale Session Archive Check (lines 1409-1456)
- Concurrent Session Guard (lines 1458-1470)
- state.md Format (lines 3344-3439)
- MCP Tool Usage Reference (lines 3443-3497)
- Error Handling (lines 3499-3543)
- Key Principles (lines 3545-3559)

Replace these sections with load-on-demand stubs:
- Session Log → stub pointing to `references/log-templates.md`
- Modes → keep the mode table, add load note; full mode detail in mode-specific refs
- Pause Mode → stub → `references/pause-continue.md`
- Continue Mode → stub → `references/pause-continue.md`
- Sequential Mode → stub → `references/sequential-mode.md`
- Evaluation Mode → stub → `references/evaluation-mode.md`
- Core Loop (Steps 1-8) → stub → `references/parallel-mode.md`
- Worker Prompt Templates → stub → `references/worker-prompts.md`
- Worker-to-Agent Mapping → stub → `references/worker-prompts.md`

Add at the bottom: **Reference Index** section.

### New Reference Files

| File | Content | Source Lines |
|------|---------|--------------|
| `references/log-templates.md` | All session log row templates | 87-165 |
| `references/pause-continue.md` | Pause Mode + Continue Mode | 190-239 |
| `references/sequential-mode.md` | Sequential Mode full details | 240-373 |
| `references/evaluation-mode.md` | Evaluation Mode E1-E10 | 374-1276 |
| `references/parallel-mode.md` | Core Loop Steps 1-8 + analytics | 1473-2456 |
| `references/worker-prompts.md` | Worker Prompt Templates + Mapping + Eval prompts | 2458-3342 |
| `references/cortex-integration.md` | Cross-cutting cortex notes (extracted from parallel-mode.md) |

## Reference Index (add to core SKILL.md)

```
| Reference | Load When | Content |
|-----------|-----------|---------|
| references/parallel-mode.md | Running in parallel/all-tasks/single-task/limited mode | Core Loop Steps 1-8, health checks, spawning |
| references/sequential-mode.md | Running with --sequential flag | Inline orchestration loop |
| references/evaluation-mode.md | Running with --evaluate flag | Benchmark flow E1-E10 |
| references/pause-continue.md | Running with --pause or --continue | Pause/resume logic |
| references/log-templates.md | Need exact log row format | All log row formats |
| references/worker-prompts.md | Spawning workers (Step 5) | Build/Review/Fix/Completion/Eval prompt templates |
| references/cortex-integration.md | cortex_available=true code paths | Cortex DB overrides, claim_task, get_next_wave |
```

## Load-on-Demand Protocol

Add to core SKILL.md (after Modes table):

```
### Load-on-Demand Protocol

1. Detect mode from command arguments (see Modes table above)
2. Load ONLY the matching reference file — do NOT preload all references
3. For parallel mode (default): load references/parallel-mode.md
4. For --sequential: load references/sequential-mode.md
5. For --evaluate: load references/evaluation-mode.md
6. For --pause/--continue: load references/pause-continue.md
7. When spawning workers (Step 5): load references/worker-prompts.md
8. When exact log format needed: load references/log-templates.md
9. When cortex is available: load references/cortex-integration.md for DB-specific paths
```

## Tasks

### Batch 1 (single developer):

1. Create `references/` directory
2. Extract content into each reference file
3. Slim down core SKILL.md with stubs and load-on-demand protocol
4. Add Reference Index to core SKILL.md
5. Verify all existing modes still referenced correctly
