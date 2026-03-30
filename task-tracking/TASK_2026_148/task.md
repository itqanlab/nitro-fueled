# Task: Settings Shell + Models + Mock Data

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Part 1 of 4 — original request: Settings Page — Comprehensive Provider/Model/Launcher Configuration UX.

Create the Settings page foundation: route, layout shell with tab navigation, all TypeScript models, and mock data constants. This task builds the scaffolding that the subsequent tab-specific tasks (TASK_2026_149, 150, 151) will plug into.

**What to build:**

1. **Settings route** — Add `/settings` to `app.routes.ts`, lazy-loaded.
2. **Settings layout component** — Shell with tab navigation for 4 sections: API Keys, Launchers, Subscriptions, Mapping. Each tab renders a placeholder until subsequent tasks implement them.
3. **TypeScript models** — `settings.model.ts` with interfaces for:
   - `ApiKeyEntry` — id, key (masked), provider (auto-detected), status (valid/invalid/untested), isActive, detectedModels[]
   - `LauncherEntry` — id, name, type, path, status (detected/manual/missing), isActive
   - `SubscriptionEntry` — id, provider, connectionStatus (connected/disconnected/expired), isActive, availableModels[]
   - `ModelMapping` — id, modelId, launcherId, isDefault
   - `SettingsState` — aggregated state holding all arrays above
4. **Mock data constants** — `settings.constants.ts` with realistic mock data for all entity types (3-4 entries each). Include mock providers like Anthropic, OpenAI, Google, Mistral. Mock launchers like Claude Code, Cursor, Windsurf, VS Code.
5. **Settings service** — `settings.service.ts` that exposes the mock data with methods like `getApiKeys()`, `getLaunchers()`, `getSubscriptions()`, `getMappings()`, `toggleActive(type, id)`.

## Dependencies

- None

## Acceptance Criteria

- [ ] `/settings` route exists and loads the settings shell component
- [ ] Tab navigation renders 4 tabs (API Keys, Launchers, Subscriptions, Mapping)
- [ ] All TypeScript interfaces are defined in `settings.model.ts`
- [ ] Mock data constants cover all entity types with realistic sample data
- [ ] Settings service exposes mock data through typed methods
- [ ] Sidebar navigation includes a Settings link

## References

- Existing routes: `apps/dashboard/src/app/app.routes.ts`
- Sidebar: `apps/dashboard/src/app/layout/sidebar/`
- Existing models pattern: `apps/dashboard/src/app/models/`
- Existing mock data pattern: `apps/dashboard/src/app/services/mock-data.constants.ts`

## File Scope

- `apps/dashboard/src/app/app.routes.ts`
- `apps/dashboard/src/app/views/settings/settings.component.ts`
- `apps/dashboard/src/app/models/settings.model.ts`
- `apps/dashboard/src/app/services/settings.constants.ts`
- `apps/dashboard/src/app/services/settings.service.ts`
- `apps/dashboard/src/app/layout/sidebar/sidebar.component.ts`

## Parallelism

✅ Can run in parallel — no file scope overlap with other CREATED tasks except sidebar (minimal conflict).
