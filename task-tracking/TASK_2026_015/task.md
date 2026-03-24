# Task: Stack Detection Registry and Developer Agent Template

## Metadata

| Field      | Value     |
|------------|-----------|
| Type       | FEATURE   |
| Priority   | P1-High   |
| Complexity | Medium    |

## Description

Create the two foundational reference files for the Dynamic Agent/Skill Generation system:

1. **Stack Detection Registry** (`stack-detection-registry.md`) — A structured reference file mapping manifest files and patterns to tech stack identifiers. Covers 10+ ecosystems (Node.js/TypeScript, Python, Java/Kotlin, Swift/iOS, Dart/Flutter, Go, Rust, Ruby, C#/.NET, PHP), monorepo indicators, infrastructure, and database detection. Each rule has a confidence level and content patterns for disambiguation.

2. **Developer Agent Template** (`developer-template.md`) — A single source-of-truth template that generates any developer agent. Contains template variables (`{variable}`) that get populated with stack-specific content. Generated output must be structurally identical to `backend-developer.md` (same 14 sections, same order).

These files are consumed by the `/create-agent` command (TASK_2026_016) and the future CLI init flow.

Split from TASK_2026_006 (CANCELLED — too large for a single worker session).

## Dependencies

- None

## Acceptance Criteria

- [ ] `stack-detection-registry.md` exists at `.claude/skills/orchestration/references/`
- [ ] Registry covers all 10 ecosystems with detection rules
- [ ] Every detection rule has a confidence level (high/medium/low)
- [ ] Content patterns distinguish frameworks (e.g., "react" vs "angular" in package.json deps)
- [ ] Monorepo indicators included (Nx, Yarn workspaces, pnpm, Lerna, Turborepo, Bazel)
- [ ] Stack-to-Agent Mapping table included
- [ ] `developer-template.md` exists at `.claude/skills/orchestration/references/`
- [ ] Template contains all 14 sections matching `backend-developer.md` structure
- [ ] All template variables documented in a reference table
- [ ] Template is under 300 lines
- [ ] Registry is under 300 lines

## References

- TASK_2026_006 implementation plan: `task-tracking/TASK_2026_006/implementation-plan.md` (Components 1 & 2)
- TASK_2026_006 tasks.md: `task-tracking/TASK_2026_006/tasks.md` (Batches 1 & 2)
- Existing developer agents: `.claude/agents/backend-developer.md`, `.claude/agents/frontend-developer.md`, `.claude/agents/systems-developer.md`
- Reference file pattern: `.claude/skills/orchestration/references/systems-developer-patterns.md`
