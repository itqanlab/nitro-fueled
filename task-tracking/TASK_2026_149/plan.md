# Plan — TASK_2026_149

## Approach

1. Extend the settings models/service with mock provider metadata, key detection, and API key CRUD helpers.
2. Move the API Keys tab into a focused child component to keep the settings shell small.
3. Build a lightweight form/list UI that supports add, edit, delete, and active toggling with provider model previews.
4. Verify the dashboard build compiles successfully.

## Architecture Decisions

- Keep provider detection and model lookup in `SettingsService` so the component stays presentational.
- Preserve mock-data behavior by masking keys before storing them in local state.
- Use Angular signals/computed state in the component instead of template method calls.
