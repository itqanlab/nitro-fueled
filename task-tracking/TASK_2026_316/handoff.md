# Handoff — TASK_2026_316

## Files Changed
- apps/dashboard/src/app/services/api.service.ts (modified, +74 lines)
- apps/dashboard/src/app/services/settings.service.ts (modified, rewritten ~260 lines)

## Commits
- (see implementation commit)

## Decisions
- `ApiService` gains 14 new methods covering all settings endpoints (api-keys, launchers, subscriptions, mapping)
- `SettingsService` now starts with empty state and loads all 4 collections from API in constructor
- Mutations call API first, update signal on success response (no optimistic updates — avoids stale state)
- `deleteApiKey` return type changed from `boolean` to `void` (return value was never used by callers)
- `toggleActive('subscription', id)` maps to connect/disconnect based on current `isActive` state
- `saveMappings()` now calls PUT /api/settings/mapping; `resetMappings()` calls PUT with `[]`
- Mapping toggle/default operations remain local-only (client-side calculation) until `saveMappings()` is called — this preserves the existing UX pattern where the user explicitly saves
- Removed dependency on `cloneSettingsState()` (mock data loader); removed unused mock-dependent state utils imports

## Known Risks
- Subscriptions require pre-seeded entries in backend storage for connect/disconnect to work; no create endpoint exists in backend
- Empty initial state is visible briefly on page load before API responses arrive (no loading state shown in UI)
