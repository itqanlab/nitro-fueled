# Completion Report — TASK_2026_021

## Files Created
- `session-orchestrator/src/core/process-launcher.ts` (125 lines) — shared subprocess boilerplate
- `session-orchestrator/src/tools/spawn-worker.ts` (184 lines) — extracted spawn_worker handler

## Files Modified
- `session-orchestrator/src/types.ts` — Added `Provider` type (`'claude' | 'glm' | 'opencode'`), `provider` field on `Worker`, `'opencode'` to `LauncherMode`
- `session-orchestrator/src/core/print-launcher.ts` — Refactored to use process-launcher, added provider option, GLM env builder, ZAI_API_KEY guard, removed dead `isPrintProcessAlive`
- `session-orchestrator/src/core/opencode-launcher.ts` — Refactored to use process-launcher, added exit code tracking via `getOpenCodeExitCode(pid)`
- `session-orchestrator/src/core/worker-registry.ts` — Added `provider` to register opts with default `'claude'`
- `session-orchestrator/src/core/token-calculator.ts` — Added GLM (zero-cost) and OpenAI model pricing; changed unknown-model fallback to zero-cost + console.warn
- `session-orchestrator/src/core/jsonl-watcher.ts` — Added opencode branch in `autoCloseWorker`, exit-code-aware status (non-zero → `failed`), extended auto-close check to opencode workers
- `session-orchestrator/src/index.ts` — Delegates to spawn-worker.ts, clean type imports, provider surfaced in list/stats/activity outputs (184 lines, under 200 limit)
- `nitro-fueled/packages/cli/scaffold/task-tracking/task-template.md` — Added Provider and Model metadata fields with documentation
- `nitro-fueled/.claude/skills/auto-pilot/SKILL.md` — Step 2 extracts Provider, step 5c adds routing table and provider resolution, step 5d passes provider to spawn_worker; routing table differentiates review worker types

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | 5/10 (pre-fix) → ~8/10 post-fix |
| Code Logic | 6/10 (pre-fix) → ~9/10 post-fix |

## Findings Fixed
- **BLOCKING**: ZAI_API_KEY missing → silent auth failure → added guard, throws immediately
- **BLOCKING**: OpenCode workers marked `completed` regardless of exit code → exit code tracking + `failed` on non-zero
- **BLOCKING**: `index.ts` over 200 lines (was 313) → extracted spawn_worker to tools/spawn-worker.ts, now 184
- **BLOCKING**: `opencode` not handled in `jsonl-watcher.ts` auto-close → added `killOpenCodeProcess` branch
- **SERIOUS**: ~100 lines duplication between launchers → extracted to `process-launcher.ts`
- **SERIOUS**: Inline `import()` type assertions → added `JsonlMessage` to top-level imports
- **SERIOUS**: `calculateCost` fell back to Opus for unknown models → zero-cost fallback + warning
- **SERIOUS**: Dead `isPrintProcessAlive` export → removed
- **SERIOUS**: Routing table collapsed all review workers to claude/opus → differentiated by type
- **SERIOUS**: No OpenCode row in routing table → added DOCS/RESEARCH Build Worker row and catch-all fallback
- **MINOR (applied)**: `use_iterm=true` + `provider=opencode` incompatibility → rejected with clear error

## New Review Lessons Added
- backend.md: Validate required env vars at spawn time for provider-specific workers
- backend.md: Process exit code must reach the registry for non-Claude launchers
- backend.md: Pricing table fallbacks must not default to the most expensive model
- backend.md: Provider/model cross-validation at the MCP boundary
- backend.md: Mutually exclusive flags need explicit rejection

## Integration Checklist
- [x] Build passes (`npm run build` in session-orchestrator) — clean TypeScript compilation
- [x] `provider` field plumbed through types → registry → all MCP output tools
- [x] GLM env isolation: `buildGlmEnv()` spreads process.env — no global mutation, concurrent workers safe
- [x] ZAI_API_KEY guard throws before spawn, not after API call
- [x] Exit code tracking for opencode workers prevents false-positive Review Worker spawns
- [x] task-template.md Provider/Model fields have inline documentation

## Verification Commands
```bash
# Verify provider field in types
grep -n "provider" /Volumes/SanDiskSSD/mine/session-orchestrator/src/types.ts

# Verify ZAI_API_KEY guard
grep -n "ZAI_API_KEY" /Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts

# Verify exit code tracking
grep -n "getOpenCodeExitCode\|exitCodes" /Volumes/SanDiskSSD/mine/session-orchestrator/src/core/opencode-launcher.ts

# Verify index.ts line count
wc -l /Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts

# Verify routing table in auto-pilot SKILL.md
grep -A 10 "Provider Routing Table" /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
```
