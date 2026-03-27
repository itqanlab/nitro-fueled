# Completion Report — TASK_2026_047

## Files Created
- `.claude/commands/run.md` (35 lines)
- `.claude/commands/create.md` (42 lines)
- `.claude/commands/status.md` (17 lines)
- `packages/cli/scaffold/.claude/commands/run.md` (scaffold copy)
- `packages/cli/scaffold/.claude/commands/create.md` (scaffold copy)
- `packages/cli/scaffold/.claude/commands/status.md` (scaffold copy)

## Files Modified
- `packages/cli/src/commands/run.ts` — added single-task routing to `/orchestrate`, `--task` shorthand, batch-only option rejection, `basicPreflightChecks` for single-task path, removed dead `taskId` branch from `buildAutoPilotArgs`, moved `skipConnectivity` into `RunOptions` interface

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | 6/10 (pre-fix) |
| Code Logic | 6/10 (pre-fix) |

## Findings Fixed

**BLOCKING:**
- `resolveTaskId` accepted any shorthand without validation → added `^\d{1,3}$` check before expansion with clear error message
- `/run.md` had no fallback branch for unrecognized input → added explicit error branch
- Single-task CLI silently accepted and ignored batch-only options → added early rejection with list of offending flags

**SERIOUS:**
- Single-task CLI used `preflightChecks` (requires MCP) but `/orchestrate` runs inline without MCP → switched to `basicPreflightChecks` + inline registry lookup
- Dead `taskId` branch in `buildAutoPilotArgs` → removed; batch supervisor always called with no task ID
- `skipConnectivity` leaked as intersection type at action boundary → moved into `RunOptions` interface
- `create.md` flag-stripping ambiguous for flag-in-middle/flag-only cases → specified "strip all occurrences, trim whitespace, empty description invokes interactively"
- `run.md` Notes omitted `--retries` from batch-options list → added
- `status.md` hardcoded path reference → replaced with command name reference

## New Review Lessons Added
- Review lessons updated by reviewers in `.claude/review-lessons/review-general.md` and `.claude/review-lessons/backend.md` covering: router command failure branches, preflight scope matching, shorthand expansion validation, dead branch cleanup, intersection type hygiene, and flag-stripping specification.

## Integration Checklist
- [x] `/run`, `/create`, `/status` commands present in `.claude/commands/`
- [x] Same commands copied to `packages/cli/scaffold/.claude/commands/`
- [x] CLI `run.ts` builds cleanly (tsc, no errors)
- [x] Existing commands unchanged (`/orchestrate`, `/auto-pilot`, `/plan`, `/create-task`, `/project-status`)
- [x] Single-task path does not require MCP config
- [x] Batch-only options rejected in single-task mode with clear error

## Verification Commands
```bash
# Verify new commands exist
ls .claude/commands/run.md .claude/commands/create.md .claude/commands/status.md

# Verify scaffold copies
ls packages/cli/scaffold/.claude/commands/run.md packages/cli/scaffold/.claude/commands/create.md packages/cli/scaffold/.claude/commands/status.md

# Verify build
cd packages/cli && npm run build

# Verify basicPreflightChecks import in run.ts
grep "basicPreflightChecks" packages/cli/src/commands/run.ts

# Verify --task validation
grep "^\\\^\\\\d{1,3}\\\$" packages/cli/src/commands/run.ts
```
