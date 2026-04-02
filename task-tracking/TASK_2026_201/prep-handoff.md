# Prep Handoff — TASK_2026_201

## Implementation Plan Summary

Add a Provider Quota Panel to the Nitro-Fueled dashboard. The backend gets a new standalone `ProvidersModule` (NestJS) with a single `GET /api/providers/quota` endpoint that fans out to GLM/ZAI, Anthropic, and OpenAI usage APIs in parallel, caches results for 5 minutes, and returns a typed array of per-provider quota items (each either "available" with usage data or "unavailable" with a reason). The frontend gets a new `ProviderQuotaComponent` (Angular standalone) wired as a new "Provider Quota" tab in the existing Settings view, showing one card per provider with a usage bar, cost, reset date, and a "Not configured" overlay for missing admin keys. Auto-refreshes every 5 minutes.

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| `apps/dashboard-api/src/providers/providers.module.ts` | create | NestJS module wrapper |
| `apps/dashboard-api/src/providers/providers.controller.ts` | create | `GET /api/providers/quota` route |
| `apps/dashboard-api/src/providers/providers.service.ts` | create | Fan-out logic, cache, provider HTTP calls |
| `apps/dashboard-api/src/app/app.module.ts` | modify | Register ProvidersModule in imports[] |
| `apps/dashboard/src/app/models/api.types.ts` | modify | Add ProviderQuotaItem types |
| `apps/dashboard/src/app/services/api.service.ts` | modify | Add getProviderQuota() method |
| `apps/dashboard/src/app/models/settings.model.ts` | modify | Add 'quota' to SettingsTab union + SETTINGS_TABS array |
| `apps/dashboard/src/app/views/settings/settings.component.ts` | modify | Import ProviderQuotaComponent |
| `apps/dashboard/src/app/views/settings/settings.component.html` | modify | Add @case ('quota') branch |
| `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.ts` | create | Component class with signals + auto-refresh |
| `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.html` | create | 3-card grid template |
| `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.scss` | create | Card layout styles |

## Batches

- **Batch 1: Backend ProvidersModule** — create `providers/providers.module.ts`, `providers.controller.ts`, `providers.service.ts`; modify `app.module.ts`
- **Batch 2: Frontend types + service wiring** — modify `api.types.ts`, `api.service.ts`, `settings.model.ts`, `settings.component.ts`, `settings.component.html`
- **Batch 3: ProviderQuotaComponent** — create `provider-quota.component.ts`, `.html`, `.scss`

## Key Decisions

- **Standalone NestJS module** (not folded into DashboardModule): mirrors the `TasksModule` pattern; keeps quota concerns isolated.
- **`Promise.allSettled` for fan-out**: one slow/failing provider must never block the others — settled rejections map to `{ unavailable: true }` entries.
- **In-process Map cache** (not Redis): single-instance API; 5-min TTL sufficient; no new dependency.
- **Settings tab placement** (not sidebar widget): existing Settings page already has a 4-tab layout; adding a 5th tab is the least-disruptive integration point.
- **Angular standalone component**: no module registration needed; just import directly into `SettingsComponent.imports[]`.
- **SETTINGS_TABS** location: `apps/dashboard/src/app/models/settings.model.ts` — confirmed by grep. Add `{ id: 'quota', label: 'Provider Quota', icon: '📊' }` and extend the `SettingsTab` union.

## Gotchas

- **`SETTINGS_TABS` is `as const`**: the `SettingsTab` type is a string union derived from it. Adding `'quota'` requires updating BOTH the union literal type AND the `SETTINGS_TABS` array, otherwise the compiler will reject the cast in `settings.component.ts`.
- **Anthropic admin key vs regular API key**: the endpoint uses `ANTHROPIC_ADMIN_KEY` (separate from `ANTHROPIC_API_KEY`). The service must check for this specific env var, not the regular key.
- **OpenAI usage endpoint buckets**: `GET /v1/organization/usage` returns multiple time-bucket objects. Sum `n_context_tokens_total` + `n_generated_tokens_total` across all returned buckets for the billing period. Pass `start_time` = first day of current month as a Unix timestamp.
- **GLM API endpoint**: `https://open.bigmodel.cn/api/paas/v4/user/usage` — expects `Authorization: Bearer <key>`. Returns `{ data: { remaining_tokens, total_tokens, reset_at } }`. Map `used = total_tokens - remaining_tokens`.
- **Never 500**: the controller must always return 200 with the quota array. If all 3 providers fail/are unconfigured, return an array of 3 `unavailable` items.
- **Do NOT expose env var values in response**: only expose the env var name (for the "Not configured" tooltip), never the actual key value.
- **File conflict with TASK_2026_200**: if `api.types.ts` or `api.service.ts` were touched by TASK_2026_200 concurrently, resolve any merge conflicts carefully — do not overwrite the other task's additions.
