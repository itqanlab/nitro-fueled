# Plan — TASK_2026_151

## Architecture

### Component Structure

- `MappingComponent` — Standalone Angular component in `settings/mapping/`
  - Renders the mapping matrix, global defaults dropdowns, save/reset actions
  - Uses `SettingsService` for all data and mutations

### Service Layer Additions

Add to `SettingsService`:
- `activeModels` computed — Aggregates models from active API keys + active subscriptions (deduplicated)
- `activeLaunchers` computed — Filters active launchers
- `mappingMatrix` computed — Cross-product of active models × active launchers with enabled/default state
- `defaultModel` / `defaultLauncher` computed — Current global defaults
- `toggleMapping()` — Enable/disable a model-launcher pair
- `setDefaultMapping()` — Set a model-launcher pair as the global default
- `setDefaultModel()` / `setDefaultLauncher()` — Update default selections via dropdown
- `saveMappings()` — Mock save (console log)
- `resetMappings()` — Reset to mock defaults

### State Utils Additions

Add to `settings-state.utils.ts`:
- `toggleMappingInState()` — Add/remove mapping entry
- `updateDefaultsInState()` — Set isDefault on target, clear from others
- `resetMappingsInState()` — Restore from MOCK_SETTINGS_STATE

### Model Additions

Add to `settings.model.ts`:
- `MappingModelEntry` — Model with source info (api-key/subscription)
- `MappingLauncherEntry` — Launcher with name
- `MappingMatrixCell` — Cell state (modelId, launcherId, enabled, isDefault)

## Implementation Steps

1. Add model types to `settings.model.ts`
2. Add state utility functions to `settings-state.utils.ts`
3. Add service methods and computeds to `settings.service.ts`
4. Create `MappingComponent` (ts, html, scss)
5. Wire `MappingComponent` into `SettingsComponent`
6. Verify TypeScript compilation
