# Task: Model × Launcher Performance Report

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | FEATURE                      |
| Priority              | P1-High                      |
| Complexity            | Medium                       |
| Preferred Tier        | balanced                     |
| Model                 | default                      |
| Testing               | optional                     |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

Build a dedicated analytics page that shows how every model performs when paired with every launcher, across all task types and complexity tiers. This is the primary tool for making informed routing decisions — knowing which model + launcher combination works best for which kind of work, at what cost and reliability.

**What to build:**

1. **Model × Launcher Matrix view** — dashboard page at `/analytics/model-performance`:
   - Grid: rows = models (glm-5, glm-4.7, claude-opus-4-6, gpt-5.4, etc.), columns = launchers (claude, glm, opencode, codex)
   - Each cell: task count, success rate %, avg review score, avg cost, avg duration
   - Color-coded heatmap cells (green = high success/low cost, red = low success/high cost)
   - Empty cells (combination never used) shown as greyed out
   - Click any cell to drill into a filtered task list for that model+launcher pair

2. **Per-Model Detail panel** — clicking a model row expands an inline detail section:
   - Success rate by task type (FEATURE, BUGFIX, REFACTORING, RESEARCH, etc.)
   - Success rate by complexity tier (Simple, Medium, Complex)
   - Review score distribution (code logic, style, security — sourced from review events)
   - Avg cost per task type
   - Compaction rate (context fills up frequently = reliability risk)
   - Common failure patterns (from TASK_FAILED events — top 3 failure reasons)

3. **Launcher Effectiveness section** — below the matrix:
   - Per-launcher reliability metrics: worker crash rate, stuck worker rate, avg worker duration
   - Cost comparison: for the same model, which launcher is cheaper/faster
   - Best model per launcher (highest success rate for each launcher)

4. **Routing Recommendations** — a card row at the top of the page:
   - "Best for FEATURE/Complex" — top model+launcher by success rate on that combination
   - "Most cost-efficient for Simple tasks" — lowest avg cost with >80% success rate
   - "Most reliable overall" — highest success rate across all task types
   - Each card shows the recommendation with confidence % (based on sample size) and a "Use this routing" link

5. **Backend endpoints** in dashboard-api:
   - `GET /api/analytics/model-performance` — full matrix data: for each model×launcher pair, aggregate success rate, avg cost, avg duration, avg review score, task count
   - `GET /api/analytics/model-performance/:modelId` — per-model breakdown by task type and complexity
   - Data sources: cortex MCP tools `get_model_performance`, `get_provider_stats`, and direct task/event queries

## Dependencies

- None

## Acceptance Criteria

- [ ] `/analytics/model-performance` renders the matrix with at least mock data fallback when no real data exists
- [ ] Each matrix cell shows success rate, cost, and task count
- [ ] Per-model detail expands inline with breakdown by task type and complexity
- [ ] Routing recommendation cards appear at the top with confidence indicators
- [ ] `GET /api/analytics/model-performance` endpoint returns real aggregated data from cortex
- [ ] Empty model×launcher combinations are shown as greyed-out (not errors)

## References

- `packages/mcp-cortex/src/index.ts` — `get_model_performance`, `get_provider_stats` tools already exist
- TASK_2026_171 — Analytics Reports (session/cost reports; this task is model-focused, different page)
- TASK_2026_174 — GLM-5 Reliability Investigation (related research; findings will populate this report)

## Parallelism

✅ Can run in parallel — no file scope conflicts with any currently CREATED task. TASK_2026_171 touches `apps/dashboard-api/src/dashboard/` (report endpoints); this task creates a separate `apps/dashboard-api/src/analytics/` module.

Suggested execution wave: Wave 1 (independent).

## File Scope

- apps/dashboard/src/app/views/analytics/model-performance/model-performance.component.ts (new)
- apps/dashboard/src/app/views/analytics/model-performance/model-performance.component.html (new)
- apps/dashboard-api/src/analytics/analytics.controller.ts (new)
- apps/dashboard-api/src/analytics/analytics.service.ts (new)
- apps/dashboard/src/app/app.routes.ts (modified — add model-performance route)
