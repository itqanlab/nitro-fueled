# Review Context — TASK_2026_084

## Task Scope
- Task ID: 2026_084
- Task type: FEATURE
- Files in scope: (these are the ONLY files reviewers may touch)
  - apps/dashboard/src/app/models/onboarding.model.ts (created)
  - apps/dashboard/src/app/views/onboarding/onboarding.component.ts (created)
  - apps/dashboard/src/app/views/onboarding/onboarding.component.html (created)
  - apps/dashboard/src/app/views/onboarding/onboarding.component.scss (created)
  - apps/dashboard/src/app/views/onboarding/wizard/wizard-step.component.ts (created)
  - apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.ts (created)
  - apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.html (created)
  - apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.scss (created)
  - apps/dashboard/src/app/views/onboarding/folder-tree/folder-tree.component.ts (created)
  - apps/dashboard/src/app/app.routes.ts (listed in task scope but NOT changed in implementation commit — no review needed)
  - apps/dashboard/src/styles.scss (modified — added purple tokens)

## Git Diff Summary
Implementation commit: `93fae9d feat(dashboard): implement Project Onboarding view with wizard and chat panel`

Files changed (1306 insertions):

1. **onboarding.model.ts** (52 lines) — defines all shared interfaces: `OnboardingClient`, `ExternalReference`, `RecommendationStatus`, `AiRecommendation`, `FolderNode`, `ChatMessage`, `DataSummaryItem`, `WizardStep`, and `WIZARD_STEPS` constant array. All fields are `readonly`.

2. **onboarding.component.ts** (149 lines) — smart parent component using Angular signals (`signal`, `computed`). Contains hardcoded mock data for clients, externalRefs, dataSummary, recommendations, foldersBefore, foldersAfter, chatMessages. Implements step navigation (goNext/goBack), client change handler, and chat message handler.

3. **onboarding.component.html** (170 lines) — template using `@for`, `@if` control flow, `[ngClass]`, `[innerHTML]` bindings (2 uses: `msg.text` and `rec.description`), `DecimalPipe`, `UpperCasePipe`, `(keydown)` event binding in child component.

4. **onboarding.component.scss** (477 lines) — global layout, section cards, buttons, client select, folder picker, external references, data collection progress, AI analysis cards, folder organization grid, form actions, bottom panel. Extensive nested SCSS.

5. **wizard/wizard-step.component.ts** (104 lines) — dumb component with inline template and styles. Computes `StepView[]` using a computed signal. Renders steps with done/current/pending states.

6. **chat-panel/chat-panel.component.ts** (33 lines) — dumb component. Takes `messages` input and emits `messageSent`. Manages `inputValue` local state with `send()` and `onKeydown()`.

7. **chat-panel/chat-panel.component.html** (43 lines) — renders message thread and input area. Uses `[ngClass]="msg.sender"` and `[innerHTML]="msg.text"`.

8. **chat-panel/chat-panel.component.scss** (200 lines) — chat panel layout, header, message bubbles, avatar styles, input area. Uses CSS nesting with `&.ai` / `&.user` selectors.

9. **folder-tree/folder-tree.component.ts** (62 lines) — dumb component with inline template and styles. Renders folder nodes with indentation and color classes.

10. **styles.scss** (+5 lines) — added three CSS custom properties: `--purple`, `--purple-bg`, `--purple-border`.

**Note**: `app.routes.ts` was listed in the task's File Scope but was NOT changed in the implementation commit. The task.md also appears in the commit diff but is outside the review scope.

## Project Conventions
From CLAUDE.md and codebase patterns:
- **Angular 19** — lazy-loaded feature modules, smart/dumb component split, standalone components
- **ChangeDetectionStrategy.OnPush** — required on all components
- **Signals API** — use `signal()`, `computed()`, `input()`, `output()` instead of `@Input`/`@Output` decorators
- **Conventional commits** — `feat(scope):`, `fix(scope):`, `docs:` etc.
- **TypeScript strict mode** — no `any`, explicit access modifiers on all class members
- **Standalone components** — all components are `standalone: true`
- **SCSS** — BEM-like class naming, CSS custom properties (`var(--token)`)

## Style Decisions from Review Lessons
Relevant rules from review-general.md for this Angular TypeScript task:

**File Size Limits (MOST VIOLATED RULE)**
- Components: max 150 lines (template + styles each count separately)
- onboarding.component.scss is **477 lines** — EXCEEDS limit significantly
- onboarding.component.html is **170 lines** — EXCEEDS limit (max 150)
- onboarding.component.ts is **149 lines** — at the limit

**TypeScript Conventions**
- Explicit access modifiers on ALL class members (`public`, `private`, `protected`)
- No `any` type ever
- No `as` type assertions
- String literal unions for status/type fields — already done in model.ts
- No unused imports or dead code

**Security / [innerHTML] Usage**
- `[innerHTML]="msg.text"` in chat-panel.component.html — potential XSS if user input is rendered unsanitized
- `[innerHTML]="rec.description"` in onboarding.component.html — same concern (currently hardcoded HTML strings in component)

**Angular Best Practices**
- Missing `FormsModule` import in parent if `[(ngModel)]` is used in child (FormsModule is imported in ChatPanelComponent, which is correct)
- Hardcoded mock data in smart component — acceptable for a presentation layer per task constraints, but worth noting

**Naming**
- kebab-case for file names — ✓ all files follow convention
- PascalCase for interfaces — ✓ correct in model.ts
- SCREAMING_SNAKE_CASE for const domain objects — `WIZARD_STEPS` ✓

## Findings Summary

### Style Review — NEEDS FIXES
| ID | Severity | Finding |
|----|----------|---------|
| H1 | HIGH | `onboarding.component.scss` — 477 lines (max 150) — must extract step/button/input styles to child components |
| H2 | HIGH | `chat-panel.component.scss` — 200 lines (max 150) — extract `.chat-msg*` block |
| H3 | HIGH | `onboarding.component.html` — 170 lines (max 150) — extract Step 6 to `<app-folder-review>` |
| M1 | MEDIUM | `onboarding.component.ts:138` — `as HTMLSelectElement` type assertion (banned) |
| M2 | MEDIUM | `onboarding.component.ts:146` — `'user' as const` unnecessary assertion (remove) |
| M3 | MEDIUM | `onboarding.component.scss:284` — hardcoded hex `#274916` → use `var(--success-border)` |
| M4 | MEDIUM | `chat-panel.component.scss:133` — hardcoded hex `#1a3a5c` → use `var(--accent-border)` |
| L1 | LOW | `chat-panel.component.ts:18` — plain mutable property, should be `signal('')` |
| L2 | LOW | `wizard-step.component.ts:100` — three `as const` in ternary; `''` union variant should be `'pending'` |
| L3 | LOW | `chat-panel.component.html:14` — `track $index` weak key; add `id` to `ChatMessage` |
| L4 | LOW | `onboarding.component.html:23` — unidiomatic `[selected]` binding; use `[(ngModel)]` + `[ngValue]` |

### Logic Review — PASS
All acceptance criteria met. No logic bugs. Observations:
- `[innerHTML]` on chat messages is safe with mock data but will be an XSS vector at API integration time (document for future)
- `recommendationViews` is a static `.map()` not `computed()` — acceptable for current mock state
- Chat tracked by `$index` / folder nodes tracked by `name` — acceptable for current append-only/unique-name scenarios

### Security Review — NEEDS ATTENTION
| ID | Severity | Finding |
|----|----------|---------|
| SEC-001 | MEDIUM | `chat-panel.component.html:23` — user input rendered as HTML via `[innerHTML]`; use `{{ msg.text }}` for user messages |
| SEC-002 | MEDIUM | `onboarding.component.html:112-116` — AI rec descriptions rendered as HTML; safe now (hardcoded), XSS vector in production |
| SEC-003 | LOW | Mock data exposes macOS paths (`/Users/dev/...`); use generic placeholders |
| SEC-004 | LOW | `ExternalReference.value` has no URL validation at model level; flag for when navigation is added |

### Overall Status
- Style: **3 HIGH + 4 MEDIUM** findings — fix required before COMPLETE
- Logic: **PASS** — no blocking issues
- Security: **2 MEDIUM** findings — SEC-001 is a real fix (replace `[innerHTML]` with `{{ }}` for user messages)

---

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard/src/app/models/onboarding.model.ts
- apps/dashboard/src/app/views/onboarding/onboarding.component.ts
- apps/dashboard/src/app/views/onboarding/onboarding.component.html
- apps/dashboard/src/app/views/onboarding/onboarding.component.scss
- apps/dashboard/src/app/views/onboarding/wizard/wizard-step.component.ts
- apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.ts
- apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.html
- apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.scss
- apps/dashboard/src/app/views/onboarding/folder-tree/folder-tree.component.ts
- apps/dashboard/src/styles.scss

Issues found outside this scope: document only, do NOT fix.
