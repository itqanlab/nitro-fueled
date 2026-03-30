# Review Context — TASK_2026_122

## Scores
| Review | Score |
|--------|-------|
| Code Style | 5/10 |
| Code Logic | 5/10 |
| Security | 8/10 |

## Findings Summary
| ID | Severity | Source | File | Description |
|----|----------|--------|------|-------------|
| B1 | Critical | Style | auto-pilot SKILL.md | Dual `cortex_available` detection — pre-flight says "inspect tool list", Step 2 says "call get_tasks()". Conflicting. Remove Step 2 redefinition, cross-reference pre-flight. |
| B2 | Critical | Style | mcp-configure.ts | `configureNitroCortex` is 39-line verbatim copy of `configureMcp`. Extract shared helper. |
| B3 | Critical | Style | init.ts | `printSummary` produces two lines labelled step 4. Use mutable step counter. |
| C1 | Critical | Logic+Security | scaffold/settings.json | `{{NITRO_CORTEX_PATH}}` placeholder never substituted — scaffold copy is verbatim. Remove mcpServers block entirely; rely on interactive configureNitroCortex() flow. |
| C2 | Critical | Logic | scaffold/settings.json | `mcp__nitro-cortex__emit_event` missing from permissions allow-list — Supervisor event queue never populated. |
| S1 | High | Logic | auto-pilot SKILL.md | No `release_task()` call in Step 5g (spawn failure) — task stays locked for session lifetime. |
| S2 | High | Logic | auto-pilot SKILL.md | `cortex_available` can be set by two mechanisms (tool-list pre-Step1 AND get_tasks Step2). Define a single resolution point. |
| S3 | High | Style+Security | mcp-configure.ts | `configureNitroCortex` omits portability warning for project-level config that `configureMcp` emits. |
| S4 | High | Style | init.ts | Two `as Record<string, unknown>` assertions in `handleNitroCortexConfig` — violates no-as-assertions rule. |
| M1 | Medium | Security | mcp-configure.ts | `mergeJsonFile` writes without `mode: 0o600` — files world-readable. |
| M2 | Medium | Style | orchestration SKILL.md | Step `6a.` immediately followed by `6.` — violates flat sequential numbering rule. Renumber to `5a.`/`5b.` etc. |
| M3 | Low | Security | init.ts | `handleNitroCortexConfig` "already configured" guard checks only `.mcp.json`, not `~/.claude.json`. |

## Decision: Fix All Critical + High. Fix M1-M2. Note M3 as won't-fix (acceptable UX tradeoff).
