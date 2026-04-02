# Research: SettingsService Data Flow — TASK_2026_305

## Summary

**SettingsService is 100% in-memory. No backend calls. No localStorage.**

All state lives in an Angular `signal<SettingsState>` that is initialized from hardcoded mock data (`MOCK_SETTINGS_STATE` in `settings.constants.ts`) at service instantiation. Every mutation updates the signal only — nothing is persisted anywhere. When the page refreshes, all changes are lost.

---

## Data Flow Per Tab

### Tab 1: API Keys
- **Source**: `MOCK_API_KEYS` (hardcoded) → cloned into signal on init
- **Read**: `settingsService.apiKeys` (computed signal)
- **Write**: `addApiKey()`, `updateApiKey()`, `deleteApiKey()`, `toggleActive('apiKey', id)`
- **Persistence**: None — signal only
- **Backend calls**: None
- **localStorage**: None

### Tab 2: Launchers
- **Source**: `MOCK_LAUNCHERS` (hardcoded) → cloned into signal on init
- **Read**: `settingsService.launchers` (computed signal)
- **Scan data**: `settingsService.launcherDetections` — returns `MOCK_LAUNCHER_DETECTIONS` (static constant, always the same)
- **Write**: `addLauncher()`, `toggleActive('launcher', id)`
- **Persistence**: None — signal only
- **Backend calls**: None (no actual filesystem/process scanning)
- **localStorage**: None

### Tab 3: Subscriptions
- **Source**: `MOCK_SUBSCRIPTIONS` (hardcoded) → cloned into signal on init
- **Read**: `settingsService.subscriptions` (computed signal)
- **Write**: `connectSubscription()`, `disconnectSubscription()`, `toggleActive('subscription', id)`
- **Connect behavior**: Sets `connectionStatus = 'connected'` and populates `availableModels` from `SUBSCRIPTION_PROVIDER_OPTIONS` constant — no real OAuth/verification
- **Persistence**: None — signal only
- **Backend calls**: None
- **localStorage**: None

### Tab 4: Mapping
- **Source**: `MOCK_MODEL_MAPPINGS` (hardcoded) → cloned into signal on init
- **Read**: `settingsService.mappingMatrix` (computed — derives from active API keys + active launchers cross product)
- **Write**: `toggleMapping()`, `setDefaultMapping()`, `setDefaultModel()`, `setDefaultLauncher()`, `resetMappings()`
- **Save action**: `saveMappings()` — **only does `console.log()`**, no actual persistence
- **Persistence**: None — signal only
- **Backend calls**: None
- **localStorage**: None

---

## Key Finding: `saveMappings()` Is a Stub

```ts
public saveMappings(): void {
  console.log('[SettingsService] Mapping configuration saved:', {
    mappings: this.state().mappings,
    timestamp: new Date().toISOString(),
  });
}
```

This is a placeholder. The "Save" button in the Mapping tab does nothing except log to console.

---

## Follow-Up Tasks Required

All four tabs need backend wiring. Suggested tasks:

### 1. API Keys — Backend CRUD
- `GET /api/settings/api-keys` — load persisted keys on app init
- `POST /api/settings/api-keys` — addApiKey
- `PUT /api/settings/api-keys/:id` — updateApiKey
- `DELETE /api/settings/api-keys/:id` — deleteApiKey
- `PATCH /api/settings/api-keys/:id/active` — toggleActive
- Key values should never leave the client unencrypted; consider storing only masked versions server-side

### 2. Launchers — Backend Registration
- `GET /api/launchers` — load registered launchers (already exists in nitro-cortex)
- `POST /api/launchers` — register new launcher
- `GET /api/launchers/scan` — trigger actual filesystem scan (not mock)
- `PATCH /api/launchers/:id/active` — toggleActive
- Note: nitro-cortex already has `register_launcher`, `list_launchers`, `get_launcher` MCP tools — these should be wired through `ApiService`

### 3. Subscriptions — Authentication Flow
- `GET /api/subscriptions` — load known subscriptions
- `POST /api/subscriptions/:id/connect` — initiate OAuth / credential verification
- `POST /api/subscriptions/:id/disconnect`
- The "connect" flow currently just sets a local flag — needs real OAuth or token exchange

### 4. Mappings — Persist to Backend
- `GET /api/settings/mappings` — load saved mappings
- `POST /api/settings/mappings` — bulk-save (replace `saveMappings()` stub)
- `DELETE /api/settings/mappings` — reset (replace `resetMappings()` console-only behavior)

---

## Files Audited

| File | Verdict |
|------|---------|
| `apps/dashboard/src/app/services/settings.service.ts` | In-memory signal only, no external I/O |
| `apps/dashboard/src/app/services/settings.constants.ts` | All mock data hardcoded, no DB/API reads |
| `apps/dashboard/src/app/services/settings-state.utils.ts` | Pure state transforms, no side effects |
| `apps/dashboard/src/app/services/api.service.ts` | No settings CRUD endpoints exist |
| `apps/dashboard/src/app/views/settings/settings.component.ts` | Thin shell — delegates entirely to SettingsService |
