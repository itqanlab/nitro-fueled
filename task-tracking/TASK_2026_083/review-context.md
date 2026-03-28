# Review Context — TASK_2026_083

## Task Scope
- Task ID: 2026_083
- Task type: FEATURE
- Files in scope:
  - apps/dashboard/src/app/models/new-task.model.ts (created)
  - apps/dashboard/src/app/views/new-task/new-task.component.ts (created)
  - apps/dashboard/src/app/views/new-task/new-task.component.html (created)
  - apps/dashboard/src/app/views/new-task/new-task.component.scss (created)
  - apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts (created)
  - apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.html (created)
  - apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.scss (created)
  - apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.ts (created)
  - apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.html (created)
  - apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.scss (created)
  - apps/dashboard/src/app/services/mock-data.service.ts (modified — added getProviderGroups)
  - apps/dashboard/src/app/app.routes.ts (modified — wired NewTaskComponent route)

## Git Diff Summary

Implementation commit: `4edce48 feat(dashboard): implement New Task view with strategy selector, workflow preview, and model overrides`

### Files changed and what changed:

**apps/dashboard/src/app/app.routes.ts** (modified)
- Added imports for ModelAssignmentsComponent, NewTaskComponent, OnboardingComponent
- Replaced placeholder routes (`PlaceholderViewComponent`) with actual component routes for `/models`, `/new-task`, `/onboarding`
- Note: OnboardingComponent import is present — it was not in the File Scope of this task but was included in the same commit

**apps/dashboard/src/app/models/new-task.model.ts** (created, 37 lines)
- Exports: `StrategyType` (string literal union of 8 values), `StrategyCard`, `WorkflowStepKind` (`'checkpoint' | 'agent'`), `WorkflowStep`, `AgentRoleOverride`, `ProviderGroup`
- All interfaces use `readonly` members

**apps/dashboard/src/app/services/mock-data.service.ts** (modified)
- Added `getModelAssignmentsData()` — returns MOCK_MODEL_ASSIGNMENTS_DATA (from TASK_2026_082 scope)
- Added `getProviderGroups()` — returns hardcoded array of 2 providers (Anthropic, OpenAI with model names)

**apps/dashboard/src/app/views/new-task/new-task.component.ts** (created, 104 lines)
- Module-level constants: `STRATEGY_CARDS` (8 entries), `WORKFLOW_STEPS` (9 entries), `AGENT_ROLES` (5 entries)
- Class members all have explicit access modifiers
- Uses `inject(MockDataService)` for provider groups
- `autoDetectLabel` getter: always returns `'FEATURE — based on keywords'` regardless of actual description content (hardcoded strategy)
- `costEstimate` getter: always returns `'$2.50 – $5.00'` (hardcoded)
- Uses `as HTMLInputElement` / `as HTMLTextAreaElement` / `as HTMLSelectElement` type assertions on DOM events
- `modelOverrides: Record<string, string>` — not readonly, mutated directly

**apps/dashboard/src/app/views/new-task/new-task.component.html** (created, 143 lines)
- Full form: breadcrumb, title input, description textarea, attachment drop zone, strategy selector, workflow preview, advanced options section
- Attachment zone is a static `<div>` with no click handler or file input
- Uses `@if`, `@for` Angular 17+ control flow syntax
- Breadcrumb `<a href="#">` is a bare fragment link (not a routerLink)
- `[value]` binding used for input/textarea instead of `[(ngModel)]` or reactive forms
- `UpperCasePipe` used for cost estimate label in template

**apps/dashboard/src/app/views/new-task/new-task.component.scss** (created, 385 lines)
- Defines component-scoped styles: page layout, form sections, inputs, attachment zone, toggle switch, model override table, badge colors, select, buttons
- Defines `.btn`, `.badge` and their variants inline — these are potentially reusable styles not extracted to a shared file

**apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts** (created, 20 lines)
- Uses Angular signals API (`input.required`, `output`)
- Clean, minimal, well-structured

**apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.html** (created, 20 lines)
- Renders auto-detect banner and 4×2 strategy grid
- Strategy cards are `<button type="button">` with `[class.selected]` binding

**apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.scss** (created, 63 lines)
- Styles for auto-detect banner and strategy grid/cards

**apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.ts** (created, 14 lines)
- Uses Angular signals API (`input.required`, `input`)
- Default hint text set inline in input declaration

**apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.html** (created, 14 lines)
- Renders workflow strip with step nodes and arrows, optional hint paragraph

**apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.scss** (created, 43 lines)
- Compact styles for the workflow strip

## Project Conventions

From CLAUDE.md:
- Angular project in `apps/dashboard/src/`
- Production-grade Angular: lazy-loaded feature module, smart/dumb component split, Angular 19 best practices, NG-ZORRO components used correctly
- **UI is a client, not the core** — presentation layer only; task creation logic lives in the API
- **Dynamic providers** — model selects render whatever providers the user has configured; do not hardcode provider names — read from API

From review-general.md relevant to Angular/TypeScript:
- **Explicit access modifiers** on ALL class members (`public`, `private`, `protected`)
- **No `any` type** — use `unknown` + type guards or proper generics
- **No `as` type assertions** — if the type system fights you, the type is wrong
- **String literal unions** for status/type/category fields
- **Component file size limit: 150 lines** (TS components and templates each)
- **Services: max 200 lines**
- **Missing imports in entry files are compilation blockers**
- **Status and type constants must be derived from canonical union, not hardcoded**
- **One interface/type per file** — don't define models inside component files

## Style Decisions from Review Lessons

From review-general.md:
1. **File Size Limits** — Components max 150 lines. new-task.component.html is 143 lines (close to limit).
2. **No `as` type assertions** — `as HTMLInputElement`, `as HTMLTextAreaElement`, `as HTMLSelectElement` used in event handlers (T03, T05, T07)
3. **TypeScript explicit access modifiers** — All class members must have public/private/protected. ✓ Present in this impl.
4. **No `any` type** — not used here ✓
5. **Sub-components defined in the same file vs own files** — Sub-components correctly split into their own files ✓
6. **Status/type constants derived from canonical union** — `STRATEGY_CARDS` and `WORKFLOW_STEPS` are module-level constants, not derived from a backend enum. Acceptable for UI-only display constants.
7. **Frontend Interaction**: `[value]` one-way binding with manual `(input)` handler — functional but not Angular best practice (should use reactive forms or `[(ngModel)]`).

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard/src/app/models/new-task.model.ts
- apps/dashboard/src/app/views/new-task/new-task.component.ts
- apps/dashboard/src/app/views/new-task/new-task.component.html
- apps/dashboard/src/app/views/new-task/new-task.component.scss
- apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts
- apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.html
- apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.scss
- apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.ts
- apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.html
- apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.scss
- apps/dashboard/src/app/services/mock-data.service.ts
- apps/dashboard/src/app/app.routes.ts

Issues found outside this scope: document only, do NOT fix.

---

## Findings Summary

### Style Review (nitro-code-style-reviewer) — 2026-03-28

| ID | Severity | Issue |
|----|----------|-------|
| H1 | HIGH | `as` type assertions in 3 event handlers (`new-task.component.ts:78,82,98`) |
| H2 | HIGH | Bare `href="#"` instead of `routerLink` (`new-task.component.html:6`) |
| H3 | HIGH | Eager route imports — must use `loadComponent` lazy loading (`app.routes.ts:8-10`) |
| H4 | HIGH | Inline mock data in `getProviderGroups()` — must extract to `MOCK_*` constant (`mock-data.service.ts:111-116`) |
| M1 | MEDIUM | `[value]`+`(input)` pattern instead of reactive forms or `ngModel` |
| M2 | MEDIUM | `autoDetectLabel` getter hardcodes `'FEATURE'` regardless of selected strategy |
| M3 | MEDIUM | `.btn` and `.badge` utility classes defined locally — should be in shared stylesheet |
| L1 | LOW | Raw `#fff` hex instead of CSS variable token (3 instances in SCSS) |
| L2 | LOW | `cursor: pointer` on non-interactive attachment `<div>` |

**What passed:** Access modifiers, no `any` types, `readonly` usage, signals API, `OnPush`, sub-component split, `@if/@for` control flow, `track` expressions, model in dedicated file, all file size limits.

---

### Logic Review (nitro-code-logic-reviewer) — 2026-03-28 — **FAIL**

| ID | Severity | Issue |
|----|----------|-------|
| L01 | CRITICAL | Form action buttons (Cancel, Save as Draft, Start Task) have no click handlers — form cannot submit |
| L02 | CRITICAL | Attachment zone is a non-functional stub — no file input, no drag handlers |
| L03 | CRITICAL | Provider groups hardcoded (violates architectural constraint: "read from API") |
| L04 | MAJOR | `autoDetectLabel` always returns `'FEATURE'` — no keyword analysis logic |
| L05 | MAJOR | `costEstimate` returns hardcoded `'$2.50 – $5.00'` regardless of strategy/model selection |
| L06 | MINOR | Breadcrumb uses `href="#"` instead of `routerLink` |
| L07 | MINOR | Default `<option>` has no `[value]=""` attribute — can't distinguish "default" from selection |
| L08 | MINOR | Model override reset to "default" stores label text, not a null/empty sentinel |

**Verdict:** FAIL — Critical issues (non-functional form submission, stub attachment zone, hardcoded providers) must be fixed before COMPLETE.

---

### Security Review (nitro-code-security-reviewer) — 2026-03-28 — **NO BLOCKERS**

| ID | Severity | Issue |
|----|----------|-------|
| SEC-01 | MEDIUM | No route guards on any routes — needed before real API wiring |
| SEC-02 | LOW | Unsafe `as` DOM type assertions — should use `instanceof` narrowing |
| SEC-03 | LOW | Hardcoded provider names — data integrity risk when wired to real task creation |
| SEC-04 | INFO | `href="#"` — not a security issue |
| SEC-05 | INFO | `modelOverrides` Record keys bounded by constants — no injection risk |
| SEC-06 | INFO | Attachment zone not yet functional — backend validation needed when implemented |

**Verdict:** No security blockers. All XSS vectors properly handled by Angular template compiler. Route guards needed before production API integration.

---

### Cross-Review Summary

| Review | Verdict | Critical | Major/High | Medium | Minor/Low |
|--------|---------|----------|------------|--------|-----------|
| Code Style | Issues found | 4 HIGH | — | 3 | 2 |
| Code Logic | **FAIL** | 3 | 2 | — | 3 |
| Security | NO BLOCKERS | — | — | 1 | 2 |

**Key blockers for COMPLETE:**
1. Form buttons need click handlers (Cancel, Save as Draft, Start Task)
2. Attachment zone needs actual file input + drag/drop handlers
3. Provider groups must be extracted to `MOCK_PROVIDER_GROUPS` constant (style) and eventually read from API (architecture)
4. Route lazy loading (`loadComponent`) required by architectural constraint
5. `as` type assertions should use `instanceof` narrowing
