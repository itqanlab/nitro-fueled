# Review Context — TASK_2026_082

## Task Scope
- Task ID: 2026_082
- Task type: FEATURE
- Files in scope: (these are the ONLY files reviewers may touch)
  - apps/dashboard/src/app/models/model-assignment.model.ts (created)
  - apps/dashboard/src/app/services/model-assignment.constants.ts (created)
  - apps/dashboard/src/app/services/mock-data.service.ts (modified)
  - apps/dashboard/src/app/views/models/model-assignments.component.ts (created)
  - apps/dashboard/src/app/views/models/model-assignments.component.html (created)
  - apps/dashboard/src/app/views/models/model-assignments.component.scss (created)
  - apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts (created)
  - apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.html (created)
  - apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.scss (created)
  - apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.ts (created)
  - apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.html (created)
  - apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.scss (created)
  - apps/dashboard/src/app/app.routes.ts (modified)

## Git Diff Summary
Implementation commit: `3d27d36` — "feat(dashboard): implement Model Assignments view at /models route"

### Files Changed (12 files, 1378 insertions)

1. **model-assignment.model.ts** (70 lines, new)
   - Defines `ProviderType`, `OverrideLevel`, `RoleCategory`, `PresetBadgeType` string literal unions
   - Interfaces: `ModelOption`, `ModelOptgroup`, `AgentAssignment`, `SubAgentAssignment`, `QuickPreset`, `ScopeTab`, `HierarchyLevel`, `ModelAssignmentsData`
   - All fields are `readonly`

2. **model-assignment.constants.ts** (287 lines, new)
   - Defines provider optgroup constants (CLAUDE_CLI, API_ANTHROPIC, API_OPENAI, OAUTH_COPILOT)
   - `MOCK_SCOPE_TABS`, `MOCK_HIERARCHY_LEVELS`, `MOCK_ASSIGNMENTS` (11 agents), `MOCK_SUB_AGENTS` (3), `MOCK_PRESETS` (5)
   - Exports `MOCK_MODEL_ASSIGNMENTS_DATA: ModelAssignmentsData`
   - Note: task described 7 rows but implementation has 11 agent rows

3. **assignments-table.component.ts** (57 lines, new)
   - Standalone Angular component with `input()` / `output()` signals
   - Inputs: `assignments`, `subAgents`, `totalCost`, `budgetUsed`, `budgetTotal`
   - Outputs: `resetRole`, `resetAll`, `save`
   - Methods: `getProviderBadgeClass`, `getSubAgentIconClass`, `getSelectedLabel`, `toggleSubAgents`, computed getters `budgetPercent`, `budgetIsWarning`
   - `subAgentsExpanded` is a mutable class field (not signal) — missing access modifier? No, it has `public`

4. **assignments-table.component.html** (151 lines, new)
   - `@for` blocks for assignments and sub-agents (Angular 17+ control flow)
   - Native `<select>/<optgroup>` rather than NG-ZORRO (task description called for NG-ZORRO)
   - Uses `DecimalPipe` for cost display
   - Budget bar with `[style.width.%]` binding

5. **assignments-table.component.scss** (466 lines, new)
   - **EXCEEDS 150-line component limit (466 lines)**
   - Full table layout, provider badges, override badges, fallback chain, footer, sub-agent section

6. **model-assignments.component.ts** (39 lines, new)
   - Smart container component, injects `MockDataService`
   - Stub handler methods (onResetRole, onResetAll, onSave, onPresetSelected) — empty bodies, expected for mock

7. **model-assignments.component.html** (55 lines, new)
   - Scope tabs, hierarchy info bar, passes data to `<app-assignments-table>` and `<app-preset-cards>`
   - `activeScope` is a plain string property, not a signal

8. **model-assignments.component.scss** (129 lines, new)

9. **preset-cards.component.ts** (20 lines, new)
   - Simple component with `presets` input and `presetSelected` output

10. **preset-cards.component.html** (12 lines, new)
    - `@for` loop over presets with `[ngClass]` for badge type

11. **preset-cards.component.scss** (79 lines, new)

12. **task-tracking/TASK_2026_082/task.md** (updated — acceptance criteria additions, not in review scope)

Note: `mock-data.service.ts` and `app.routes.ts` listed in File Scope did not appear in commit `3d27d36`. They may be in a separate commit or in uncommitted working tree changes. Reviewers should check current file state.

## Project Conventions
From CLAUDE.md and review-general.md:

- **Angular 19 best practices** — lazy-loaded feature module, smart/dumb component split
- **Standalone components** — no NgModule
- **NG-ZORRO** — NZ component library for UI elements (task specifically called for NZ-select with optgroups)
- **Git**: conventional commits with scopes
- **TypeScript strict**: explicit access modifiers, no `any`, no `as` assertions, string literal unions
- **File size limits**: Components max 150 lines, services max 200 lines, SCSS not explicitly limited but should be split by responsibility
- **One interface/type per file** — model.ts files for types, constants files for data

## Style Decisions from Review Lessons

Relevant rules from review-general.md for Angular TypeScript:

1. **File size limits** (MOST VIOLATED): Components max 150 lines; services/stores max 200 lines. `assignments-table.component.scss` is 466 lines — **violation**.
2. **Explicit access modifiers on ALL class members** — check all class properties and methods.
3. **No `any` type** — use `unknown` + type guards or generics.
4. **No `as` type assertions** — use type guards.
5. **String literal unions for status/type/category fields** — ✓ already applied in model.ts.
6. **No unused imports or dead code** — check imports across all components.
7. **One interface/type per file** — model-assignment.model.ts has multiple interfaces (acceptable for tightly-related models from one domain).
8. **Missing imports in entry files are compilation blockers** — verify `app.routes.ts` imports `ModelAssignmentsComponent`.
9. **Enum/union types synchronized across all consumers** — `ProviderType` uses `'CLI' | 'API' | 'OAuth'` — check all usages match.
10. **Frontend interaction correctness** — verify `(click)` bindings, `@for` track expressions, and signal usage patterns.

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard/src/app/models/model-assignment.model.ts
- apps/dashboard/src/app/services/model-assignment.constants.ts
- apps/dashboard/src/app/services/mock-data.service.ts
- apps/dashboard/src/app/views/models/model-assignments.component.ts
- apps/dashboard/src/app/views/models/model-assignments.component.html
- apps/dashboard/src/app/views/models/model-assignments.component.scss
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.html
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.scss
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.ts
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.html
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.scss
- apps/dashboard/src/app/app.routes.ts

Issues found outside this scope: document only, do NOT fix.
