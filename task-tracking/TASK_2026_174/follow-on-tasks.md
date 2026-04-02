# Follow-On Tasks — TASK_2026_174

## Proposed Tasks

| Title | Type | Priority | Rationale |
|-------|------|----------|-----------|
| Add GLM-5-specific fast-fail health checks | BUGFIX | P1-High | Reduce wasted time on stuck and zero-activity workers by shortening the strike interval and adding a first-action deadline. |
| Add no-transition circuit breaker for build workers | BUGFIX | P1-High | Detect edit loops like `TASK_2026_099` that remain active but never make state progress. |
| Restrict GLM-5 routing for DEVOPS, P0, and review/test workers | REFACTORING | P1-High | Failures span multiple task types, but these classes have the worst operational cost when fallback is slow. |
| Tighten build-worker prompt for early artifact creation | REFACTORING | P2-Medium | Forces a visible first action and reduces silent exploration loops. |

## Recommended Order

1. Fast-fail health checks
2. No-transition circuit breaker
3. Routing restriction update
4. Prompt tightening
