# Code Style Review — TASK_2026_080 (Agent Editor View)

## Score: 5/10

## Summary

| Metric          | Value         |
| --------------- | ------------- |
| Overall Score   | 5/10          |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3             |
| Serious Issues  | 5             |
| Minor Issues    | 6             |
| Files Reviewed  | 15            |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`marked.parse()` is called as synchronous via `as string` cast in `editor-panel.component.ts:126`.
`marked` v17 defaults to `async: false`, which makes this work today — but the cast will silently
produce a dangling Promise if anyone calls `marked.use({ async: true })` elsewhere in the app, or
if the default changes in a future patch. There is no runtime guard. This is a latent reliability
bomb with zero indication it exists.

The `AgentEditorStore` calls `this.mockData.getAgentEditorList()` twice — once as a field
initializer (line 44) and once in the constructor (line 90). If `MockDataService` is ever replaced
with a real IPC service that is stateful or has side effects, both calls will double-fire, producing
stale or duplicated data.

The `saveDraft()` and `saveVersion()` methods are identical (lines 128–140 in the store). When
real persistence is wired, one of these will be updated and the other will silently retain the
stub behavior, causing a divergence the developer will not notice at code-read time.

### 2. What would confuse a new team member?

`AgentEditorStore` is decorated `@Injectable({ providedIn: 'root' })` but the rest of the codebase
has no other `.store.ts` files. The project review lessons reference "Store max 200 lines" in the
context of NgRx Signal Store conventions (`patchState`). A new developer will assume this follows
the NgRx pattern and spend time looking for `signalStore` / `patchState` before realizing this is a
plain injectable service wearing a `.store.ts` label. The naming contract `.store.ts` implies NgRx
Signal Store semantics that are absent here.

`EditorPanelComponent` uses `ChangeDetectorRef.markForCheck()` manually inside
`requestAnimationFrame` (line 98) in what is otherwise a signal-driven codebase. This is an unusual
mixing of two change detection strategies and will confuse anyone who assumes the component is
purely signal-reactive.

`isEditorVisible` and `isPreviewVisible` (lines 45–53) are `get` accessors that call
`this.store.viewMode()` — a signal read — inside a getter. Every template change detection cycle
will call these getters, which re-read the signal. The pattern is not wrong, but it diverges from
the project's established pattern of using `computed()` for derived state. The review lesson
"Template expressions must not call methods — use `computed()` signals" applies.

### 3. What's the hidden complexity cost?

`isDirty` (store line 79–87) uses `JSON.stringify` to deep-compare the metadata object on every
read. This is called on every change detection cycle because `metadata()` and `editorContent()` are
live signals. For a metadata object with `mcpTools` (potentially a long array) this is O(n) string
serialization on every signal read. This will become visibly slow as agent definitions grow.

`onTagKeydown` in `metadata-panel.component.ts:109` calls `this.tags()` twice in rapid succession
(once to check inclusion, once to spread into the new array). Since `this.tags()` is a computed
signal that re-reads `this.store.metadata().tags`, and both reads occur within the same synchronous
frame, there is no actual race, but the double-read is a maintenance smell — if anyone introduces an
async step between them, a stale-closure bug appears.

### 4. What pattern inconsistencies exist?

- `mcp-tool-access.component.ts` and `knowledge-scope.component.ts` use inline `template:` and
  `styles:` arrays — but every other component in this feature (`agent-list-sidebar`, `metadata-panel`,
  `editor-panel`, `editor-status-bar`) uses external `.html` / `.scss` files. The deviation is
  unexplained. At 112 lines, `mcp-tool-access.component.ts` is approaching the 150-line component
  limit. `compatibility-list.component.ts` at 80 lines is at the model-file limit. These should
  follow the same external-file convention.

- `CompatibilityListComponent` is imported in `metadata-panel.component.ts` but was NOT in the
  original files-to-review list provided to the reviewer. This suggests it was added as an
  undocumented addition during implementation. The component is structurally sound but it bypasses
  the review scope.

- `AgentListSidebarComponent` exposes `selectAgent(id)` as a `protected` method that is just a
  passthrough to `this.store.selectAgent(id)` (line 52–54). There is no transformation logic. This
  wrapper method adds a layer of indirection with no benefit — the template could bind directly to
  `store.selectAgent(agent.id)` with identical semantics.

- `selectedAgentVersion` computed signal in `agent-list-sidebar.component.ts` (lines 48–50) is
  a separate computed derived from `selectedAgent()`. But `selectedAgentId` is also derived from
  `selectedAgent()`. These two signals each individually subscribe to the same upstream signal,
  causing two separate computed evaluations per agent change instead of one. The version badge
  should be part of the same computed or derived inline from `selectedAgentId()`.

- The `field-select` dropdown arrow is implemented as an SVG data URI with a hardcoded hex stroke
  color `%23595959` (`metadata-panel.component.scss:92`). This is a hardcoded color value inside
  CSS — it does not go through the CSS variable system and will not update when the theme changes.
  This directly violates the "Never hardcoded hex colors" rule in the review lessons.

### 5. What would I do differently?

- Replace the `JSON.stringify` dirty check with a field-by-field primitive comparison or use an
  immutable record identity check (replacing the entire metadata object on mutation preserves identity
  equality for unchanged sub-fields).

- Extract `isEditorVisible` and `isPreviewVisible` as `computed()` signals instead of `get`
  accessors, consistent with the rest of the codebase pattern.

- Replace the SVG data-URI dropdown arrow with a positioned inline SVG element so the stroke
  color reads from `var(--text-tertiary)`.

- Consolidate `saveDraft` and `saveVersion` into a single method with a `type: 'draft' | 'version'`
  parameter until real persistence is implemented, so the two paths are obviously the same stub.

- Rename `AgentEditorStore` to `AgentEditorService` or adopt NgRx Signal Store (`signalStore()`)
  to match the naming contract implied by `.store.ts`.

---

## Blocking Issues

### Blocking 1: Hardcoded hex color in CSS variable system

- **File**: `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.scss:92`
- **Problem**: The `field-select` background-image uses an SVG data URI with stroke color
  `%23595959` (hex `#595959`). This is a hardcoded color that cannot be reached by the theme
  token system. The rule "Never hardcoded hex colors" is explicitly in the review lessons and
  anti-patterns.
- **Impact**: When the theme changes (e.g., light → dark, or brand color update), the dropdown
  arrow stays `#595959` and becomes invisible against the new background. This has already been
  flagged in `frontend.md` (T38): "Inline SVG data URIs bypass the token system."
- **Fix**: Replace with a positioned `<span>` or `<svg>` element inside the select wrapper,
  styled with `color: var(--text-tertiary)` and `fill: currentColor`.

### Blocking 2: `get` accessor pattern for signal-derived state violates established convention

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts:45–53`
- **Problem**: `isEditorVisible` and `isPreviewVisible` are `protected get` accessors that call
  `this.store.viewMode()` — a signal read — inside a getter. The project review lesson states
  "Template expressions must not call methods — use `computed()` signals." A `get` accessor called
  from a template has identical semantics to a method call in this context: it fires on every
  change detection cycle, not once per dependency change.
- **Impact**: Any component that triggers change detection (e.g., cursor movement updating
  `cursorPosition`) will re-evaluate these getters even though `viewMode` did not change. With
  `OnPush` this is less frequent but still unnecessary, and it is a pattern violation that will
  propagate if left as the canonical example.
- **Fix**: Replace both getters with `protected readonly isEditorVisible = computed(() => ...)` and
  `protected readonly isPreviewVisible = computed(() => ...)`.

### Blocking 3: `marked.parse()` result treated as synchronous `string` without explicit configuration

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts:126`
- **Problem**: `marked.parse(content) as string` relies on `marked`'s default `async: false`
  option. `marked` v17 is installed. If `marked.use({ async: true })` is configured anywhere
  in the app initialization (e.g., for a highlight.js plugin), `parse()` returns a
  `Promise<string>` and the `as string` cast silently passes a Promise object to `DOMPurify`,
  which sanitizes the string `"[object Promise]"` — the preview renders garbage with no error.
  The cast hides the risk entirely.
- **Impact**: Silent regression: preview renders `[object Promise]` instead of HTML. The error
  is invisible at the call site and at test time.
- **Fix**: Either configure `marked` explicitly with `{ async: false }` and assert via TypeScript
  overloads, or make `renderMarkdown` async and `await marked.parse(content)` properly, then
  handle the Promise in `schedulePreviewUpdate`.

---

## Serious Issues

### Serious 1: `saveDraft` and `saveVersion` are identical implementations

- **File**: `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts:128–140`
- **Problem**: Both methods perform exactly the same two `set` calls. There is no comment
  explaining the intended distinction. When a developer wires real persistence to one but not
  the other, the divergence will be silent.
- **Recommendation**: Add a `// TODO: saveVersion should increment currentVersion and persist to
  disk; saveDraft should persist without version bump` comment, or merge into one method with a
  `type` param until real implementation lands.

### Serious 2: `AgentEditorStore` naming implies NgRx Signal Store but uses plain `@Injectable`

- **File**: `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts:39`
- **Problem**: The `.store.ts` file naming convention and class suffix `Store` carry NgRx Signal
  Store semantics in this project's frontend review lessons (Store max 200 lines, `patchState`,
  `signalStore()`). This file uses `@Injectable({ providedIn: 'root' })` with raw signals — a
  different pattern. A developer onboarding to this codebase will apply NgRx mental models and
  look for patterns that do not exist here.
- **Recommendation**: Rename to `AgentEditorService` and the file to `agent-editor.service.ts`,
  or convert to `signalStore()` + `withState()` + `withMethods()` which is the project standard.

### Serious 3: `getAgentEditorList()` called twice on construction

- **File**: `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts:43–44 and 90–91`
- **Problem**: `this.agentList` is initialized by calling `this.mockData.getAgentEditorList()` at
  field init time (line 44). Then the constructor calls `this.mockData.getAgentEditorList()` again
  (line 90) to select the first agent. When `MockDataService` is replaced with a real service
  (IPC call, HTTP), this will double-fetch. Even with mock data, it creates a `public agentList`
  that is a snapshot at field-init time, while the constructor uses a separate call — if those
  two calls ever diverge, `agentList` and `selectedAgent` will be out of sync.
- **Recommendation**: Use `this.agentList` in the constructor body instead of calling
  `getAgentEditorList()` again.

### Serious 4: `isActive()` method called three times per badge per cycle in `KnowledgeScopeComponent`

- **File**: `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.ts:34–38`
- **Problem**: For each `@for` iteration, the template calls `isActive(badge.value)` three times —
  for `[class.active]`, `[attr.aria-checked]`, and `[attr.aria-label]`. `isActive()` calls
  `this.activeScopes().includes(scope)` each time. With `OnPush` this is bounded, but the pattern
  is explicitly flagged in review lessons: "Per-item template method calls must be replaced with
  precomputed collections." The `isActive` result should be precomputed into the badge object or
  into a `computed()` Map.
- **Recommendation**: Compute a `readonly activeScopeSet = computed(() => new Set(...))` and call
  `activeScopeSet().has(badge.value)` once per template expression, or augment the badge items with
  an `isActive` field derived via `computed()`.

### Serious 5: Inline `template:` and `styles:` in three components inconsistent with codebase convention

- **Files**:
  - `apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.ts`
  - `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.ts`
  - `apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.ts`
- **Problem**: All other components in this feature and in the wider codebase use external
  `.html` and `.scss` files. These three use inline template strings and inline `styles` arrays.
  Inline templates have no IDE-level HTML language support (autocomplete, syntax errors),
  no SCSS nesting support, and bypass Angular's style scoping SCSS pipeline. They also push each
  file past the 80-line interface/model limit toward the 150-line component limit.
- **Recommendation**: Extract templates to `.html` and styles to `.scss` files, matching the
  codebase convention.

---

## Minor Issues

1. **`agent-list-sidebar.component.ts:52–54`** — `selectAgent()` is a one-line passthrough to
   `this.store.selectAgent(id)`. No transformation. Remove the wrapper; bind `store.selectAgent`
   directly in the template, or make `store` `public` if that is the convention.

2. **`agent-list-sidebar.component.ts:48–50`** — `selectedAgentVersion` is a separate `computed`
   that re-reads `this.store.selectedAgent()`. This is the second signal subscription to the same
   upstream per component. Minor inefficiency; consolidate with `selectedAgentId` into a single
   computed that returns an object `{ id, version }`.

3. **`editor-status-bar.component.html:30–33`** — `store.selectedAgent()` is called three times
   in the same template: line 26, 31, 47, and 49. This re-reads the signal on each template
   binding evaluation. In an `OnPush` component this is bounded, but using a single `computed()`
   alias in the class (`protected readonly agent = computed(() => this.store.selectedAgent())`)
   would reduce the signal read count and make the template cleaner.

4. **`agent-editor-view.component.ts:26`** — `protected readonly store = inject(AgentEditorStore)`.
   The store is injected but never referenced in the view component's own template or logic. The
   template (`agent-editor-view.component.html`) does not use `store`. The injection is dead code
   in the view component itself — each child component injects the store independently. Remove
   the injection from the view component.

5. **`editor-panel.component.scss:132`** — `font-family: 'Courier New', Courier, monospace` is a
   hardcoded font stack for the editor textarea. This value is repeated at line 170 inside
   `.preview-pane :global(code)`. If the design system adopts a monospace token (`--font-mono`),
   both will need to be updated manually. Extract to a CSS variable.

6. **`metadata-panel.component.scss:92`** — The `data:image/svg+xml` background-image for the
   select dropdown arrow is also functionally a dark-mode incompatibility risk beyond the color
   violation noted in Blocking Issue 1. The entire SVG URL would need to be duplicated inside a
   `@media (prefers-color-scheme: light)` or theme-class block to support theming.

---

## File-by-File Analysis

### `agent-editor.model.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean, readonly interfaces throughout. Proper use of string union types for
`AgentCategory`, `AgentType`, `KnowledgeScope`, `EditorViewMode` — exactly what the anti-patterns
mandate. Under 80 lines (38 lines). No concerns.

---

### `agent-editor.store.ts`

**Score**: 4/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

**Analysis**: The naming mismatch (service pattern in a `.store.ts` file) is the dominant issue.
The double-call to `getAgentEditorList()` is a maintenance trap. The `saveDraft`/`saveVersion`
identity is a silent future bug. At 141 lines it is within bounds but will exceed 200 on first
real-implementation pass.

**Specific Concerns**:
1. Lines 43–44 vs 90–91: `getAgentEditorList()` called twice.
2. Lines 128–140: `saveDraft` and `saveVersion` are identical.
3. Lines 79–87: `JSON.stringify` comparison on every signal read — O(n) on potentially large arrays.

---

### `agent-editor-view.component.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Clean orchestration component. Correct `standalone: true`, `OnPush`,
`inject()` DI. Minor issue: the injected `store` is unreferenced in this component's own
template.

---

### `agent-editor-view.component.html`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Minimal and correct. 9 lines. The `app-editor-status-bar` is a sibling to
`editor-layout` (not a child), which correctly models the layout — the status bar sits
outside the column-flex container so it spans full width. No issues.

---

### `agent-editor-view.component.scss`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean CSS variable usage. The `height: calc(100vh - 48px - 40px)` magic numbers
(lines 5) are unexplained — `48px` is presumably the top nav height and `40px` the status bar
height. A comment would help future maintainers. Not blocking.

---

### `agent-list-sidebar/agent-list-sidebar.component.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

**Analysis**: Good use of `computed()`. `MAX_VISIBLE_AGENTS` named constant is correct practice.
The `selectAgent` passthrough wrapper and the double-computed pattern for `selectedAgentId` +
`selectedAgentVersion` are the minor concerns.

---

### `agent-list-sidebar/agent-list-sidebar.component.html`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Uses `@for`/`@if` block syntax correctly. Accessibility attributes (`role="listbox"`,
`role="option"`, `aria-selected`, `aria-current`) are present and correct. Keyboard handling
(`keydown.enter`, `keydown.space`) is present. `tabindex="0"` on `<li>` is correct for the
`listbox` role. Template is within the 50-line inline limit (49 lines).

---

### `metadata-panel/metadata-panel.component.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Well-structured. Constants extracted for `CATEGORY_OPTIONS` and `TYPE_OPTIONS`.
`onTagKeydown` directly manipulates `inputEl.value = ''` (line 111) — DOM mutation from the
component class, which is acceptable here since it's clearing an uncontrolled input, but it
bypasses Angular's change detection model. Not blocking with `OnPush`, but worth noting.

---

### `metadata-panel/metadata-panel.component.html`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: 139 lines — approaching the 150-line inline template limit. Uses `@for` block
syntax throughout. Labels are properly associated via `for`/`id`. `aria-label` on inputs that
already have `<label>` elements is redundant (lines 18, 27) but harmless. Toggle button correctly
uses `role="switch"` and `aria-checked`.

---

### `metadata-panel/mcp-tool-access.component.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: Functionally correct. CSS variable usage is correct throughout. The inline template
and styles are the pattern violation. At 112 lines, this is approaching the 150-line limit with
inline styles that will need to grow. The `toggleTool` method reads `this.store.metadata().mcpTools`
fresh each call — no stale closure risk.

---

### `metadata-panel/knowledge-scope.component.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 1 serious, 1 serious (isActive)

**Analysis**: The triple-call to `isActive(badge.value)` per badge per cycle is the main
maintainability issue. Inline template/styles pattern inconsistency. CSS variables used correctly.
`toggleScope` correctly reads `this.activeScopes()` fresh. At 108 lines it is within bounds but
only because of inline styles.

---

### `metadata-panel/compatibility-list.component.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Correct logic. `font-family: monospace` inline style on line 67 — should be
`var(--font-mono)` or the project's monospace token if one exists. This was not in the original
review scope. Inline template/styles pattern inconsistency applies here too.

---

### `editor-panel/editor-panel.component.ts`

**Score**: 4/10
**Issues Found**: 2 blocking, 0 serious, 0 minor

**Analysis**: Two blocking issues: the `get` accessor pattern for signal-derived visibility state,
and the `marked.parse() as string` fragility. The `requestAnimationFrame + markForCheck` pattern
(lines 92–99) is a valid technique for post-DOM-update signal flushing, but it mixes manual
`ChangeDetectorRef` with an otherwise signal-driven component. The debounce timer is correctly
cleaned up in `ngOnDestroy`. DOMPurify usage is correct.

**Specific Concerns**:
1. Line 45–53: `get isEditorVisible` / `get isPreviewVisible` — should be `computed()`.
2. Line 126: `marked.parse(content) as string` — fragile, relies on undeclared default.

---

### `editor-panel/editor-panel.component.html`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: 121 lines. Uses `@if` block syntax correctly. Toolbar ARIA roles are correct
(`role="toolbar"`, `role="group"`, `role="tablist"`, `role="tab"`). `[innerHTML]="previewHtml"`
binding is safe because `previewHtml` is always the output of `DOMPurify.sanitize()`.
Tab buttons reference `aria-controls="editor-split-view"` which maps to `id="editor-split-view"`
on line 97 — correct.

---

### `editor-panel/markdown-insert.utils.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Pure function, no side effects, exhaustive switch with full TypeScript type safety
on `MarkdownInsertType`. Exported interface `InsertResult` is clean. At 51 lines, within bounds.
The `heading` case (lines 28–34) handles the edge case where `lineEnd === -1` correctly.

---

### `editor-status-bar/editor-status-bar.component.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Minimal, correct. Minor: `onSaveDraft` and `onSaveVersion` are passthroughs;
if the status bar had any local state these wrappers would make sense, but as is they add
a layer over direct store access.

---

### `editor-status-bar/editor-status-bar.component.html`

**Score**: 6/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: `store.selectedAgent()` is called 4 times in the template (lines 26, 31, 47, 49).
Each call re-reads the signal. A `protected readonly selectedAgent = computed(() => this.store.selectedAgent())`
in the class would reduce this to one read. The "Preview Diff from vX" button (lines 28–33) has
no `(click)` handler — it is a non-functional stub with no TODO comment. A new developer will
not know this is intentionally stubbed.

---

## Pattern Compliance

| Pattern                      | Status | Concern                                                                 |
| ---------------------------- | ------ | ----------------------------------------------------------------------- |
| `standalone: true`           | PASS   | All 8 components correctly set                                          |
| `OnPush` change detection    | PASS   | All components use `ChangeDetectionStrategy.OnPush`                     |
| `inject()` for DI            | PASS   | No constructor injection anywhere                                       |
| Signal-based state           | PARTIAL| `get` accessors in `EditorPanelComponent` violate `computed()` standard |
| `@for`/`@if` block syntax    | PASS   | No `*ngFor`/`*ngIf` found                                               |
| CSS variable colors          | FAIL   | Hardcoded `%23595959` hex in `metadata-panel.component.scss:92`         |
| No hardcoded hex in styles   | FAIL   | SVG data URI with hex color — explicit rule violation                   |
| File size limits             | PASS   | All files within bounds; metadata-panel.html at 139 lines is borderline |
| No `any` types               | PASS   | No `any` found in any file                                              |
| No inline `style` attributes | PASS   | No `[style]` bindings; all styling via classes/SCSS                     |

---

## Technical Debt Assessment

**Introduced**:
- The `saveDraft` / `saveVersion` identity — will require a second pass when real persistence lands
- The `get` accessor pattern for visibility — will propagate if developers cargo-cult it
- The inline template/styles pattern in three components — inconsistency grows with each new component

**Mitigated**:
- DOMPurify + marked is the correct security pattern for renderer-side Markdown
- All string union types used for model fields — no `string` sprawl
- `readonly` throughout model layer

**Net Impact**: Slight negative. The pattern violations introduced here are the type that get
copy-pasted into future components. The inline-template three-pack and the `get` accessor pattern
are especially at risk of propagation.

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The hardcoded hex color in the dropdown SVG is an explicit rule violation that
will survive theme changes invisibly. The `get` accessor pattern for signal-derived state is an
architectural inconsistency that will be copy-pasted. Both are low-effort fixes with high
long-term value.

## What Excellence Would Look Like

A 9/10 implementation of this feature would:
1. Use `computed()` for all derived state including `isEditorVisible` / `isPreviewVisible`
2. Replace the SVG data-URI dropdown arrow with a token-system-compatible inline element
3. Use external `.html` / `.scss` files for all components, including the three inline exceptions
4. Rename `AgentEditorStore` to `AgentEditorService` or adopt `signalStore()` to match naming
5. Call `this.mockData.getAgentEditorList()` once and reuse `this.agentList` in the constructor
6. Add `// TODO` comments on the stubbed `saveDraft` / `saveVersion` / "Preview Diff" button
7. Explicitly configure `marked` with `{ async: false }` to make the synchronous contract
   explicit rather than relying on an undeclared default

---

## Review Lessons (New Patterns — Append to `frontend.md`)

- **`get` accessors that read signals are equivalent to method calls in templates** — use
  `computed()` instead. A `get` that calls `signal()` fires on every change detection cycle, not
  on dependency change. Always use `computed()` for signal-derived boolean/string state used in
  templates. (TASK_2026_080)

- **SVG data URI arrow icons bypass the CSS variable system** — `background-image: url("data:image/svg+xml,...stroke='%23hexcolor'")` encodes a literal hex color that cannot reference JS token variables or `var()`. Use a positioned inline SVG element or a CSS `::after` pseudo-element with `border` trick so the color stays in the token system. (TASK_2026_080)

- **`.store.ts` file names imply NgRx Signal Store semantics** — if the pattern is plain `@Injectable` with signals, name the file `.service.ts` and the class `*Service`. Mismatched naming forces developers to hold two mental models. (TASK_2026_080)

- **All components in a feature must use the same template/styles convention** — mixing inline `template:`/`styles:` with external file components within the same feature directory creates tooling inconsistency (no IDE HTML support, no SCSS nesting). Pick one convention per feature and enforce it. (TASK_2026_080)

- **Do not call a service method twice when the result is already stored** — if a `public readonly agentList` is initialized by calling `service.getList()`, the constructor must use `this.agentList`, not call `service.getList()` again. Double-calls create divergence risk when the service becomes stateful or async. (TASK_2026_080)
