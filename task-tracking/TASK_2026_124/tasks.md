# Implementation Tasks — TASK_2026_124

## Batch 1: Command Entry Point + Evaluation Mode

### Task 1.1: Add --evaluate flag to nitro-auto-pilot.md command
- **Status**: COMPLETE
- **Files**: `.claude/commands/nitro-auto-pilot.md`
- Added `--evaluate <model-id>` parameter to the command's parameter table
- Added `--evaluate` parsing logic in Step 2 (Parse Arguments)
- Added evaluation mode to Step 6 (Handle Mode)
- Updated Quick Reference section with evaluate mode
- Added benchmark suite to References

### Task 1.2: Add Evaluation Mode section to SKILL.md
- **Status**: COMPLETE
- **Files**: `.claude/skills/auto-pilot/SKILL.md`
- Added Evaluation mode to the Modes table
- Added full `## Evaluation Mode` section (Steps E1-E7) after Continue Mode
- Covers: benchmark loading, worktree isolation, worker spawning, metrics collection, results storage

### Task 1.3: Add Evaluation Worker Prompt Template to SKILL.md
- **Status**: COMPLETE
- **Files**: `.claude/skills/auto-pilot/SKILL.md`
- Added `### Evaluation Build Worker Prompt` template in Worker Prompt Templates section
- Template: sets up worktree files, runs task, writes eval-result.md, commits

## Batch 2: Benchmark Loader + Results Storage

### Task 2.1: Add Benchmark Task Loader specification to SKILL.md
- **Status**: COMPLETE
- **Files**: `.claude/skills/auto-pilot/SKILL.md`
- Defined in Step E2: scans `benchmark-suite/tasks/` directories
- Parses `benchmark-suite/config.md` for task manifest and difficulty weights
- Validates task directories and builds evaluation task list

### Task 2.2: Add Evaluation Results Storage specification to SKILL.md
- **Status**: COMPLETE
- **Files**: `.claude/skills/auto-pilot/SKILL.md`
- Defined `evaluations/<date>-<model>/` directory structure (Step E3)
- Defined per-task result files format (Step E6)
- Defined session metadata file format (Step E3)
- Defined metrics fields: wall-clock time, success/failure, retry count (Step E6)
