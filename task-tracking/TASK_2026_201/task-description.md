# Task Description — TASK_2026_201
## Provider Quota Panel

### Problem Statement

Workers consuming GLM, Anthropic, and OpenAI API quota have no in-dashboard visibility into their remaining quota. Operators must leave the app or run external scripts to check provider balances. When GLM quota exhausts, workers silently fail with no visible warning in the dashboard.

### Goal

Surface per-provider subscription usage in the Nitro-Fueled dashboard so operators can monitor quota consumption and spending without leaving the app.

### Scope

**Backend (`apps/dashboard-api`):**
- New `GET /api/providers/quota` endpoint
- Fans out to up to 3 provider APIs concurrently (GLM/ZAI, Anthropic, OpenAI)
- Returns structured quota response or graceful unavailability notice per provider
- 5-minute in-process cache (to respect provider API rate limits)
- Reads keys from env: `ZAI_API_KEY`, `ANTHROPIC_ADMIN_KEY`, `OPENAI_ADMIN_KEY`
- Never exposes raw API keys in HTTP responses

**Frontend (`apps/dashboard`):**
- New `ProviderQuotaComponent` — placed under Settings > Provider Quota tab (or new tab)
- One card per provider: name, used/limit bar, % remaining, cost this period, reset date
- "Not configured" state with tooltip pointing to missing env var
- Auto-refreshes every 5 minutes

### User Stories

1. As an operator, I can see my GLM remaining quota and reset date so I know when workers will be throttled.
2. As an operator, I can see Anthropic monthly spend so I can track costs vs budget.
3. As an operator, I can see OpenAI spend without leaving the dashboard.
4. As an operator, cards with unconfigured admin keys show a placeholder explaining which env var to set — not an error state.

### Acceptance Criteria

- `GET /api/providers/quota` returns quota data for all providers with configured keys
- Providers with missing admin keys return `{ unavailable: true, reason: "ANTHROPIC_ADMIN_KEY not set" }` — no 500 errors
- GLM quota (remaining/total/reset date) is populated from ZAI API when `ZAI_API_KEY` is set
- Anthropic monthly spend is populated when `ANTHROPIC_ADMIN_KEY` is set
- OpenAI monthly spend is populated when `OPENAI_ADMIN_KEY` is set
- Backend caches quota responses for 5 minutes
- Dashboard shows one card per provider with usage bar and cost-this-period
- "Not configured" state renders without errors and explains which env var to set
- Cards auto-refresh every 5 minutes in the UI

### Out of Scope

- Historical quota tracking / trends
- Alerts or notifications on quota thresholds
- Webhook integration with provider billing APIs
- Budget limit enforcement

### Dependencies

- TASK_2026_200 must complete first (or file scope must be coordinated) because both touch `api.service.ts` and `api.types.ts`
