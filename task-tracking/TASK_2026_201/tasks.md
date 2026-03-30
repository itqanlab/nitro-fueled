# Task Batches — TASK_2026_201
## Provider Quota Panel

---

## Batch 1 — Backend: ProvidersModule

**Status:** PENDING

**Summary:** Create the NestJS `ProvidersModule` with controller, service, and register it in `AppModule`. Implement the fan-out logic, in-process cache, and per-provider API calls.

**Files:**
- `apps/dashboard-api/src/providers/providers.module.ts` — create
- `apps/dashboard-api/src/providers/providers.controller.ts` — create
- `apps/dashboard-api/src/providers/providers.service.ts` — create
- `apps/dashboard-api/src/app/app.module.ts` — modify (import ProvidersModule)

**Subtasks:**
1. Create `providers.service.ts`:
   - Define `ProviderQuotaItem` type (available / unavailable union)
   - Implement `getQuota()` — reads env, fans out with `Promise.allSettled`, returns `ProviderQuotaItem[]`
   - GLM: call ZAI usage API (`https://open.bigmodel.cn/api/paas/v4/user/usage`)
   - Anthropic: call `/v1/organizations/usage` with `ANTHROPIC_ADMIN_KEY`
   - OpenAI: call `/v1/organization/usage` with `OPENAI_ADMIN_KEY`, sum buckets for billing period
   - In-process Map cache with 5-min TTL
   - All provider fetch errors resolve to `{ unavailable: true, reason: <string> }` — never throw
2. Create `providers.controller.ts`:
   - `@Controller('api/providers')` with `@Get('quota')`
   - Returns `ProviderQuotaItem[]`
3. Create `providers.module.ts`
4. Register `ProvidersModule` in `app.module.ts`

---

## Batch 2 — Frontend: Types + Service

**Status:** PENDING

**Summary:** Add `ProviderQuotaItem` types to `api.types.ts` and `getProviderQuota()` to `api.service.ts`. Add `'quota'` tab to `SETTINGS_TABS` and wire `SettingsComponent`.

**Files:**
- `apps/dashboard/src/app/models/api.types.ts` — modify (add quota types)
- `apps/dashboard/src/app/services/api.service.ts` — modify (add getProviderQuota)
- `apps/dashboard/src/app/models/settings.model.ts` — modify (add quota tab)
- `apps/dashboard/src/app/views/settings/settings.component.ts` — modify (import ProviderQuotaComponent)
- `apps/dashboard/src/app/views/settings/settings.component.html` — modify (@case 'quota')

**Subtasks:**
1. In `api.types.ts`: add `ProviderId`, `ProviderQuotaAvailable`, `ProviderQuotaUnavailable`, `ProviderQuotaItem`
2. In `api.service.ts`: add `getProviderQuota(): Observable<ProviderQuotaItem[]>`
3. In `settings.model.ts`: add `'quota'` to `SettingsTab` union and `SETTINGS_TABS` array
4. In `settings.component.ts`: import `ProviderQuotaComponent`, add to `imports[]`
5. In `settings.component.html`: add `@case ('quota')` with `<app-provider-quota>`

**Note:** Batch 2 depends on Batch 1 being designed (types must match). But can be implemented concurrently with Batch 1 since it only uses types and an HTTP call.

---

## Batch 3 — Frontend: ProviderQuotaComponent

**Status:** PENDING

**Summary:** Implement the `ProviderQuotaComponent` — card layout, usage bar, "Not configured" state, 5-min auto-refresh.

**Files:**
- `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.ts` — create
- `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.html` — create
- `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.scss` — create

**Subtasks:**
1. Create component class:
   - Standalone, `ChangeDetectionStrategy.OnPush`
   - `signal<ProviderQuotaItem[]>` for data, `signal<'loading' | 'loaded' | 'error'>` for state
   - `ngOnInit`: load quota data
   - `ngOnDestroy`: clear interval
   - `setInterval` for 5-min refresh
   - Computed `glmCard`, `anthropicCard`, `openaiCard` helpers derived from response
2. Create template:
   - 3-column card grid: GLM | Anthropic | OpenAI
   - Each card: provider badge, name, usage progress bar, `% remaining`, cost this period, reset date
   - `unavailable` card: greyed out, "Not configured" overlay, tooltip with env var name
   - Loading skeleton / spinner
   - Refresh button in panel header
3. Create component styles (match existing settings panel patterns from subscriptions.component.scss)

**Depends on:** Batch 2 (types must be in place)

---

## Execution Notes

- Batch 1 and Batch 2 (types portion) can proceed in parallel
- Batch 3 should start after Batch 2 types are in place
- Suggested single-dev order: Batch 1 → Batch 2 → Batch 3
