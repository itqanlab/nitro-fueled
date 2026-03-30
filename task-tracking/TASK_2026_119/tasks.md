# Development Tasks - TASK_2026_119

## Batch 1: Create /nitro-burn command - COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Create .claude/commands/nitro-burn.md

**File**: .claude/commands/nitro-burn.md
**Status**: COMPLETE

Created the nitro-burn command with full execution steps covering:
- Argument parsing (no args, --since, --task)
- Multi-source data aggregation (MCP list_workers, session-analytics.md, orchestrator-history.md)
- Merge and aggregation logic with fallback chain
- Output format with per-task table, project totals, and cost note
- Graceful empty state

### Task 1.2: Sync to apps/cli/scaffold/.claude/commands/nitro-burn.md

**File**: apps/cli/scaffold/.claude/commands/nitro-burn.md
**Status**: COMPLETE

Synced identical copy to the CLI scaffold so it ships with `npx @itqanlab/nitro-fueled init`.
