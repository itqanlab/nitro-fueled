# Handoff — TASK_2026_282

## Files Changed
- apps/cli/src/utils/artifact-generator.ts (new, ~170 lines) — single-pass AI call that generates CLAUDE.nitro.md + anti-patterns.md + all agent files from a ProjectProfile
- apps/cli/src/utils/claude-md.ts (modified, +90 lines) — added `buildClaudeNitroMdFromProfile` and `generateClaudeNitroMd` functions
- apps/cli/src/utils/anti-patterns.ts (modified, +55 lines) — added `buildAntiPatternsFromProfile` and `generateAntiPatternsFromProfile` functions
- apps/cli/src/commands/init.ts (modified) — replaced separate `handleAntiPatterns` + `handleStackDetection` with unified `handleWorkspaceArtifacts`; added CLAUDE.nitro.md tracking to manifest

## Commits
- (pending)

## Decisions
- Single-pass AI call (`generateArtifactsFromProfile`) returns a JSON with all three artifacts: `claudeNitroMd`, `antiPatterns`, `agents[]`. This satisfies "one or two AI calls total" — call 1 is `runAIAnalysis` (existing), call 2 is the new batch artifact generation.
- Fallback chain: AI batch → profile-based deterministic → tag-filter (anti-patterns) / static template (CLAUDE.nitro.md) → heuristic one-by-one agent generation. Each layer is independent so any failure degrades gracefully.
- Agent name validation via `AGENT_NAME_RE` in artifact-generator.ts prevents path traversal from AI-returned names (same allowlist as stack-detect.ts).
- `generateAgentFallback` kept as the old one-by-one approach for when AI batch generation isn't available or returns no agents.

## Known Risks
- The single-pass AI response is a large JSON containing 3+ file contents; parsing failure silently falls back to deterministic generation.
- CLAUDE.nitro.md line count is asserted by the prompt ("under 200 lines") but not validated programmatically — AI may occasionally exceed it.
