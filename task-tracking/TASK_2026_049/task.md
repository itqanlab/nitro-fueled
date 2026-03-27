# Task: AI-Assisted Workspace Analysis for Stack Detection

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P0-Critical |
| Complexity | Medium      |

## Description

Replace the current heuristic-only `stack-detect.ts` with an AI-assisted workspace analysis pass. The current implementation only reads manifest files (`package.json`, `requirements.txt`, etc.) and does keyword matching — it misses Figma workspaces, Jupyter notebooks, Terraform repos, monorepos with mixed apps, and anything that doesn't follow a standard manifest pattern.

### New flow

```
1. Collect raw signals (TS, fast, no AI):
   - Full directory tree (depth 3, filtered)
   - File extension counts
   - Key config file contents (package.json, pyproject.toml, go.mod, etc.)
   - Presence of design files (.fig), notebooks (.ipynb), infra files (.tf, k8s/)

2. Pass signals to Claude (AI analysis):
   - Prompt: "Analyze this workspace and identify: what domains are present,
     what agents are needed, and why"
   - Claude returns: detected domains, agent proposals with reasoning

3. Present to user:
   - Show Claude's analysis summary
   - Show proposed agents with reasoning
   - User confirms, edits, or skips each

4. Generate confirmed agents via /create-agent
```

### Signal collection (keep in TS, fast)

Extend `stack-detect.ts` into a `workspace-signals.ts` collector:
- Directory tree (depth 3, exclude node_modules/.git/dist)
- Extension histogram: `.ts`, `.py`, `.fig`, `.ipynb`, `.tf`, `.swift`, `.kt`, etc.
- Config file contents: same manifests as today + `.figma`, `docker-compose.yml`, `*.tf`
- Presence markers: `apps/` dir (monorepo), `packages/` dir, `notebooks/` dir

### AI analysis prompt

Pass collected signals to `claude -p` with a structured prompt that requests JSON output:

```json
{
  "domains": ["frontend", "backend", "design", "infrastructure"],
  "agents": [
    {
      "name": "react-developer",
      "title": "React Developer",
      "reason": "Found React 18 in package.json with Next.js",
      "confidence": "high"
    },
    {
      "name": "ui-ux-designer",
      "title": "UI/UX Designer",
      "reason": "Found .fig files in /design directory",
      "confidence": "high"
    }
  ],
  "summary": "Full-stack Next.js app with Figma design workflow"
}
```

### Fallback

If Claude CLI is unavailable, fall back to the current heuristic-only detection with a notice: "Claude CLI not available — using basic stack detection. Re-run init after installing Claude CLI for full workspace analysis."

## Dependencies

- TASK_2026_052 (Manifest) must be COMPLETE before this runs — both modify `init.ts`

## Parallelism

**Do NOT run in parallel with TASK_2026_052.** Both modify `packages/cli/src/commands/init.ts`.
Run after TASK_2026_052 completes (Wave 2).

## Acceptance Criteria

- [ ] `packages/cli/src/utils/workspace-signals.ts` collects directory tree + extension histogram + config contents
- [ ] Figma files (`.fig`) → proposes `ui-ux-designer` agent
- [ ] Jupyter notebooks (`.ipynb`) → proposes data science agent
- [ ] Terraform files (`.tf`) → proposes devops agent
- [ ] Monorepo structure (`apps/` or `packages/` directories) → detected and reported in summary
- [ ] AI analysis produces structured JSON with agent proposals + reasoning
- [ ] User sees Claude's reasoning before confirming agent generation
- [ ] Falls back to heuristic detection if Claude CLI unavailable
- [ ] All existing stack detection behavior (React, Next.js, Python, etc.) still works
- [ ] TypeScript compiles cleanly

## File Scope

- `packages/cli/src/utils/workspace-signals.ts` (new)
- `packages/cli/src/utils/stack-detect.ts` (refactor — keep heuristics as fallback)
- `packages/cli/src/utils/agent-map.ts` (extend with new agent types: designer, data-scientist, devops)
- `packages/cli/src/commands/init.ts` (wire new analysis flow)
