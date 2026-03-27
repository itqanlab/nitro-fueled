# Test Context — TASK_2026_049

## Task Info
- Task ID: 2026_049
- Task type: FEATURE
- Testing override: none

## Detected Frameworks
- Primary: none
- E2E: none

## Test Types Required
- Unit Tests: no (no framework detected)
- Integration Tests: no (no framework detected)
- E2E Tests: no (no framework detected)

## File Scope
- `packages/cli/src/utils/workspace-signals.ts` (new)
- `packages/cli/src/utils/stack-detect.ts` (refactor — keep heuristics as fallback)
- `packages/cli/src/utils/agent-map.ts` (extend with new agent types: designer, data-scientist, devops)
- `packages/cli/src/commands/init.ts` (wire new analysis flow)

## Test Command
none — no test framework detected

## Notes
Framework detection: checked packages/cli/package.json (devDependencies: @types/node, typescript only) and root package.json. No vitest, jest, playwright, cypress, pytest, or go.mod found.
