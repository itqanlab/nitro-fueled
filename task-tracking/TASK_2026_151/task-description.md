# Task Description — TASK_2026_151

## Summary

Implement the Mapping/Configuration tab for the Settings page — the final tab where users configure default selections and map models to launchers.

## Requirements

1. **Global defaults section** — Dropdowns to set default model (from all active models) and default launcher (from all active launchers)
2. **Model-to-Launcher mapping matrix** — Visual grid: rows = active models, columns = active launchers, cells = toggle checkboxes with star for default
3. **Active-only filtering** — Only show active models (from active API keys + active subscriptions) and active launchers
4. **Save/reset** — Mock save action (console log), reset to defaults with confirmation
5. **Component extraction** — Dedicated `MappingComponent` replacing the inline mapping tab content in `SettingsComponent`

## File Scope

- `apps/dashboard/src/app/views/settings/mapping/mapping.component.ts` (new)
- `apps/dashboard/src/app/views/settings/mapping/mapping.component.html` (new)
- `apps/dashboard/src/app/views/settings/mapping/mapping.component.scss` (new)
- `apps/dashboard/src/app/views/settings/settings.component.ts` (modified — wire MappingComponent)
- `apps/dashboard/src/app/views/settings/settings.component.html` (modified — replace inline mapping tab)
- `apps/dashboard/src/app/services/settings.service.ts` (modified — add mapping methods)
- `apps/dashboard/src/app/services/settings-state.utils.ts` (modified — add mapping state utils)
- `apps/dashboard/src/app/models/settings.model.ts` (modified — add mapping display types)

## Acceptance Criteria

- [ ] Mapping tab shows a matrix/grid of active models vs active launchers
- [ ] User can toggle which model-launcher combinations are enabled
- [ ] Global default model and default launcher dropdowns work
- [ ] Only active entities appear in the mapping UI
- [ ] Mock save action confirms the configuration
- [ ] Reset restores default mock mappings
