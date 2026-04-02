# Implementation Plan — TASK_2026_201
## Provider Quota Panel

---

## Architecture Overview

A standalone NestJS `ProvidersModule` is added to `dashboard-api`, registering a single `GET /api/providers/quota` controller route backed by a `ProvidersService` that fans out to external provider APIs. The module is registered in `AppModule`. On the frontend, a new standalone Angular `ProviderQuotaComponent` is created under `settings/provider-quota/` and wired as a new tab (`'quota'`) inside the existing `SettingsComponent`.

---

## Backend Design

### Module layout

```
apps/dashboard-api/src/providers/
  providers.module.ts      # NestJS module
  providers.controller.ts  # GET /api/providers/quota
  providers.service.ts     # fan-out + cache logic
```

### `providers.service.ts`

Responsible for:
1. Reading env vars (`ZAI_API_KEY`, `ANTHROPIC_ADMIN_KEY`, `OPENAI_ADMIN_KEY`)
2. Fanning out to up to 3 provider HTTP calls using `Promise.allSettled`
3. Returning a `ProviderQuotaItem[]` array — one item per provider (available OR unavailable)
4. Caching the last result for 5 minutes (simple in-process `Map<string, { data, expiresAt }>`)

**Response shape (per provider):**

```typescript
// Available provider
{
  provider: 'glm' | 'anthropic' | 'openai';
  plan?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  resetAt?: string;        // ISO date
  currency?: string;       // 'USD'
  costThisPeriod?: number; // decimal USD
  unavailable: false;
}

// Unavailable provider
{
  provider: 'glm' | 'anthropic' | 'openai';
  unavailable: true;
  reason: string;          // e.g. "ANTHROPIC_ADMIN_KEY not set"
}
```

**GLM / ZAI API call:**

Use the same endpoint as the `glm-plan-usage:usage-query` skill. Endpoint: `https://open.bigmodel.cn/api/paas/v4/user/usage` (GET, `Authorization: Bearer {ZAI_API_KEY}`).
Expected fields: `data.remaining_tokens`, `data.total_tokens`, `data.reset_at`.
Map to: `{ provider: 'glm', used: total - remaining, limit: total, remaining, resetAt }`.

**Anthropic API call:**

`GET https://api.anthropic.com/v1/organizations/usage` with header `x-api-key: {ANTHROPIC_ADMIN_KEY}` and `anthropic-version: 2023-06-01`.
Returns monthly aggregated token usage. Map `input_tokens + output_tokens` → `used`, estimate cost from token counts if cost field absent.
Fall back to `unavailable: true, reason: "ANTHROPIC_ADMIN_KEY not set"` if key absent.

**OpenAI API call:**

`GET https://api.openai.com/v1/organization/usage?start_time={startOfMonth}` with `Authorization: Bearer {OPENAI_ADMIN_KEY}`.
Aggregate completions cost. Fall back if key absent.

**Error handling:**
- Any provider fetch that throws returns an `unavailable` item (not a 500)
- The overall endpoint always returns 200 with an array

**Cache:**
```typescript
private readonly cache = new Map<string, { data: ProviderQuotaItem[]; expiresAt: number }>();
private readonly CACHE_TTL_MS = 5 * 60 * 1000;
```

### `providers.controller.ts`

```typescript
@Controller('api/providers')
export class ProvidersController {
  @Get('quota')
  async getQuota(): Promise<ProviderQuotaItem[]>
}
```

### Module registration

`AppModule` imports `ProvidersModule`.

---

## Frontend Design

### New types in `api.types.ts`

```typescript
export type ProviderId = 'glm' | 'anthropic' | 'openai';

export interface ProviderQuotaAvailable {
  readonly provider: ProviderId;
  readonly unavailable: false;
  readonly plan?: string;
  readonly used?: number;
  readonly limit?: number;
  readonly remaining?: number;
  readonly resetAt?: string;
  readonly currency?: string;
  readonly costThisPeriod?: number;
}

export interface ProviderQuotaUnavailable {
  readonly provider: ProviderId;
  readonly unavailable: true;
  readonly reason: string;
}

export type ProviderQuotaItem = ProviderQuotaAvailable | ProviderQuotaUnavailable;
```

### New method in `api.service.ts`

```typescript
public getProviderQuota(): Observable<ProviderQuotaItem[]> {
  return this.http.get<ProviderQuotaItem[]>(`${this.base}/providers/quota`);
}
```

### New component

```
apps/dashboard/src/app/views/settings/provider-quota/
  provider-quota.component.ts
  provider-quota.component.html
  provider-quota.component.scss
```

**Component logic:**
- Standalone Angular component, `ChangeDetectionStrategy.OnPush`
- Injects `ApiService`
- On `ngOnInit`: calls `getProviderQuota()`, stores result in a `signal<ProviderQuotaItem[]>`
- Auto-refresh: `setInterval(() => this.loadQuota(), 5 * 60 * 1000)` cleared on `ngOnDestroy`
- `loadingState` signal: `'loading' | 'loaded' | 'error'`
- Computed: `glmCard`, `anthropicCard`, `openaiCard` — each card derived from the response array

**Template design:**
- Three cards in a row grid: GLM first, Anthropic second, OpenAI third
- Each card shows:
  - Provider name + icon abbreviation badge
  - Usage progress bar (`used / limit`) with `%` remaining
  - Cost this period (if available)
  - Reset date (if available)
  - "Not configured" overlay if `unavailable: true`, with tooltip explaining env var
- Refresh button in panel header

### Settings integration

Add `'quota'` tab to `SETTINGS_TABS` (in `apps/dashboard/src/app/views/models/settings.model.ts` or wherever defined).
Import `ProviderQuotaComponent` into `SettingsComponent` and add `@case ('quota')` branch to the `@switch` in `settings.component.html`.

---

## Key Decisions

1. **Standalone NestJS module** — `ProvidersModule` added to `AppModule` (not folded into `DashboardModule`) to keep provider quota concerns isolated. Pattern mirrors `TasksModule`.

2. **`Promise.allSettled` for fan-out** — ensures one slow/failing provider never blocks others. Each settled result mapped to `ProviderQuotaItem`.

3. **In-process Map cache** — sufficient for a single-instance API. TTL = 5 min matches backend cache note in task spec. No Redis dependency needed.

4. **No new module files in dashboard** — Angular components are standalone; no module registration needed.

5. **Settings tab placement** — "Provider Quota" goes as a 5th tab in Settings (existing page) rather than a sidebar widget, keeping the pattern consistent with other settings panels and avoiding sidebar layout changes.

6. **SETTINGS_TABS location** — Read `settings.component.ts` imports from `../../models/settings.model`; update that file for the new tab.

---

## File List

| File | Action |
|------|--------|
| `apps/dashboard-api/src/providers/providers.module.ts` | create |
| `apps/dashboard-api/src/providers/providers.controller.ts` | create |
| `apps/dashboard-api/src/providers/providers.service.ts` | create |
| `apps/dashboard-api/src/app/app.module.ts` | modify — import ProvidersModule |
| `apps/dashboard/src/app/models/api.types.ts` | modify — add ProviderQuota types |
| `apps/dashboard/src/app/services/api.service.ts` | modify — add getProviderQuota() |
| `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.ts` | create |
| `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.html` | create |
| `apps/dashboard/src/app/views/settings/provider-quota/provider-quota.component.scss` | create |
| `apps/dashboard/src/app/views/models/settings.model.ts` (or wherever SETTINGS_TABS is defined) | modify — add quota tab |
| `apps/dashboard/src/app/views/settings/settings.component.ts` | modify — import + wire component |
| `apps/dashboard/src/app/views/settings/settings.component.html` | modify — add @case branch |

---

## Risk Flags

- **Anthropic /v1/organizations/usage** endpoint: The exact path may differ; verify against Anthropic docs before implementation. Fall-back pattern should make this resilient.
- **OpenAI usage endpoint pagination**: OpenAI's usage endpoint returns paginated buckets. The service should sum all buckets for the current billing period.
- **SETTINGS_TABS type** — confirm the exact file where `SETTINGS_TABS` / `SettingsTab` are defined before modifying.
