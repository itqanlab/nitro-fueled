# Task: Provider Hub view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the Provider Hub view at route `/providers` matching the N.Gine mockup. Page header "Provider Hub" with subtitle "Manage AI subscriptions, models, and API keys". Cost summary card: "Cost This Month" title, total cost, stacked horizontal bars per configured provider (with labels and amounts), budget progress bar. Provider cards list — dynamically rendered from configured providers. Each card has a header row (provider icon, name, apiType badge in distinct colors, monthly cost amount, connection status dot + label, expand/collapse chevron). Expanded card shows: auth config (masked API key with Eye/Edit for api-key auth, or OAuth status for oauth auth); optional Base URL field; test result text block ("Connection verified — N models available"); models table (rows per model — each with capability tags, context size, input/output pricing, enabled toggle). Add Provider card: + icon, "Add Provider" label — opens wizard to add any supported provider. Bottom status panel: providers count, connected count, expired count, budget display.

### Architectural Constraints

- **UI is a client, not the core** — this view is a presentation layer. Provider configuration, connection testing, and model discovery live in the API. The frontend renders provider cards and sends config changes to the API.
- **Dynamic providers** — render whatever providers the user has configured. Do not hardcode provider names — read from API. Support any number of providers.
- **Production-grade Angular** — lazy-loaded feature module, smart/dumb component split, Angular 19 best practices, NG-ZORRO components used correctly.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Cost summary card renders stacked cost bars with correct provider percentages and budget progress bar
- [ ] Provider cards render in collapsed state by default; clicking header toggles expand/collapse
- [ ] Expanded API card shows masked key field with Eye/Edit controls and test result text
- [ ] Expanded CLI card shows path field, detected version info box, and "Included" pricing models
- [ ] Models table in expanded cards has an enabled toggle per row
- [ ] Add Provider card renders with 3 type selection buttons

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/provider-config.html

## File Scope

- apps/dashboard/src/app/views/providers/provider-hub.component.ts
- apps/dashboard/src/app/views/providers/provider-hub.component.html
- apps/dashboard/src/app/views/providers/provider-hub.component.scss
- apps/dashboard/src/app/views/providers/provider-card/provider-card.component.ts
- apps/dashboard/src/app/views/providers/model-table/model-table.component.ts
