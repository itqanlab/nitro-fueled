# Handoff — TASK_2026_299

## Files Changed
- apps/dashboard/src/app/views/providers/provider-hub.component.ts (modified — converted to signals, removed mock)
- apps/dashboard/src/app/views/providers/provider-hub.component.html (modified — added loading/error/null guards)

## Commits
- Implementation commit (see git log)

## Decisions
- Static provider metadata (models, icons, auth) kept as compile-time constant `PROVIDER_STATIC` — quota API only provides cost/status, not model catalog
- `buildProviderHubData()` pure function maps `ProviderQuotaItem[]` → `ProviderHubData`
- Budget kept at static $100 default — budget management is a future feature
- `MOCK_PROVIDER_HUB_DATA` and `provider-hub.constants.ts` import fully removed
- `ChangeDetectionStrategy.OnPush` maintained with Angular signals (toSignal + computed)
- `expandedProviderId` converted from plain property to `signal<string | null>`

## Known Risks
- `costThisPeriod` for most providers is 0 (APIs don't always expose monthly cost) — bars will show $0 until real billing data is available
- No changes made to `dashboard.controller.ts` or `api.service.ts` — existing `getProviderQuota()` endpoint was sufficient
