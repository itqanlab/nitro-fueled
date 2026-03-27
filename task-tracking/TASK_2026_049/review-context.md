# Review Context — TASK_2026_049

## Task Scope
- Task ID: 2026_049
- Task type: FEATURE
- Files in scope: (the ONLY files reviewers may touch)
  - `packages/cli/src/utils/workspace-signals.ts` (new)
  - `packages/cli/src/utils/stack-detect.ts` (refactor)
  - `packages/cli/src/utils/agent-map.ts` (extend)
  - `packages/cli/src/commands/init.ts` (wire new analysis flow)

## Git Diff Summary

Implementation commit: `e2508a5 feat(TASK_2026_049): add AI-assisted workspace analysis for stack detection`

### Files changed

**packages/cli/src/utils/workspace-signals.ts** (new, 298 lines)
- New module for collecting workspace signals (directory tree, extension histogram, config files, presence markers)
- Exports: `WorkspaceSignals` interface, `collectWorkspaceSignals()`, `formatSignalsForPrompt()`
- Helper functions: `walkTree()`, `buildExtensionHistogram()`, `detectPresenceMarkers()`, `collectConfigFiles()`, `readFileSafe()`
- IGNORED_DIRS constant for skipping non-relevant directories
- CONFIG_FILES list of known manifest/config filenames
- MAX_CONFIG_BYTES = 4096 cap on config file reads

**packages/cli/src/utils/stack-detect.ts** (refactor)
- Added `spawnSync` import from `node:child_process`
- Added imports from `workspace-signals.ts`
- Extended `AgentProposal` interface with optional `reason?: string` and `confidence?: 'high' | 'medium' | 'low'`
- New interfaces: `AIAnalysisResult`, `WorkspaceAnalysisResult`
- New exported functions: `proposeAgentsFromMarkers()`, `runAIAnalysis()`, `analyzeWorkspace()`
- New internal functions: `parseAIAnalysisResponse()`, `aiAgentsToProposals()`, `mergeProposals()`
- `AI_ANALYSIS_PROMPT` constant string
- `proposeAgents()` JSDoc updated

**packages/cli/src/utils/agent-map.ts** (extend)
- Added 6 new domain agent entries with `_design`, `_data-science`, `_infrastructure` pseudo-languages

**packages/cli/src/commands/init.ts** (wire)
- Updated import to include `analyzeWorkspace` and `WorkspaceAnalysisResult`
- `handleStackDetection()` refactored: calls `analyzeWorkspace()` instead of `detectStack()` + `proposeAgents()` directly
- Shows AI analysis summary/domains when method is 'ai'
- Shows per-proposal reason and confidence when present
- Proper fallback behavior when Claude CLI unavailable

## Project Conventions

From CLAUDE.md:
- TypeScript throughout
- Conventional commits with scopes
- No `any` type — use `unknown` + type guards or generics
- No `as` type assertions
- File names: kebab-case
- Do NOT start git commit/push without explicit user instruction

From review-general.md (relevant to TypeScript CLI files):
- **No `any` type ever** — use `unknown` + type guards or proper generics
- **No `as` type assertions** — use type guards or generics instead
- **String literal unions for status/type/category fields** — never bare `string`
- **No unused imports or dead code**
- **File generation functions must guard all I/O with try/catch and return a typed failure**
- **Never swallow errors** — at minimum, log them. No empty catch blocks
- **Falsy checks skip zero values** — use `!== undefined` or `!= null`
- **Components: max 150 lines. Services: max 200 lines.** (`workspace-signals.ts` is 298 lines — flag if violations)
- **No redundant `as const`** on already-typed `readonly` arrays

## Style Decisions from Review Lessons

Relevant to TypeScript utility files:
- Explicit access modifiers on ALL class members (not applicable here — no classes — but watch for exported function consistency)
- String literal unions for `'high' | 'medium' | 'low'` confidence — already implemented as union type ✓
- `try/catch` required on all file I/O — check `readFileSafe`, `walkTree`, `collectConfigFiles`
- `spawnSync` result: check that `result.stdout` and `result.stderr` typed/handled safely (no `as` assertions)
- `parseAIAnalysisResponse`: uses `as Record<string, unknown>` — check if `as` assertion is justified or needs a type guard
- File size: `workspace-signals.ts` is 298 lines, exceeding 200-line service limit — reviewers should flag this

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `packages/cli/src/utils/workspace-signals.ts`
- `packages/cli/src/utils/stack-detect.ts`
- `packages/cli/src/utils/agent-map.ts`
- `packages/cli/src/commands/init.ts`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 3
- Serious: 8
- Minor: 9
