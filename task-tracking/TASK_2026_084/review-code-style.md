# Code Style Review — TASK_2026_084

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit:** `93fae9d feat(dashboard): implement Project Onboarding view with wizard and chat panel`

---

## Summary

Overall the implementation follows project conventions well: all components use `ChangeDetectionStrategy.OnPush`, standalone components, Signals API for inputs/outputs, and explicit access modifiers throughout. Three significant file-size violations are present, along with two hardcoded hex colors, two `as` type assertions in the smart component, and one mutable property that bypasses the Signals API.

**Verdict: NEEDS FIXES** — file-size violations and hardcoded colors must be resolved before merge.

---

## Issues by Severity

### HIGH — File Size Violations

#### H1 · `onboarding.component.scss` — 477 lines (max: 150)
**File:** `apps/dashboard/src/app/views/onboarding/onboarding.component.scss`
**Lines:** 1–477
**Rule:** Component SCSS files max 150 lines.

The file is 477 lines — more than 3× the limit. It owns styles for all wizard steps, buttons, inputs, section cards, data collection, AI analysis cards, folder organization, form actions, and the bottom panel. This is essentially a design system stylesheet scoped to one component.

**Expected fix:** Extract step-specific styles into their respective child component SCSS files. The `.section`, `.btn*`, `.input*`, `.data-summary*`, `.ai-recommendation*`, `.folder-org*` groups can each live in the component that renders them. Global utility classes (`.btn`, `.input`) belong in `styles.scss` or a shared `_components.scss` partial.

---

#### H2 · `chat-panel.component.scss` — 200 lines (max: 150)
**File:** `apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.scss`
**Lines:** 1–200
**Rule:** Component SCSS files max 150 lines.

Exceeds limit by 50 lines. The file is self-contained and well-organized, so extraction would be minimal — the `.chat-msg*` block group (lines 64–144) could be extracted into a sub-component or scoped partial to bring it under the limit.

---

#### H3 · `onboarding.component.html` — 170 lines (max: 150)
**File:** `apps/dashboard/src/app/views/onboarding/onboarding.component.html`
**Lines:** 1–170
**Rule:** Component template files max 150 lines.

Exceeds by 20 lines. The excess is primarily the Step 6 folder organization block (lines 127–138) and the navigation footer (lines 141–153). Extracting Step 6 content into a dedicated `<app-folder-review>` sub-component would bring the template under the limit.

---

### MEDIUM — Code Convention Violations

#### M1 · `onboarding.component.ts:138` — `as` type assertion on DOM event
**File:** `apps/dashboard/src/app/views/onboarding/onboarding.component.ts`
**Line:** 138
**Rule:** No `as` type assertions.

```typescript
// current
const name = (event.target as HTMLSelectElement).value;
```

While DOM event type assertions are idiomatic JavaScript, the project convention explicitly bans `as`. The canonical Angular alternative is to type the event parameter directly or use a typed `$event` binding in the template with a `(change)` handler that passes `$event.target.value` as a `string` directly.

---

#### M2 · `onboarding.component.ts:146` — `as const` assertion in `onChatMessage`
**File:** `apps/dashboard/src/app/views/onboarding/onboarding.component.ts`
**Line:** 146
**Rule:** No `as` type assertions.

```typescript
{ sender: 'user' as const, text, time: ... }
```

`as const` is still an `as` expression. Since `ChatMessage.sender` is typed as `'ai' | 'user'`, the literal `'user'` already satisfies the union type without a cast. The `as const` is unnecessary here and can be removed.

---

#### M3 · `onboarding.component.scss:284` — hardcoded hex color
**File:** `apps/dashboard/src/app/views/onboarding/onboarding.component.scss`
**Line:** 284
**Rule:** All colors must use CSS custom property tokens (`var(--token)`).

```scss
// current
border: 1px solid #274916;

// expected
border: 1px solid var(--success-border);
```

The `.detection-info` block uses a raw hex `#274916` (dark green) for its border. A `--success-border` token should be added to `styles.scss` alongside the existing `--success` and `--success-bg` tokens.

---

#### M4 · `chat-panel.component.scss:133` — hardcoded hex color
**File:** `apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.scss`
**Line:** 133
**Rule:** All colors must use CSS custom property tokens (`var(--token)`).

```scss
// current
border: 1px solid #1a3a5c;

// expected
border: 1px solid var(--accent-border);
```

User message bubble border uses a raw hex `#1a3a5c` (dark blue). An `--accent-border` token (or `--accent-bg-border`) should be introduced in `styles.scss` and used here.

---

### LOW — Style Concerns

#### L1 · `chat-panel.component.ts:18` — mutable local state not using `signal()`
**File:** `apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.ts`
**Line:** 18
**Rule:** Signals API — use `signal()` for reactive state.

```typescript
// current
public inputValue = '';

// expected
public readonly inputValue = signal('');
```

`inputValue` is a plain mutable class property. `[(ngModel)]` compensates for the OnPush boundary here, but plain mutable properties are inconsistent with the project's Signals-first pattern. Introducing `signal<string>('')` with `model()` or manual `set()` on `send()` would align with the convention.

---

#### L2 · `wizard-step.component.ts:100` — `as const` in ternary chain
**File:** `apps/dashboard/src/app/views/onboarding/wizard/wizard-step.component.ts`
**Line:** 100

```typescript
state: s.index < current ? 'done' as const : s.index === current ? 'current' as const : '' as const,
```

Three `as const` assertions in a single ternary chain. A typed helper function or explicit return type annotation on `stepsView` would eliminate the need for inline casts. Additionally, the empty string `''` as a union variant (`'done' | 'current' | ''`) is semantically ambiguous — `'pending'` would be more expressive and self-documenting.

---

#### L3 · `chat-panel.component.html:14` — `track $index` instead of stable key
**File:** `apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.html`
**Line:** 14

```html
@for (msg of messages(); track $index) {
```

`$index` is a weak track key — it causes full DOM re-creation on any reorder or prepend. `ChatMessage` lacks an `id` field, so this is a model-level gap rather than a template error alone. For a chat thread that only appends, it is low risk, but adding a `readonly id: string` to `ChatMessage` and tracking by it would be the correct fix.

---

#### L4 · `onboarding.component.html:23` — `[selected]` binding on `<option>` is unidiomatic
**File:** `apps/dashboard/src/app/views/onboarding/onboarding.component.html`
**Line:** 23

```html
<option [selected]="client.name === selectedClient().name">{{ client.name }}</option>
```

Binding `[selected]` per option is a DOM-level workaround. The Angular idiomatic approach is `[(ngModel)]` on the `<select>` with `[ngValue]` on each `<option>`. This would also remove the need for the `onClientChange` event handler and the `as HTMLSelectElement` cast (M1 above).

---

## Files with No Issues

| File | Status |
|------|--------|
| `onboarding.model.ts` | ✓ Clean — interfaces, readonly fields, SCREAMING_SNAKE_CASE constant, string literal unions all correct |
| `folder-tree/folder-tree.component.ts` | ✓ Clean — OnPush, signals input, access modifiers, inline styles acceptable at 62 lines |
| `styles.scss` | ✓ Clean — three new tokens follow naming convention, placed correctly |

---

## Issue Summary

| ID | File | Severity | Rule |
|----|------|----------|------|
| H1 | `onboarding.component.scss` | HIGH | 477-line SCSS (max 150) |
| H2 | `chat-panel.component.scss` | HIGH | 200-line SCSS (max 150) |
| H3 | `onboarding.component.html` | HIGH | 170-line template (max 150) |
| M1 | `onboarding.component.ts:138` | MEDIUM | `as` type assertion |
| M2 | `onboarding.component.ts:146` | MEDIUM | `as const` assertion (unnecessary) |
| M3 | `onboarding.component.scss:284` | MEDIUM | Hardcoded hex `#274916` |
| M4 | `chat-panel.component.scss:133` | MEDIUM | Hardcoded hex `#1a3a5c` |
| L1 | `chat-panel.component.ts:18` | LOW | Plain mutable property, not `signal()` |
| L2 | `wizard-step.component.ts:100` | LOW | `as const` chain + ambiguous `''` union variant |
| L3 | `chat-panel.component.html:14` | LOW | `track $index` weak key |
| L4 | `onboarding.component.html:23` | LOW | Unidiomatic `[selected]` binding |
