# Handoff — TASK_2026_281

## Files Changed
- apps/cli/src/utils/workspace-signals.ts (modified — extended WorkspaceSignals interface with readmeContent, activityFiles, entryPoints, sampledFiles; added readReadme, collectGitActivityFiles, detectEntryPoints, sampleSourceFiles; updated collectWorkspaceSignals and formatSignalsForPrompt)
- apps/cli/src/utils/stack-detect.ts (modified — added ProjectProfile interface, deprecated AIAnalysisResult as alias, updated AI prompt to request full ProjectProfile JSON, updated parseAIAnalysisResponse/runAIAnalysis/WorkspaceAnalysisResult to use ProjectProfile)

## Commits
- 33061d0: feat(cli): hybrid codebase sampling for init — readme, git activity, source file sampling

## Decisions
- README capped at 2048 bytes; sampled source files capped at 1536 bytes each × 3 files max = ~4.5KB for source sampling
- git log paths validated (no `..`, no `/` prefix, no `\0`) before file reads
- Sampled file paths validated against resolve(cwd) to prevent path traversal
- AIAnalysisResult kept as deprecated type alias for ProjectProfile — no breaking change for init.ts
- Entry points merged with activity files (entry points first) as sampling candidates

## Known Risks
- Git log is unavailable in repos with no history — returns [] gracefully
- Sampled files may include generated code if entry points are bundled outputs — the SOURCE_EXTENSIONS filter reduces risk but doesn't eliminate it
