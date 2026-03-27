# Context — TASK_2026_049

## User Intent
Replace heuristic-only stack detection with AI-assisted workspace analysis that collects raw signals (directory tree, extension histogram, config contents, presence markers) and passes them to Claude for structured analysis, proposing agents with reasoning.

## Strategy
FEATURE — Partial workflow (Architect → Team-Leader → Dev). Requirements already defined in task.md.

## Key Decisions
- workspace-signals.ts collects raw signals (fast, no AI)
- Claude CLI (`claude -p`) performs AI analysis returning structured JSON
- Fallback to existing heuristic detection if Claude CLI unavailable
- New agent types added to agent-map.ts: designer, data-scientist, devops
- init.ts wired to use new analysis flow, replacing current handleStackDetection
