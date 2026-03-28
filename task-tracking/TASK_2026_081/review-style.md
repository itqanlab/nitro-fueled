# Code Style Review — TASK_2026_081

## Score: 5/10

| Metric          | Value         |
|-----------------|---------------|
| Overall Score   | 5/10          |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3             |
| Serious Issues  | 5             |
| Minor Issues    | 4             |
| Files Reviewed  | 10            |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`McpIntegrationsComponent.activeTab` is a plain mutable property — not a signal. When `switchTab()` is called, change detection will only propagate because `OnPush` is absent (see issue below). The moment someone adds `OnPush` to align with project standards, the tab switching silently breaks: the template never re-renders because no signal or observable changes.

Additionally, `totalToolCount = 47` is a hardcoded magic number (`mcp-integrations.component.ts:27`). When mock data is updated, the status bar will lie about the tool count, and the mismatch will require someone to hunt for this constant.

### 2. What would confuse a new team member?

`getTeamClass()`, `getBadgeTypeClass()`, and `getTransportClass()` are called directly from the template (`mcp-integrations.component.html:53,66-67,75`). The project lesson at T08 is unambiguous: template expressions must not call methods — use `computed()` signals. A new developer seeing this pattern will either copy it or spend time wondering why it was flagged in code review.

The `[class]="..."` binding on line 53 (`[class]="server.iconClass"`) and line 66 (`[class]="getBadgeTypeClass(...)"`) overwrites all static classes. Line 53 reads `<div class="server-icon" [class]="server.iconClass" ...>` — the `server-icon` static class is silently discarded at runtime because `[class]` replaces the entire class list. This is the exact T83 lesson: never combine `class="..."` with `[class]="..."`.

### 3. What's the hidden complexity cost?

Button styles (`.btn`, `.btn-primary`, `.btn-sm`, `.btn-danger`) are fully duplicated between `mcp-integrations.component.scss` and `integrations-tab.component.scss`. Future style changes require two edits. The pattern established by `dashboard.component.ts` is to use shared components; these button styles belong in a global stylesheet or a shared button component, not copy-pasted per view.

### 4. What pattern inconsistencies exist?

`CompatibilityMatrixComponent` and `IntegrationsTabComponent` use `@Input()` decorator syntax while the project standard (seen in `dashboard.component.ts` and documented in CLAUDE.md) requires `input()` signal-based inputs and `inject()` for DI. The dashboard component uses `inject()` correctly; the child components regress to decorator-based inputs without justification.

Neither child component nor the parent sets `changeDetection: ChangeDetectionStrategy.OnPush`. The project standard requires `OnPush` on every component. All three new components violate this.

`McpIntegrationsComponent` has no `changeDetection` declaration, no `OnPush`, and uses a mutable class property (`activeTab`) for interactive state instead of a signal. Compare to `DashboardComponent`, which uses `readonly` for all state.

### 5. What would I do differently?

- Replace `activeTab` with a `signal<'servers' | 'integrations'>('servers')` and use `switchTab` as a simple setter — this makes the state reactive and safe for `OnPush`.
- Replace the three `getX()` template methods with `computed()` maps keyed by server name, computed once, accessed as property lookups in the template.
- Extract `.btn` styles to a global stylesheet (already a theme concern) and remove the duplication across SCSS files.
- Replace `@Input()` decorators with `input.required<T>()` signal inputs in child components.
- Delete `totalToolCount = 47` and derive it from `servers` data: `computed(() => this.servers.reduce((n, s) => n + parseInt(s.toolCount), 0))`.

---

## Blocking Issues

### BLOCKING 1 — `[class]` binding overwrites static class (T83 violation)

**File**: `apps/dashboard/src/app/views/mcp/mcp-integrations.component.html:53`
**Issue**: `<div class="server-icon" [class]="server.iconClass" ...>` — the `[class]="..."` binding replaces the entire class attribute, discarding `server-icon`. The icon div loses all its layout and sizing styles at runtime. Same pattern at line 66 (`[class]="getBadgeTypeClass(...)"` on an element with static class `badge`) and line 75 (`[class]="getTeamClass(team)"` on element with static class `team-pill`).

**Fix**: Use `[ngClass]` to merge: `class="server-icon" [ngClass]="server.iconClass"`, or include both classes in the computed value. Apply the same fix to `integrations-tab.component.html:6` where `[class]="integration.iconClass"` is on an element with static class `integration-icon`.

---

### BLOCKING 2 — Missing `OnPush` on all new components

**File**: `apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts:6`, `compatibility-matrix.component.ts:4`, `integrations-tab.component.ts:4`
**Issue**: All three components omit `changeDetection: ChangeDetectionStrategy.OnPush`. Project standard is `OnPush` on every component. Without it, these components participate in full zone-based change detection, degrading performance for the entire app. Combined with `activeTab` being a mutable plain property (not a signal), adding `OnPush` later without simultaneously converting `activeTab` to a signal will silently break tab switching.

**Fix**: Add `changeDetection: ChangeDetectionStrategy.OnPush` and `import { ChangeDetectionStrategy }` to all three component decorators. Convert `activeTab` to a `signal`.

---

### BLOCKING 3 — Template method calls (T08 violation)

**File**: `apps/dashboard/src/app/views/mcp/mcp-integrations.component.html:66,67,75` and `.component.ts:32-45`
**Issue**: `getBadgeTypeClass(server.badgeType)`, `getTransportClass(server.transport)`, and `getTeamClass(team)` are called on every change detection cycle. The project lesson at T08 is explicit: template expressions must not call methods. These methods are called inside `@for` loops, so each cycle iterates all servers × all teams.

**Fix**: Pre-compute a lookup in the component class using `computed()` or convert these to pure pipe classes. Given that the data is static mock data, a simpler approach is to colocate the class in the model or use a `Map` computed at construction.

---

## Serious Issues

### SERIOUS 1 — `@Input()` decorators instead of `input()` signal inputs

**File**: `compatibility-matrix.component.ts:11-12`, `integrations-tab.component.ts:11`
**Issue**: Uses Angular `@Input({ required: true })` decorator syntax. Project standard (CLAUDE.md) requires signal-based `input.required<T>()`. Inconsistent with the established pattern and incompatible with future `OnPush` + signal reactivity model.

**Fix**: Replace with `readonly servers = input.required<readonly McpServer[]>()` and `readonly toolAccess = input.required<readonly McpToolAccessRow[]>()`. Import `input` from `@angular/core`.

---

### SERIOUS 2 — Hardcoded hex colors in component SCSS (T08 violation)

**File**: `mcp-integrations.component.scss:143,156-157`, `integrations-tab.component.scss:47-48,51-52,55-56,59-60,63-65,185,223`

Specific violations:
- `.btn-primary { color: #fff }` — `mcp-integrations.component.scss:143`
- `.btn-danger { border-color: #5c2125 }` — `mcp-integrations.component.scss:156` (duplicated in `integrations-tab.component.scss:236`)
- `.server-icon.filesystem { background: #1d4ed8; color: #fff }` — `mcp-integrations.component.scss:215-217`
- `.server-icon.github { background: #333; color: #fff }` — lines 219-221
- `.server-icon.context7 { background: #059669 }` — lines 223-225
- `.server-icon.playwright { background: #d63384 }` — lines 227-229
- `.server-icon.figma { background: #a259ff }` — lines 231-233
- `.server-icon.sentry { background: #362d59 }` — lines 235-237
- `.team-pill.eng { border-color: #1d4ed830; color: #60a5fa; background: #1d4ed815 }` — lines 358-360
- `.team-pill.design { border-color: #a259ff30; color: #c084fc; background: #a259ff15 }` — lines 363-365
- `.team-pill.all { border-color: #49aa1930 }` — line 370
- `.toggle-knob { background: #fff }` — `integrations-tab.component.scss:185`
- `.integration-icon.gh`, `.slack`, `.jira`, `.figma-int`, `.notion` backgrounds — `integrations-tab.component.scss:47-70`

**Fix**: Add CSS variables for brand icon colors to the theme file. At minimum, the white values should use `var(--color-white)` or `#fff` should be documented as a deliberate exception for white-on-color icon fills. The alpha-hex variants (`#1d4ed830`) have no equivalent CSS variable path — these need semantic tokens or should use `color-mix()`.

---

### SERIOUS 3 — `totalToolCount = 47` magic constant

**File**: `apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts:27`
**Issue**: Hardcoded number unrelated to actual data. `servers` has `toolCount: string` per entry. The status bar claims "47 tools available" regardless of which servers are loaded or their actual tool counts.

**Fix**: Derive from data: `readonly totalToolCount = this.servers.reduce((n, s) => n + parseInt(s.toolCount, 10), 0)`. Note this also reveals a secondary issue: `McpServer.toolCount` should be `number`, not `string` (see Minor 1).

---

### SERIOUS 4 — Duplicate button styles across SCSS files

**File**: `mcp-integrations.component.scss:118-168`, `integrations-tab.component.scss:198-243`
**Issue**: `.btn`, `.btn-primary`, `.btn-sm`, `.btn-danger` are copy-pasted verbatim. They will diverge. When `btn-danger` border-color is corrected in one file it will stay wrong in the other — this already happened: both files contain the `#5c2125` hardcoded value.

**Fix**: Move button styles to the global stylesheet. If a shared `ButtonComponent` doesn't exist yet, at minimum extract to a shared `_buttons.scss` partial imported from both.

---

### SERIOUS 5 — Form submit handler is a no-op

**File**: `apps/dashboard/src/app/views/mcp/mcp-integrations.component.html:131`
**Issue**: `(submit)="$event.preventDefault()"` — the install form has zero functionality beyond preventing default. There is no bound model (`ngModel`, reactive form), no component method called, no validation state. The "Install" button is entirely inert. This is acceptable for a mock UI only if the task explicitly says install is out of scope — context.md does not say this, and the form has a real input, real label, and a "Install" submit button, implying it was intended to function.

**Fix**: Either wire a `installServer()` method (even a no-op toast), or add a `<!-- TODO: TASK_xxx -->` comment so the next developer knows this is intentionally deferred, not forgotten.

---

## Minor Issues

- **`McpServer.toolCount` typed as `string`** (`mcp.model.ts:13`): Tool counts are numbers. Typed as string, presumably because the mock data has values like `"12 tools"`. The type should be `number`; display formatting belongs in the template. If the mock has embedded units in the string, that is a data shape smell.

- **`inactive-card` class uses `[class.inactive-card]`** (`mcp-integrations.component.html:50`): This is correct `[class.foo]` usage (additive). No issue. But the `disabled-btn` class on `mcp-integrations.component.html:105` is applied as a static class inside an `@if` — this is fine. The `disabled` and `aria-disabled` are both set; consider using CSS `[disabled]` selector in styles instead of a duplicate `.disabled-btn` class.

- **`aria-selected` on `<button>` role=tab** (`mcp-integrations.component.html:14`): Using `role="tab"` on a `<button>` is valid, but `[attr.aria-selected]` needs to emit `"true"/"false"` strings, not boolean values. Angular will render `aria-selected="true"` and `aria-selected="false"` from boolean binding, which is correct — but worth noting this differs from the ARIA spec recommendation of only setting `aria-selected="true"` on the active tab and omitting it (or using `"false"`) on others. Currently correct; flag for awareness.

- **`McpIntegration.details` uses inline object type** (`mcp.model.ts:31`): `readonly { label: string; value: string }[]` should be a named interface `McpIntegrationDetail` for reusability and readability.

---

## File-by-File Analysis

### `mcp-integrations.component.ts`

**Score**: 4/10
**Issues Found**: 2 blocking, 2 serious, 0 minor

- No `OnPush` (BLOCKING 2)
- Three template-called methods that violate T08 (BLOCKING 3)
- `totalToolCount = 47` magic constant (SERIOUS 3)
- `activeTab` as mutable property incompatible with future `OnPush` adoption

### `mcp-integrations.component.html`

**Score**: 4/10
**Issues Found**: 2 blocking, 1 serious

- `[class]` overwrites static classes at lines 53, 66, 75 (BLOCKING 1)
- Template method calls at lines 66, 67, 75 (BLOCKING 3)
- Form submit is a no-op with no TODO marker (SERIOUS 5)

### `mcp-integrations.component.scss`

**Score**: 5/10
**Issues Found**: 0 blocking, 2 serious

- Hardcoded hex colors throughout `.server-icon` variants and `.team-pill` variants (SERIOUS 2)
- Button styles duplicated from `integrations-tab` (SERIOUS 4)
- CSS variable usage is otherwise good for structural tokens

### `compatibility-matrix.component.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious

- No `OnPush` (BLOCKING 2)
- `@Input()` decorator instead of `input.required<T>()` (SERIOUS 1)
- File is appropriately small and focused

### `compatibility-matrix.component.html`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious

- Clean table structure with correct `scope` attributes on `<th>`
- `role="grid"` on a table is semantically debatable (a regular `<table>` with headers does not need `role="grid"`), but not harmful

### `compatibility-matrix.component.scss`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious

- Clean, all colors via CSS variables

### `integrations-tab.component.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious

- No `OnPush` (BLOCKING 2)
- `@Input()` decorator instead of `input.required<T>()` (SERIOUS 1)

### `integrations-tab.component.html`

**Score**: 5/10
**Issues Found**: 1 blocking, 0 serious

- `[class]="integration.iconClass"` on element with static `integration-icon` class (BLOCKING 1 — same pattern)
- Status class logic using string literals (`detail.label === 'Status' && detail.value === 'Active'`) is fragile coupling to data shape

### `integrations-tab.component.scss`

**Score**: 4/10
**Issues Found**: 0 blocking, 2 serious

- Hardcoded hex across all brand icon colors (SERIOUS 2)
- Full button style duplication (SERIOUS 4)
- `toggle-knob { background: #fff }` — hardcoded white (SERIOUS 2)

### `mcp.model.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

- `toolCount: string` should be `number` (Minor 1)
- Inline object type in `McpIntegration.details` should be a named interface (Minor 4)

---

## Pattern Compliance

| Pattern                  | Status | Concern                                                       |
|--------------------------|--------|---------------------------------------------------------------|
| `standalone: true`       | PASS   | All three components are standalone                           |
| `OnPush` change detection| FAIL   | Missing on all three new components                           |
| `inject()` for DI        | PASS   | Parent uses `inject()` correctly                              |
| Signal-based inputs      | FAIL   | Child components use `@Input()` decorators                    |
| No template method calls | FAIL   | Three methods called directly in template (T08)               |
| `[class]` vs `[ngClass]` | FAIL   | Static class overwritten by `[class]` binding (T83)           |
| No hardcoded hex colors  | FAIL   | Extensive hardcoded colors in both SCSS files                 |
| `@if`/`@for` control flow| PASS   | No `*ngIf`/`*ngFor` usage                                     |

---

## Technical Debt Assessment

**Introduced**:
- Two SCSS files each carrying their own full button implementation — guaranteed to diverge
- Template method-call pattern normalizes a T08 violation for future contributors copying this component
- `[class]` static-class-overwrite bug will be invisible until the icon layout appears broken in a browser

**Mitigated**: None — this is greenfield view code.

**Net Impact**: Negative. Three pattern violations documented in `review-lessons/frontend.md` are repeated here, suggesting the lessons were not consulted before implementation.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `[class]` binding silently destroys static classes on icon elements (BLOCKING 1) — this is a runtime rendering bug, not just a style preference. Combined with missing `OnPush` on all three components and three template method calls, the code does not meet the minimum bar for the project's established standards.

## What Excellence Would Look Like

A 9/10 implementation would:
1. Use `signal<'servers' | 'integrations'>('servers')` for `activeTab` and set `OnPush` on all components
2. Replace all three `getX()` template methods with `computed()` Maps keyed by server name
3. Use `input.required<T>()` signal inputs on child components
4. Fix all `[class]` overwrite bugs to use `[ngClass]`
5. Use CSS variables for icon brand colors (or at minimum document them as theme-locked intentional exceptions)
6. Extract button styles to a shared partial
7. Derive `totalToolCount` from data, and type `McpServer.toolCount` as `number`
