# Review Context — TASK_2026_085

## Task Scope
- Task ID: 2026_085
- Task type: FEATURE
- Files in scope: [these are the ONLY files reviewers may touch]
  - apps/dashboard/src/app/models/provider-hub.model.ts (created)
  - apps/dashboard/src/app/services/provider-hub.constants.ts (created)
  - apps/dashboard/src/app/services/mock-data.service.ts (modified)
  - apps/dashboard/src/app/views/providers/provider-hub.component.ts (created)
  - apps/dashboard/src/app/views/providers/provider-hub.component.html (created)
  - apps/dashboard/src/app/views/providers/provider-hub.component.scss (created)
  - apps/dashboard/src/app/views/providers/provider-card/provider-card.component.ts (created)
  - apps/dashboard/src/app/views/providers/provider-card/provider-card.component.html (created)
  - apps/dashboard/src/app/views/providers/provider-card/provider-card.component.scss (created)
  - apps/dashboard/src/app/views/providers/model-table/model-table.component.ts (created)
  - apps/dashboard/src/app/views/providers/model-table/model-table.component.html (created)
  - apps/dashboard/src/app/views/providers/model-table/model-table.component.scss (created)
  - apps/dashboard/src/app/app.routes.ts (modified)

## Git Diff Summary

Implementation commit: `7ad397d feat(dashboard): implement Provider Hub view (TASK_2026_085)`

### Files Changed

**apps/dashboard/src/app/app.routes.ts** — Added import of `ProviderHubComponent`; replaced placeholder `/providers` route with `ProviderHubComponent`.

**apps/dashboard/src/app/models/provider-hub.model.ts** (60 lines, new) — Defines TypeScript interfaces and union types for the Provider Hub domain:
- `ApiType` = `'api' | 'cli' | 'oauth'`
- `ConnectionStatus` = `'connected' | 'disconnected' | 'not-configured'`
- `ModelCapability` = `'high' | 'medium' | 'fast'`
- `ProviderModel` — individual model row
- `ProviderConfig` — full provider card data (auth type, models, cost, status)
- `CostBarEntry`, `ProviderCostSummary`, `ProviderHubData` — cost summary and hub wrapper

**apps/dashboard/src/app/services/provider-hub.constants.ts** (211 lines, new) — `MOCK_PROVIDER_HUB_DATA` constant with 5 providers: Anthropic (API), OpenAI (API), Claude CLI (CLI), GitHub Copilot (OAuth), Google Gemini (API, disconnected/expired). Includes cost bars and bottom panel counts.

**apps/dashboard/src/app/services/mock-data.service.ts** (4 lines added) — Added import + `getProviderHubData()` method returning the constant.

**apps/dashboard/src/app/views/providers/provider-hub.component.ts** (39 lines, new) — Smart component; injects `MockDataService`; computes `budgetPercent` and `budgetBarWidth`; manages `expandedProviderId` state (default `'anthropic'`). Provides `isExpanded()`, `onToggleExpand()`, `onToggleModel()` handlers. `onToggleModel` is a no-op with mock data.

**apps/dashboard/src/app/views/providers/provider-hub.component.html** (77 lines, new) — Page header, cost summary card (stacked bars + budget progress bar), provider grid using `@for` loop, `<app-provider-card>` per provider, static "Add Provider" card with 3 type buttons. NOTE: The `bottomPanel` from `ProviderHubData` is NOT rendered here despite being in the data model and acceptance criteria.

**apps/dashboard/src/app/views/providers/provider-hub.component.scss** (204 lines, new) — Styles for page header, cost summary, cost bars, budget bar, provider grid, add provider card.

**apps/dashboard/src/app/views/providers/provider-card/provider-card.component.ts** (27 lines, new) — Dumb component; `provider` + `expanded` inputs; `toggleExpand` + `toggleModel` outputs. `ChangeDetectionStrategy.OnPush`.

**apps/dashboard/src/app/views/providers/provider-card/provider-card.component.html** (153 lines, new) — Renders provider card header (icon, name, type badge, cost, status dot, expand arrow). Expanded body: API-key auth section (masked input + Eye/Edit buttons), CLI auth section (path + version info), OAuth section, test result block, no-key message, `<app-model-table>`, action buttons.

**apps/dashboard/src/app/views/providers/provider-card/provider-card.component.scss** (357 lines, new) — Full card styling including provider icons (hardcoded colors per provider), type badges, status dots, form rows, buttons, test result blocks, OAuth info block.

**apps/dashboard/src/app/views/providers/model-table/model-table.component.ts** (21 lines, new) — Dumb component; `models` + `cliMode` inputs; `toggleModel` output. `ChangeDetectionStrategy.OnPush`.

**apps/dashboard/src/app/views/providers/model-table/model-table.component.html** (55 lines, new) — Grid-based model table with header row and `@for` rows. Each row: model name + sub-ID, capability badge with `ngClass`, context, price (input/output or single), toggle button.

**apps/dashboard/src/app/views/providers/model-table/model-table.component.scss** (105 lines, new) — Grid layout (1fr 120px 100px 100px 60px), capability badge colors, toggle button styles.

## Project Conventions

From CLAUDE.md:
- **Angular 19 best practices** — lazy-loaded feature module, smart/dumb component split, NG-ZORRO components used correctly.
- **UI is a client, not the core** — presentation layer only; provider configuration lives in the API.
- **Dynamic providers** — render from API data; do not hardcode provider names.
- **Git**: conventional commits with scopes.
- **Task states**: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED
- **Agent naming**: `nitro-` prefix.
- **TypeScript** — `tsconfig.json` strict mode implied.

## Style Decisions from Review Lessons

Relevant rules from `.claude/review-lessons/review-general.md`:

### File Size Limits (MOST VIOLATED)
- Components: max 150 lines. Inline templates: max 50 lines.
- Services/repositories: max 200 lines.
- **Violations to check**: `provider-card.component.html` = 153 lines (over limit), `provider-card.component.scss` = 357 lines (well over), `provider-hub.component.scss` = 204 lines (over), `provider-hub.component.html` = 77 lines (OK), `provider-hub.constants.ts` = 211 lines (over service limit).

### TypeScript Conventions
- Explicit access modifiers on ALL class members — `public`, `private`, `protected`. Never bare.
- No `any` type ever.
- No `as` type assertions.
- String literal unions for status/type/category fields — never bare `string`.
- No unused imports or dead code.
- Falsy checks skip zero values — use `!== undefined` or `!= null`.

### Naming
- kebab-case for file names (all OK).
- SCREAMING_SNAKE_CASE for const domain objects — `MOCK_PROVIDER_HUB_DATA` ✓.
- camelCase for variables/functions/methods.
- PascalCase for classes/interfaces/types.

### File Structure
- One interface/type per file is a guideline, but multiple related types in a `*.model.ts` is acceptable.

### Frontend Interaction Correctness
- Exhaustive icon/label ternaries must use a switch with `assertNever` when the union may grow.
- String literal union members must not embed spaces in discriminant values (e.g., `'not-configured'` in `ConnectionStatus` ✓ — correctly hyphenated).
- Status reporters must not conflate "config says connected" with "is actually connected" — relevant here as this is mock data, not a real connection check.

### TypeScript Return Semantics
- Hard-coded defaults must be co-located with the type they initialize.

## Findings Summary

| Reviewer | Verdict | Score | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| Code Style | NEEDS FIXES | 6/10 | 0 | 4 | 4 | 2 |
| Code Logic | CHANGES_REQUESTED | 5/10 | 2 | 0 | 3 | 2 |
| Security | NO BLOCKERS | 9/10 | 0 | 0 | 0 | 2 |

### Critical (Logic)
- **Missing bottom panel** — `provider-hub.component.html` does not render `data.bottomPanel` (providers count, connected, expired, budget) despite the data model and AC requiring it.
- **Default expanded state violates AC** — `expandedProviderId = 'anthropic'` should be `null`; AC states "collapsed by default."

### High (Style — File Size Violations)
- `provider-card.component.html`: 153 lines (limit 150)
- `provider-card.component.scss`: 357 lines (limit 150)
- `provider-hub.component.scss`: 204 lines (limit 150)
- `provider-hub.constants.ts`: 211 lines (limit 200)

### Medium
- **Falsy check on `oauthExpiryDays`** (number|undefined) — use `!== undefined` (Style M1, Logic finding 6)
- **Falsy check on `outputPrice`** (string) — use `!== ''` (Style M2)
- **Hardcoded hex colors** — per-provider icon backgrounds + border values bypass design tokens (Style M3, M4)
- **`onToggleModel` no-op** — model toggles emit events but have no state effect (Logic finding 3)
- **Add Provider card** — no click handler despite `cursor: pointer` (Logic finding 4)
- **Action buttons** — Test/Refresh/Remove have no `(click)` bindings (Logic finding 5)

### Low
- **`.replace()` in template** — `model-table.component.html:24` should be a component method (Style L1)
- **Unused parameter** — `onToggleModel(event)` should be `_event` (Style L2)
- **`colorClass` unconstrained string** — should be a literal union before API integration (Security SEC-01)
- **No route guard on `/providers`** — consistent with other routes but more sensitive (Security SEC-02)
- **`maskedKey` API integration note** — backend must never send real key data (Security SEC-03 informational)
- **Division-by-zero in `budgetPercent`** — if `budget = 0`, produces `Infinity` in style binding (Security SEC-04 informational)

---

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard/src/app/models/provider-hub.model.ts
- apps/dashboard/src/app/services/provider-hub.constants.ts
- apps/dashboard/src/app/services/mock-data.service.ts
- apps/dashboard/src/app/views/providers/provider-hub.component.ts
- apps/dashboard/src/app/views/providers/provider-hub.component.html
- apps/dashboard/src/app/views/providers/provider-hub.component.scss
- apps/dashboard/src/app/views/providers/provider-card/provider-card.component.ts
- apps/dashboard/src/app/views/providers/provider-card/provider-card.component.html
- apps/dashboard/src/app/views/providers/provider-card/provider-card.component.scss
- apps/dashboard/src/app/views/providers/model-table/model-table.component.ts
- apps/dashboard/src/app/views/providers/model-table/model-table.component.html
- apps/dashboard/src/app/views/providers/model-table/model-table.component.scss
- apps/dashboard/src/app/app.routes.ts

Issues found outside this scope: document only, do NOT fix.
