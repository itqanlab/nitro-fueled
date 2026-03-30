# Task Description — TASK_2026_149

## Scope

Implement the Settings page API Keys tab using mock state only.

## Requirements

- Render existing API keys with masked values, provider identity, status, and active state.
- Support adding a key with provider auto-detection from known mock formats.
- Show provider-specific model lists once a provider is detected or manually selected.
- Support editing labels/provider assignment and deleting existing keys with confirmation.
- Keep inactive keys visible while visually de-emphasized.

## Notes

- No live provider validation or network calls.
- Keep changes isolated to the settings feature surface introduced in TASK_2026_148.
