# Development Tasks - TASK_2026_191

## Batch 1: Scaffold Sync Audit and Fix - COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Audit scaffold vs source

**File**: apps/cli/scaffold/.claude/ (all files)
**Status**: COMPLETE

Identified 30+ files out of sync between scaffold and source. Found 6 missing reference files in auto-pilot/references/. Found 7 stale `session-orchestrator` references in scaffold (worker-prompts.md, review-general.md, agent-calibration.md).

### Task 1.2: Sync scaffold files from source

**File**: apps/cli/scaffold/.claude/ (all subdirectories)
**Status**: COMPLETE

Used rsync to sync all files from `.claude/` source to `apps/cli/scaffold/.claude/`, excluding:
- `settings.json` (intentionally different: scaffold has permissions, source has workspace hooks)
- `hooks/` (workspace-specific)
- `worktrees/` (workspace-specific)
- `settings.local.json` (workspace-specific)
- `vitest.config.ts` (test-only)
- `*.bak` files
- `artifact-renaming-validation.spec.ts` (test-only)

Added 6 missing auto-pilot reference files: cortex-integration.md, evaluation-mode.md, log-templates.md, pause-continue.md, sequential-mode.md, session-lifecycle.md.

### Task 1.3: Verify stale pattern removal

**File**: apps/cli/scaffold/.claude/ (all files)
**Status**: COMPLETE

Confirmed zero `mcp__session-orchestrator__` tool references remain in scaffold. Verified build passes. Verified all files match source via diff (excluding intentional differences).
