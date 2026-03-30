# Task: Settings — Default Mapping Configuration Tab

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

Part 4 of 4 — original request: Settings Page — Comprehensive Provider/Model/Launcher Configuration UX.

Implement the Mapping/Configuration tab — the final tab where users configure default selections and map models to launchers.

**What to build:**

1. **Global defaults section** — Dropdowns to set:
   - Default model (from all active models across API keys + subscriptions)
   - Default launcher (from all active launchers)
2. **Model-to-Launcher mapping matrix** — A visual grid or selection UI where the user assigns which launchers can use which models. Each row = a model, columns = launchers, cells = checkbox or toggle.
3. **Provider priority** — If the same model is available from multiple sources (API key vs subscription), allow the user to set priority order.
4. **Active-only filtering** — Only show active models, launchers, and subscriptions in the mapping UI. Inactive items are excluded.
5. **Save/reset** — Mock save action (logs to console), reset to defaults.

All mock data. The mapping reads from the same settings service that the previous tabs populate.

## Dependencies

- TASK_2026_148 — Settings Shell + Models + Mock Data
- TASK_2026_149 — API Keys tab (provides active models from API keys)
- TASK_2026_150 — Launchers & Subscriptions tabs (provides active launchers and subscription models)

## Acceptance Criteria

- [ ] Mapping tab shows a matrix/grid of active models vs active launchers
- [ ] User can toggle which model-launcher combinations are enabled
- [ ] Global default model and default launcher dropdowns work
- [ ] Only active entities appear in the mapping UI
- [ ] Mock save action confirms the configuration

## References

- Settings shell: TASK_2026_148
- All other settings tabs: TASK_2026_149, TASK_2026_150

## File Scope

- `apps/dashboard/src/app/views/settings/mapping/mapping.component.ts`
- `apps/dashboard/src/app/views/settings/settings.component.ts` (wire tab)
- `apps/dashboard/src/app/services/settings.service.ts` (add mapping methods)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_149 or TASK_2026_150 — depends on their output and modifies shared files. Run in Wave 4 (last).
