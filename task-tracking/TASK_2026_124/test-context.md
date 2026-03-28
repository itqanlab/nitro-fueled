# Test Context — TASK_2026_124

## Task Info
- Task ID: 2026_124
- Task type: FEATURE
- Testing override: optional

## Detected Frameworks
- Primary: vitest (apps/cli — `npm test` → `vitest run`)
- E2E: none

## Test Types Required
- Unit Tests: yes (FEATURE type — regression/behavioral coverage for changed skill/command files; unit writer to assess what is testable given markdown-only scope)
- Integration Tests: no (no routes/, db/, or queries/ in File Scope)
- E2E Tests: no (no components/, pages/, or views/ in File Scope)

## File Scope
- .claude/skills/auto-pilot/SKILL.md (modified — added Evaluation Mode section, Evaluation Build Worker Prompt Template, Evaluate entry in Modes table)
- .claude/commands/nitro-auto-pilot.md (modified — added --evaluate flag, parameter, parsing, evaluation mode handler, Quick Reference update)
- evaluations/ (new directory, created at runtime by the evaluation flow)

## Notes on Testability
All changed files are markdown prompt templates / skill definitions — not executable TypeScript code.
The Vitest framework lives in `apps/cli/` (`npm test` inside that workspace runs `vitest run`).
If the unit test writer finds no meaningful unit tests possible given pure-markdown scope, it should document this clearly in test-unit-results.md and write a minimal smoke test or skip file.

## Test Command
npm test (run from apps/cli/ workspace, or: cd apps/cli && npm test)
