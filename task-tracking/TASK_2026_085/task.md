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

Implement the Provider Hub view at route `/providers` matching the N.Gine mockup. Page header "Provider Hub" with subtitle "Manage AI subscriptions, models, and API keys". Cost summary card: "Cost This Month" title, total $59.40, stacked horizontal bars (Anthropic 79% / OpenAI 20% with labels and amounts), budget progress bar ($59.40/$100.00 amber at 59%). Provider cards list — each card has a header row (provider icon, name, type badge API/CLI/OAuth in distinct colors, monthly cost amount, connection status dot + label, expand/collapse chevron). Expanded Anthropic API card: masked API key field (sk-ant-api03-xxxxxxxx) with Eye icon and Edit icon; optional Base URL field; test result text block ("Connection verified — 3 models available"); models table (Claude Opus 4, Claude Sonnet 4, Claude Haiku 4 rows — each with capability tags, context size, input/output pricing, enabled toggle). Expanded Claude CLI card: CLI path field with Browse button, detected version ("Claude CLI v2.0.3"), info box "No API key needed", models list with "Included" pricing label. OpenAI (collapsed, connected), GitHub Copilot (collapsed, OAuth, "Token expires in 28 days", Re-authorize), Google Gemini (collapsed, "Key expired" red status). Add Provider card: + icon, "Add Provider" label, 3 type buttons (API/CLI/OAuth). Bottom status panel: providers count, connected count, expired count, budget display.

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
