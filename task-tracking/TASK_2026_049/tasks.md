# Development Tasks - TASK_2026_049

## Batch 1: Signal Collection and Agent Map Extension - COMPLETE

**Developer**: backend-developer

### Task 1.1: Create workspace-signals.ts — Signal Collector

**File**: packages/cli/src/utils/workspace-signals.ts
**Status**: COMPLETE

Implemented `collectWorkspaceSignals()` that collects:
- Directory tree (depth 3, filtered — excludes node_modules, .git, dist, etc.)
- File extension histogram (top 30 by count)
- Config file contents (package.json, tsconfig.json, pyproject.toml, go.mod, Cargo.toml, docker-compose.yml, terraform files, etc.)
- Presence markers for: monorepo patterns (apps/, packages/, nx, lerna, turbo, pnpm), design files (.fig, .sketch, .xd), notebooks (.ipynb), infrastructure (terraform, kubernetes, docker, github-actions), mobile (ios/android, flutter), docs

Also implemented `formatSignalsForPrompt()` to format signals into a compact string for AI consumption.

### Task 1.2: Extend agent-map.ts with Cross-Language Domain Agents

**File**: packages/cli/src/utils/agent-map.ts
**Status**: COMPLETE

Added 6 new agent mappings for cross-language domains using `_` prefixed language keys:
- `_design` → ui-ux-designer
- `_data-science` → data-science-developer
- `_infrastructure` + terraform → terraform-developer
- `_infrastructure` + kubernetes → kubernetes-developer
- `_infrastructure` + docker → docker-developer
- `_infrastructure` (generic) → devops-developer

## Batch 2: AI Analysis and Init Integration - COMPLETE

**Developer**: backend-developer

### Task 2.1: Add AI Analysis to stack-detect.ts

**File**: packages/cli/src/utils/stack-detect.ts
**Status**: COMPLETE

Added:
- `AIAnalysisResult` interface — structured JSON response from Claude
- `WorkspaceAnalysisResult` interface — combined result with method indicator
- `proposeAgentsFromMarkers()` — maps presence markers to agent proposals
- `runAIAnalysis()` — spawns `claude -p` with structured prompt requesting JSON
- `parseAIAnalysisResponse()` — validates and parses AI response with runtime checks
- `analyzeWorkspace()` — orchestrates heuristic + marker + AI analysis with merge/dedup
- `mergeProposals()` — deduplicates proposals, enriches heuristic results with AI reasoning

Fallback: if Claude CLI unavailable, returns heuristic + marker proposals only.

### Task 2.2: Wire AI Analysis into init.ts

**File**: packages/cli/src/commands/init.ts
**Status**: COMPLETE

Updated `handleStackDetection()` to:
1. Call `analyzeWorkspace()` which runs full pipeline (heuristic + markers + AI)
2. Display analysis method (ai-assisted vs heuristic), summary, and domains
3. Show proposals with confidence levels and AI reasoning when available
4. Fall back gracefully when Claude CLI is unavailable
5. Existing heuristic behavior preserved as fallback path
