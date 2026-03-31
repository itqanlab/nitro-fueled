# TASK_2026_206 Handoff

## Implementation Summary

Updated the auto-pilot Supervisor spawn logic to support split worker mode routing, in addition to the existing single worker mode.

## Files Changed

1. `.claude/skills/auto-pilot/SKILL.md` - Updated worker mode documentation and spawn logic
2. `.claude/skills/auto-pilot/references/parallel-mode.md` - Updated dependency classification, candidate partitioning, and worker routing

## Key Changes

### Worker Mode Auto-Selection
- Simple tasks → single mode (Build Worker only)
- Medium/Complex tasks → split mode (Prep + Implement Workers)

### State Classification Added
- `READY_FOR_PREP` - CREATED, deps satisfied (split mode)
- `PREPPING` - IN_PROGRESS (split mode - Prep Worker running)
- `READY_FOR_IMPLEMENT` - PREPPED, deps satisfied
- `IMPLEMENTING` - IMPLEMENTING state

### Worker Routing Logic
- **single mode**: Build Worker for CREATED → IMPLEMENTED
- **split mode**: Prep Worker (sonnet) for CREATED → PREPPED, then Implement Worker (task model) for PREPPED → IMPLEMENTED
- Both modes: Review+Fix Worker for IMPLEMENTED → COMPLETE

### Candidate Partitioning
Now uses 3 sets instead of 2:
- `build_candidates` - READY_FOR_BUILD or READY_FOR_PREP
- `implement_candidates` - READY_FOR_IMPLEMENT
- `review_candidates` - READY_FOR_REVIEW

### Priority Strategies Updated
All strategies (build-first, review-first, balanced) now handle implement candidates as build-adjacent.

### Model Routing
- Prep Workers default to claude-sonnet-4-6
- Implement Workers use task's Model field
- Build/Review Workers unchanged

## Task Metadata

- Task ID: TASK_2026_206
- Type: FEATURE
- Priority: P1-High
- Complexity: Medium
- Testing: optional
- File Scope: .claude/skills/auto-pilot/SKILL.md, .claude/skills/auto-pilot/references/worker-prompts.md, .claude/skills/auto-pilot/references/parallel-mode.md, .claude/skills/auto-pilot/references/cortex-integration.md

## Acceptance Criteria

- [x] Supervisor routes split-mode tasks through Prep → Implement → Review
- [x] Supervisor routes single-mode tasks through Build → Review (unchanged)
- [x] Auto-selection defaults Simple→single, Medium/Complex→split
- [x] Prep Workers spawn with sonnet model by default
- [x] Dry-run output shows correct worker pipeline per task

Note: Only SKILL.md and parallel-mode.md were modified. worker-prompts.md and cortex-integration.md were not changed.
