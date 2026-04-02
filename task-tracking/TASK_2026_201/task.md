# Task: Provider Quota Panel

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

Surface per-provider subscription usage in the dashboard so users can monitor quota consumption and spending without leaving the app.

**Providers to integrate:**

1. **GLM / ZAI Coding Plan** — call the ZAI usage API (same source as the `glm-plan-usage:usage-query` skill) to retrieve remaining quota, total quota, and reset date. This is the highest-priority integration because GLM workers are the most frequently used and quota exhaustion silently kills workers.

2. **Anthropic** — call `GET /v1/organizations/*/usage` (requires `ANTHROPIC_ADMIN_KEY`, separate from the regular `ANTHROPIC_API_KEY`). Returns monthly token spend and cost. Fall back gracefully if the admin key is not configured — show a "Configure admin key to see usage" placeholder.

3. **OpenAI** — call `GET /v1/organization/usage` (requires `OPENAI_ADMIN_KEY`). Returns completions, tokens, and cost for the billing period. Same graceful fallback pattern if key absent.

**Backend (`dashboard-api`):**

- New `GET /api/providers/quota` endpoint that fans out to each configured provider's usage API in parallel
- Each provider returns: `{ provider, plan, used, limit, remaining, resetAt, currency, costThisPeriod }` or `{ provider, unavailable: true, reason }`
- Keys read from environment: `ZAI_API_KEY`, `ANTHROPIC_ADMIN_KEY`, `OPENAI_ADMIN_KEY`
- Cache responses for 5 minutes (quota APIs have rate limits; no need to hit them on every dashboard load)
- Never expose raw API keys in responses

**Frontend (dashboard):**

- New `ProviderQuotaWidget` component — compact card row (one card per provider) shown in the Settings view or as a collapsible panel in the sidebar
- Each card shows: provider logo/name, used/limit bar, % remaining, cost this period, reset date
- Gray out / show "Not configured" state when admin key is absent — include a tooltip explaining which env var to set
- Auto-refresh every 5 minutes (matches backend cache TTL)
- GLM card shown first (highest usage); Anthropic second; OpenAI third

## Dependencies

- None

## Acceptance Criteria

- [ ] `GET /api/providers/quota` returns quota data for all providers with configured keys
- [ ] Providers with missing admin keys return `{ unavailable: true, reason: "ANTHROPIC_ADMIN_KEY not set" }` — no 500 errors
- [ ] GLM quota (remaining/total/reset date) is populated from ZAI API when `ZAI_API_KEY` is set
- [ ] Anthropic monthly spend is populated when `ANTHROPIC_ADMIN_KEY` is set
- [ ] OpenAI monthly spend is populated when `OPENAI_ADMIN_KEY` is set
- [ ] Backend caches quota responses for 5 minutes
- [ ] Dashboard shows one card per provider with usage bar and cost-this-period
- [ ] "Not configured" state renders without errors and explains which env var to set
- [ ] Cards auto-refresh every 5 minutes in the UI

## References

- `packages/mcp-cortex/src/tools/providers.ts` — `get_available_providers`, `get_provider_stats` (internal DB stats; separate from subscription quota)
- `glm-plan-usage:usage-query` skill — existing GLM quota query logic; reuse the same API endpoint
- TASK_2026_200 — Session Run Config Panel (touches `api.service.ts` and `api.types.ts`; serialize after this task or coordinate file scope)

## Parallelism

🚫 **Do NOT run in parallel with TASK_2026_200** — both tasks modify `apps/dashboard/src/app/services/api.service.ts` and `apps/dashboard/src/app/models/api.types.ts`.

✅ Safe to run in parallel with TASK_2026_199 (analytics module — no file overlap).

Suggested execution wave: Wave 2, after TASK_2026_200 completes (or in Wave 1 if TASK_2026_200 is not being run concurrently).

## File Scope

- apps/dashboard-api/src/providers/providers.controller.ts (new)
- apps/dashboard-api/src/providers/providers.service.ts (new)
- apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.ts (new)
- apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.html (new)
- apps/dashboard/src/app/models/api.types.ts (modified — add ProviderQuota types)
- apps/dashboard/src/app/services/api.service.ts (modified — add quota fetch method)
