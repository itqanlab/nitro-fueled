# Code Style Review — TASK_2026_115

## Review Summary

| Metric          | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Overall Score   | 7/10                                                         |
| Assessment      | PASS_WITH_NOTES                                              |
| Blocking Issues | 0                                                            |
| Serious Issues  | 2                                                            |
| Minor Issues    | 4                                                            |
| Files Reviewed  | 9                                                            |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `knowledge-scope.component.html` calls `activeScopes()` **three times per badge** in the `@for` loop (lines 8, 10, 11). Each call re-evaluates the `computed()` signal getter. With OnPush this is safe today, but if the store ever signals at high frequency (e.g. during batch patch operations), three identical signal reads per list item per cycle will surface as wasted microtasks. The signal was already computed once — it should be consumed once per cycle via a template variable or an `@let` binding.

### 2. What would confuse a new team member?

`mcp-tool-access.component.scss` keeps all rules on single lines for some selectors (lines 1, 32, 50–51) but expands others into multi-line blocks. The parent `metadata-panel.component.scss` uses consistent multi-line formatting throughout. A developer opening the new files and the parent in the same session will see two different code styles in the same feature directory with no explanation.

### 3. What's the hidden complexity cost?

The three SCSS files introduce three separate label style blocks (`.mcp-section-label`, `.scope-label`, `.compat-label`) that are byte-for-byte identical: `font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); margin-bottom: 8px;`. This is copy-paste styling. The parent component already owns `.field-label` which does the same job. Future theme changes (e.g. changing label uppercase tracking) now require edits in four places instead of one.

### 4. What pattern inconsistencies exist?

**`styleUrl` (singular) vs `styleUrls` (plural):** All three modified `.ts` files use `styleUrl` (the Angular 17+ shorthand). The parent `metadata-panel.component.ts` may use `styleUrls`. This is not a bug — `styleUrl` is the correct modern form — but it is worth confirming the rest of the feature has migrated so the codebase is consistent. If any sibling still uses `styleUrls`, there is now a mixed convention in the same directory.

**Mixed SCSS formatting style:** `mcp-tool-access.component.scss` (and partially `compatibility-list.component.scss`) uses single-line compressed rules (`.mcp-section { margin-top: 16px; }`) for simple selectors. `knowledge-scope.component.scss` and the parent use expanded formatting. No project-wide convention is established in the review-lessons files yet, making this the first divergence.

### 5. What would I do differently?

- Extract the three identical label styles into a shared `.panel-sub-label` class in `metadata-panel.component.scss` (or a shared stylesheet) and reference it from the templates. This follows the DRY principle already practiced in the parent file.
- Use a single `@let scopes = activeScopes()` binding in the knowledge-scope template to call the signal once per change-detection cycle instead of three times per badge.
- Normalise single-line SCSS rules to expanded format to match the parent file's style.

---

## Blocking Issues

None.

---

## Serious Issues

### Issue 1: Triplicated label style block across three SCSS files

- **Files**: `mcp-tool-access.component.scss:3-10`, `knowledge-scope.component.scss:3-10`, `compatibility-list.component.scss:3-10`
- **Problem**: `.mcp-section-label`, `.scope-label`, and `.compat-label` share identical declarations. The parent's `.field-label` class already provides the same styling.
- **Tradeoff**: Every future design change to section labels (color, size, tracking) must be made in three places, and the deviation from the parent class will silently diverge over time.
- **Recommendation**: Remove the three local label classes and apply the parent's existing `.field-label` in the templates, or centralise into a single `.panel-sub-label` utility class in `metadata-panel.component.scss`.

### Issue 2: `activeScopes()` signal called three times per badge per change-detection cycle

- **File**: `knowledge-scope.component.html:8, 10, 11`
- **Problem**: Each `@for` iteration calls `activeScopes()` three times in bindings (`[class.active]`, `[attr.aria-checked]`, `[attr.aria-label]`). Although OnPush batches DOM updates, the getter itself runs three times per item per cycle.
- **Tradeoff**: Negligible today with three badges, but the pattern is incorrect — a `computed()` signal should be read once and stored when its value is used multiple times in the same expression context.
- **Recommendation**: Angular 17.2+ supports `@let scopes = activeScopes();` at the template level. Use it to read the signal once and reference `scopes` in all three bindings.

---

## Minor Issues

- **`mcp-tool-access.component.scss:1, 32, 50–51`** — Single-line compressed rules. Inconsistent with the multi-line expanded format used everywhere else in the feature (see `metadata-panel.component.scss`). Pick one style and apply it uniformly.
- **`mcp-tool-access.component.html:22`** — Unicode characters `✓` and `×` used as status icons. These are invisible to screen readers (the `<span>` has `aria-hidden="true"`, which is correct), but they are also invisible in source diffs and render inconsistently across font stacks. CSS content pseudo-elements or an SVG icon would be more robust.
- **`compatibility-list.component.scss:34`** — `font-family: monospace` is a bare generic family with no fallback. The rest of the codebase uses `font-family: inherit` or a project-level monospace variable. This creates an inconsistent typeface on Windows where the browser default monospace resolves to Courier New.
- **`knowledge-scope.component.ts:15-19`** — `SCOPE_BADGES` is a module-level constant. This is fine for now, but if `KnowledgeScopeComponent` ever needs i18n, the labels will be hardcoded strings at module level with no injection point. A minor future-proofing note only.

---

## File-by-File Analysis

### `mcp-tool-access.component.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Clean extraction. `standalone: true`, `OnPush`, `inject()`, `computed()` — all correct. `styleUrl` (singular) is the correct Angular 17 form. The `toggleTool` logic is appropriately simple.

### `mcp-tool-access.component.html`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Correct use of `@for` block syntax, `role="checkbox"`, `aria-checked`, `tabindex`, keyboard handlers. The Unicode `✓`/`×` characters (line 22) work but are fragile across fonts.

### `mcp-tool-access.component.scss`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

Label block triplication (serious). Mixed single-line/multi-line formatting (minor). All colors go through CSS variables — no hardcoded hex. `var(--radius)`, `var(--border-focus)`, `var(--success)` all consistent with the rest of the feature.

### `knowledge-scope.component.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Well-structured. `SCOPE_BADGES` as a module constant is acceptable. `readonly ScopeBadge[]` type is precise. i18n hardcoding noted as a future-proofing concern only.

### `knowledge-scope.component.html`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

`activeScopes()` called three times per badge per cycle. `role="switch"` on `<button>` is semantically correct for toggle behavior. `@for` block syntax used correctly.

### `knowledge-scope.component.scss`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

Label block triplication (serious). Format is expanded and consistent with parent. All values via CSS variables. `border-radius: 12px` is a magic number — could be `var(--radius-pill)` if the project has such a token, but no violation if it does not.

### `compatibility-list.component.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Minimal and correct. Nullish coalescing (`?? []`) on `selectedAgent()` handles the empty state safely.

### `compatibility-list.component.html`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Guard `@if (compatibility().length > 0)` is appropriate. `role="list"` and `aria-label` on the `<ul>` are correct. Clean.

### `compatibility-list.component.scss`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

Label block triplication (serious). Bare `font-family: monospace` on `.compat-version` (minor). Mixed single-line rule on `.compat-section` (minor). CSS variables used for all colors — no violations.

---

## Pattern Compliance

| Pattern              | Status       | Concern                                                     |
| -------------------- | ------------ | ----------------------------------------------------------- |
| `standalone: true`   | PASS         | All three components                                        |
| `OnPush` change detection | PASS    | All three components                                        |
| `inject()` for DI    | PASS         | All three use `inject(AgentEditorStore)`                    |
| `@for`/`@if` block syntax | PASS    | No `*ngFor`/`*ngIf` present                                 |
| `computed()` for derived state | PASS | Signals derived correctly                                   |
| Signal called once per template context | FAIL | `activeScopes()` called 3x per badge in knowledge-scope template |
| CSS variables only   | PASS         | No hardcoded hex/rgb in any component                       |
| `styleUrl` (singular) | PASS        | Angular 17 form used correctly                              |
| SCSS formatting consistency | PARTIAL | Mixed single-line/multi-line in mcp and compat SCSS files   |
| DRY styling          | FAIL         | Three identical label blocks instead of one shared class    |

---

## Technical Debt Assessment

**Introduced**: Three label style duplicates that will drift apart as the design evolves. One incorrect signal-read multiplier per badge in the knowledge-scope template.

**Mitigated**: The extraction itself removes the inline template/styles smell flagged in TASK_2026_080 review lessons. The codebase now has a uniform external-file convention in this feature directory.

**Net Impact**: Marginally positive. The refactoring is correct in direction. The issues found are maintenance debt introduced during the mechanical extraction, not pre-existing.

---

## Verdict

**Recommendation**: PASS_WITH_NOTES
**Confidence**: HIGH
**Key Concern**: The triplicated label style block is the issue most likely to cause maintenance pain. It is not a bug, but it is the kind of shortcut that turns a 2-minute style fix into a grep-and-hunt exercise 6 months from now.

## What Excellence Would Look Like

A 10/10 extraction would have:
1. Identified the `.field-label` class in the parent component and reused it in the three templates instead of copying the declaration three times.
2. Used `@let scopes = activeScopes();` in the knowledge-scope template to read the signal exactly once.
3. Applied consistent expanded SCSS formatting matching the parent file.
4. Used a CSS variable or project token for the pill `border-radius: 12px` in knowledge-scope if one exists.
