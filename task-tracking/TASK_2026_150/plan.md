# Plan — TASK_2026_150

## Approach

1. Extend the settings data model and service with mock launcher detection data plus launcher/subscription mutation helpers.
2. Move the Launchers tab and Subscriptions tab into focused child components so the settings shell stays small.
3. Build lightweight card-based UIs for manual launcher add, connect/disconnect, and active toggles.
4. Verify the dashboard build compiles successfully.

## Architecture Decisions

- Keep mock launcher scan results and subscription catalogs in settings constants so components stay presentation-focused.
- Reuse `SettingsService.toggleActive()` for all on/off toggles rather than adding per-component state.
- Use Angular signals and computed state in the new tab components instead of template method calls.
