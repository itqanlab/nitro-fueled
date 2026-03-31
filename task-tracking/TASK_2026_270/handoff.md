# Handoff — TASK_2026_270

## Files Changed
- packages/mcp-cortex/src/tools/workers.ts (modified, +6 -2)
- packages/mcp-cortex/src/tools/providers.ts (modified, +11 -2)
- packages/mcp-cortex/src/index.ts (modified, +3 -2)
- packages/mcp-cortex/src/tools/workers.spec.ts (modified, +49 lines — 3 new tests)

## Commits
- (pending implementation commit)

## Decisions
- `launcher` param overrides `provider` when it maps to a specific CLI: 'codex' → provider='codex', 'opencode' → provider='opencode'. 'claude-code' and absent both preserve provider-based selection.
- Used `toClientLauncherName()` in providers.ts to normalize 'claude'/'glm' → 'claude-code' in the output, since both use the Claude Code CLI binary (with different env vars for GLM).
- Codex invocation path already existed in `buildSpawnCommand()` via `provider === 'codex'` — launcher param is simply a cleaner entry point for non-provider-aware callers.

## Known Risks
- The `provider` param still works as before — `launcher` is an additive override. No breaking changes.
- `probeLauncher('glm')` in providers.ts still uses 'glm' as the probe key (ZAI_API_KEY check) — only the output display name changes to 'claude-code'.
