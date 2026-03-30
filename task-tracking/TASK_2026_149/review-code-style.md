# Code Style Review — TASK_2026_149

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | OpenCode |
| Task | TASK_2026_149 — Settings API Keys Management Tab |
| Files Reviewed | 7 scoped implementation files from `handoff.md` that are also listed in `task.md` |
| Verdict | FAIL |

---

## Findings

### SERIOUS

#### S1 — Component-local model and tab constants break the repo's separation pattern

**File**: `apps/dashboard/src/app/views/settings/settings.component.ts:6-19`

`SettingsTab`, `TabDefinition`, and `SETTINGS_TABS` are all declared inside the component file. In this codebase, reusable types and configuration data are expected to live in model/constants files rather than in the component module itself. Keeping both the type and the tab registry in `settings.component.ts` makes the view file own concerns that are not presentation logic and sets up an awkward import path if the tab metadata is reused by sibling settings subcomponents later.

**Recommendation**: Move `SettingsTab` and `TabDefinition` into a settings model file and move `SETTINGS_TABS` into a constants file.

---

#### S2 — Template still performs a per-row method call via `Map.get(...)`

**File**: `apps/dashboard/src/app/views/settings/settings.component.html:83`

The mapping row renders `launcherNames().get(mapping.launcherId) || mapping.launcherId` inside the template. Even though `launcherNames` is a `computed()` signal, `.get(...)` is still a method call executed during template evaluation for every row. That conflicts with the repo's established preference to keep per-item lookup logic out of templates and expose already-shaped view data instead.

**Recommendation**: Precompute mapping display rows in the component or service so the template reads a plain property such as `mapping.launcherName`.

---

### MINOR

#### M1 — New source file introduces non-ASCII masking characters without strong need

**File**: `apps/dashboard/src/app/services/settings-provider.constants.ts:81`

`maskApiKey()` builds masked values with the Unicode bullet character (`•`). The repository guidance says to default to ASCII unless there is a clear reason otherwise. This is not a functional problem, but it is a style inconsistency in a new TypeScript source file.

**Recommendation**: Prefer an ASCII mask character sequence such as `*` unless the UI specifically requires the bullet glyph.

---

## Scoped File Notes

| File | Verdict | Notes |
|------|---------|-------|
| `apps/dashboard/src/app/models/settings.model.ts` | PASS | Clean model definitions and consistent readonly usage. |
| `apps/dashboard/src/app/services/settings.service.ts` | PASS | Reactive state shape is consistent; no clear style-only defect beyond some API duplication. |
| `apps/dashboard/src/app/services/settings-provider.constants.ts` | PASS WITH NOTES | Minor ASCII-style issue in `maskApiKey()`. |
| `apps/dashboard/src/app/views/settings/settings.component.ts` | FAIL | Component owns local types/constants that should live outside the view file. |
| `apps/dashboard/src/app/views/settings/settings.component.html` | FAIL | Per-row `Map.get(...)` call left in template. |
| `apps/dashboard/src/app/views/settings/api-keys/api-keys.component.ts` | PASS | Signal/computed usage is consistent and readable. |
| `apps/dashboard/src/app/views/settings/api-keys/api-keys.component.html` | PASS | Block syntax and tracking expressions are clean. |
| `apps/dashboard/src/app/views/settings/api-keys/api-keys.component.scss` | PASS | Styling uses theme variables consistently. |

---

## Final Verdict

| Verdict | FAIL |

The task is close, but the remaining component-file ownership issue and the per-row template lookup mean it does not fully meet the repo's current code style conventions.
