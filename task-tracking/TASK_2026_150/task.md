# Task: Settings — Launchers & Subscriptions Tabs

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

Part 3 of 4 — original request: Settings Page — Comprehensive Provider/Model/Launcher Configuration UX.

Implement the Launchers tab and the Subscriptions/OAuth tab within the settings page.

**Launchers tab:**

1. **Launcher list** — Card list showing detected and manually-added launchers: name, type icon, path, status badge (detected/manual/missing), active/inactive toggle.
2. **Auto-detect display** — Show which launchers were auto-detected (mock: Claude Code CLI, VS Code, Cursor detected; Windsurf not found).
3. **Manual add** — Form to manually add a launcher (name, type, path).
4. **Active/Inactive toggle** — Per launcher, grayed when inactive.

**Subscriptions/OAuth tab:**

1. **Subscription list** — Card list showing connected services: provider name/icon, connection status badge (connected/disconnected/expired), active/inactive toggle, available models.
2. **Connect button** — Mock OAuth flow: clicking "Connect" changes status to "connected" and populates available models (all mock, no real OAuth).
3. **Disconnect** — Resets status to disconnected, clears models.
4. **Supported services** — ChatGPT Plus, Claude Pro, Antigravity, GitHub Copilot (mock data).

## Dependencies

- TASK_2026_148 — Settings Shell + Models + Mock Data
- TASK_2026_149 — API Keys tab (to avoid file conflicts on settings.component.ts)

## Acceptance Criteria

- [ ] Launchers tab shows detected launchers with status badges
- [ ] Manual launcher add form works
- [ ] Each launcher has an active/inactive toggle
- [ ] Subscriptions tab shows connected services with status badges
- [ ] Mock "Connect" button toggles subscription to connected state and shows models
- [ ] Each subscription has an active/inactive toggle

## References

- Settings shell: TASK_2026_148
- API Keys tab pattern: TASK_2026_149

## File Scope

- `apps/dashboard/src/app/views/settings/launchers/launchers.component.ts`
- `apps/dashboard/src/app/views/settings/subscriptions/subscriptions.component.ts`
- `apps/dashboard/src/app/views/settings/settings.component.ts` (wire tabs)
- `apps/dashboard/src/app/services/settings.service.ts` (add launcher/subscription methods)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_149 — both modify `settings.component.ts` and `settings.service.ts`. Run in Wave 3 after TASK_2026_149.
