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

Build a dedicated analytics page that shows how **every model** (GLM, Claude, GPT, Codex, and any future model) performs when paired with **every launcher/harness** (claude-code, opencode, codex-cli, glm), across all task types and complexity tiers. This is the primary tool for making informed routing decisions — knowing which model + harness combination works best for which kind of work, at what cost and reliability.

**Scope: ALL models, ALL launchers, no exceptions.** The cortex already records provider, model, and launcher for every worker — this page surfaces all of it.

**What to build:**

1. **Model × Launcher Matrix view** — dashboard page at `/analytics/model-performance`:
   - Grid: rows = every model ever used (claude-opus-4-6, claude-sonnet-4-6, glm-5, glm-4.7, glm-4.5-air, openai/gpt-5.4, openai/gpt-5.4-mini, openai/codex-mini-latest, and any others in the DB)
   - Columns = every launcher/harness ever used (claude, glm, opencode, codex)
   - Each cell: task count, success rate %, avg review score, avg cost, avg duration
   - Color-coded heatmap (green = high success/low cost, red = low success/high cost)
   - Empty cells (combination never used) greyed out
   - Click any cell → filtered task list for that model+launcher pair

2. **Per-Model Detail panel** — clicking a model row expands inline:
   - Success rate by task type (FEATURE, BUGFIX, REFACTORING, RESEARCH, etc.)
   - Success rate by complexity tier (Simple, Medium, Complex)
   - Review score distribution (code logic, style, security scores)
   - Avg cost per task type
   - Compaction rate — how often context fills up (key reliability signal; varies significantly by model)
   - Context overflow rate — how often the worker exceeded 100% context (new `context_overflow` health state)
   - Common failure patterns — top 3 failure reasons from TASK_FAILED events

3. **Per-Launcher/Harness Detail** — dedicated section per launcher:
   - **Claude Code harness** — compaction behavior, tool call patterns, session stability, context management quality
   - **OpenCode harness** — same metrics; note: no native compaction, context overflow patterns
   - **Codex CLI harness** — same metrics
   - **GLM harness** — same metrics
   - Cross-launcher comparison: for the same model, which harness produces better outcomes?
   - Harness reliability: worker crash rate, stuck rate (no activity > 2min), orphaned claim rate
   - Harness-specific quirks visible in data: e.g. opencode workers tend to hit high_context without compaction

4. **Routing Recommendations** — card row at top of page:
   - "Best for FEATURE/Complex" — top model+launcher by success rate
   - "Most cost-efficient for Simple" — lowest avg cost with >80% success rate
   - "Most reliable overall" — highest success rate across all task types
   - "Best harness for model X" — which launcher gets the best results from each model
   - Each card shows confidence % based on sample size

5. **Backend endpoints** in dashboard-api:
   - `GET /api/analytics/model-performance` — full matrix: every model×launcher pair aggregated
   - `GET /api/analytics/model-performance/:modelId` — per-model breakdown
   - `GET /api/analytics/launcher/:launcherId` — per-launcher harness metrics
   - Data sources: cortex `get_model_performance`, `get_provider_stats`, `query_events`, workers table

## Dependencies

- None

## Acceptance Criteria

- [ ] All models and all launchers present in the DB appear in the matrix — no hardcoded model list
- [ ] Each matrix cell shows success rate, avg cost, and task count
- [ ] Per-model detail expands inline with breakdown by task type, complexity, compaction rate, and context overflow rate
- [ ] Per-launcher section shows harness-specific reliability metrics (crash rate, stuck rate, orphaned claim rate)
- [ ] Routing recommendation cards appear at the top with confidence % and "best harness per model" card
- [ ] `GET /api/analytics/model-performance` and `GET /api/analytics/launcher/:id` return real aggregated data from cortex
- [ ] Empty model×launcher combinations shown as greyed-out (not errors)

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
- apps/dashboard-api/src/analytics/analytics.controller.ts (new — model-performance + launcher endpoints)
- apps/dashboard-api/src/analytics/analytics.service.ts (new)
- apps/dashboard/src/app/app.routes.ts (modified — add model-performance route)
