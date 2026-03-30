# Task: Settings — API Keys Management Tab

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

Part 2 of 4 — original request: Settings Page — Comprehensive Provider/Model/Launcher Configuration UX.

Implement the API Keys management tab within the settings page. This is the primary way users add their AI provider credentials.

**What to build:**

1. **API Key list view** — Table/card list showing all configured API keys with: masked key, detected provider icon/name, status badge (valid/invalid/untested), active/inactive toggle.
2. **Add API Key flow** — Input field for pasting a key. On input, auto-detect the provider from key format:
   - `sk-ant-*` → Anthropic
   - `sk-*` → OpenAI
   - `AIza*` → Google
   - Custom patterns for Mistral, Groq, etc.
   - Unknown format → prompt user to select provider manually
3. **Provider model loading** — Once provider is detected, dynamically show available models for that provider (from mock data).
4. **Edit/Delete** — Edit key name/label, delete with confirmation.
5. **Active/Inactive toggle** — Toggle switch per key. Inactive keys are grayed out, still visible.
6. **Status indicators** — Color-coded badges: green (valid), red (invalid), gray (untested).

All data from mock constants. No real key validation.

## Dependencies

- TASK_2026_148 — Settings Shell + Models + Mock Data (provides route, models, service, mock data)

## Acceptance Criteria

- [ ] API Keys tab displays a list of configured keys with masked values
- [ ] Adding a new key auto-detects the provider from key format
- [ ] Detected provider shows available models dynamically
- [ ] Each key has an active/inactive toggle
- [ ] Status badges show valid/invalid/untested states
- [ ] Edit and delete actions work on existing keys

## References

- Settings shell: TASK_2026_148
- Models: `apps/dashboard/src/app/models/settings.model.ts` (from TASK_2026_148)
- Service: `apps/dashboard/src/app/services/settings.service.ts` (from TASK_2026_148)

## File Scope

- `apps/dashboard/src/app/views/settings/api-keys/api-keys.component.ts`
- `apps/dashboard/src/app/views/settings/settings.component.ts` (wire tab)
- `apps/dashboard/src/app/services/settings.service.ts` (add API key methods)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_150 or TASK_2026_151 — all modify `settings.component.ts` and `settings.service.ts`. Run in Wave 2 after TASK_2026_148. Can run in parallel with TASK_2026_150 if file writes are carefully scoped to separate sections, but safest sequentially.
