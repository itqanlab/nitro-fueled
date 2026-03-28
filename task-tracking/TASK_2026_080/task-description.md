# Requirements Document - TASK_2026_080

## Introduction

The Agent Editor is the primary authoring interface for library items in the N.Gine desktop application. An editor already exists at `apps/renderer/src/app/features/library/editor/` with a functional 2-column layout (metadata panel + CodeMirror markdown editor with split/preview modes), NGRX Signal Store, IPC-based persistence, version history, diff viewer, and canDeactivate guard.

This task enhances the existing editor to match the Agent Editor mockup (`mockups/agent-editor.html`). The mockup specifies a richer metadata panel with additional fields (Display Name, Type dropdown, Used In, MCP Tool Access checkboxes, Knowledge Scope badges, Compatibility list), a markdown toolbar with formatting buttons, a bottom status bar with line/column info and contextual save actions, and visual refinements to the 3-column split view (editor + preview shown side-by-side as default "Split" mode).

The business value is a complete, professional-grade agent authoring experience that gives users full control over agent metadata, markdown content, and versioning in a single cohesive view.

---

## Corrected File Scope

All files live under the existing feature path. No new feature module is needed. The editor route already exists at `/editor/:itemType/:itemId`.

### Existing Files to Modify

| File | Change |
|------|--------|
| `apps/renderer/src/app/features/library/editor/editor.component.ts` | Add bottom action bar with status info, restructure layout for toolbar integration |
| `apps/renderer/src/app/features/library/editor/editor.component.html` | Add bottom status bar (line/col, total lines, unsaved indicator), restructure footer actions |
| `apps/renderer/src/app/features/library/editor/editor.store.ts` | Extend `EditorMetadata` with new fields: `displayName`, `type` (base_template/stack_module), `mcpToolAccess`, `knowledgeScope`, `compatibility`. Add cursor position state (`cursorLine`, `cursorCol`, `totalLines`) |
| `apps/renderer/src/app/features/library/editor/metadata-form.component.ts` | Add new form sections: Display Name, Type dropdown, Used In (read-only), MCP Tool Access checkboxes, Knowledge Scope badges, Compatibility list |
| `apps/renderer/src/app/features/library/editor/metadata-form.component.html` | Extend template with all mockup fields |
| `apps/renderer/src/app/features/library/editor/markdown-editor.component.ts` | Add toolbar button handlers that insert markdown syntax at cursor, emit cursor position updates |
| `apps/renderer/src/app/features/library/editor/markdown-editor.component.html` | Add formatting toolbar (Bold, Italic, Heading, List, Code, Link) above the view-mode toggle |

### New Files

| File | Purpose |
|------|---------|
| `apps/renderer/src/app/features/library/editor/mcp-tool-access.component.ts` | Standalone component: checkbox list for MCP tool access (Filesystem, GitHub, Context7, Figma, Playwright) |
| `apps/renderer/src/app/features/library/editor/knowledge-scope.component.ts` | Standalone component: togglable badge group for knowledge scope (Global, Project, Team) |
| `apps/renderer/src/app/features/library/editor/compatibility-list.component.ts` | Standalone component: key-value list for compatibility entries (e.g., `workflow:feature >= v4`) |

---

## Requirements

### Requirement 1: Extended Metadata Panel

**User Story:** As a library author using the Agent Editor, I want a comprehensive metadata panel with all agent properties (display name, type, MCP tool access, knowledge scope, compatibility), so that I can fully describe an agent's configuration in one place.

#### Acceptance Criteria

1. WHEN the editor loads an existing agent THEN the metadata panel SHALL display all fields populated from the stored `LibraryItem` and its latest `LibraryVersion`: Name, Display Name, Category dropdown, Tags (chip-style input), Type dropdown (Base Template / Stack Module), Used In (read-only project count), MCP Tool Access checkboxes, Knowledge Scope badges, Version Changelog textarea, Breaking Change toggle, and Compatibility list.
2. WHEN the user modifies any metadata field THEN the store's `isDirty` computed signal SHALL reflect the change and the "Unsaved changes" indicator SHALL appear in the bottom status bar.
3. WHEN the user toggles an MCP tool checkbox THEN the `mcpToolAccess` record in the store SHALL update and the checkbox SHALL show a green check (enabled) or grey cross (disabled) matching the mockup styling.
4. WHEN the user clicks a Knowledge Scope badge THEN it SHALL toggle between active (accent color) and inactive (tertiary color) states, and the `knowledgeScope` array in the store SHALL update.
5. WHEN the editor loads a new item (itemId = 'new') THEN MCP Tool Access, Knowledge Scope, Used In, and Compatibility sections SHALL be hidden, matching the existing behavior where Breaking Change and Changelog are hidden for new items.
6. WHEN the Type dropdown value is "Stack Module" THEN the `is_base_template` field on `LibraryItem` SHALL be set to `0`; WHEN "Base Template" THEN `is_base_template` SHALL be set to `1`.

### Requirement 2: Markdown Formatting Toolbar

**User Story:** As a library author using the Agent Editor, I want toolbar buttons (Bold, Italic, Heading, List, Code, Link) that insert markdown syntax at my cursor position, so that I can format content without memorizing markdown syntax.

#### Acceptance Criteria

1. WHEN the user clicks the Bold toolbar button THEN `**bold**` SHALL be inserted at the current cursor position (wrapping selected text if any), and the cursor SHALL be placed inside the markers if no text was selected.
2. WHEN the user clicks the Italic toolbar button THEN `*italic*` SHALL be inserted, following the same selection-wrapping behavior.
3. WHEN the user clicks the Heading toolbar button THEN `## ` SHALL be inserted at the beginning of the current line.
4. WHEN the user clicks the List toolbar button THEN `- ` SHALL be inserted at the beginning of the current line.
5. WHEN the user clicks the Code toolbar button THEN backtick markers SHALL be inserted (inline code for single-line selection, fenced code block for multi-line or no selection).
6. WHEN the user clicks the Link toolbar button THEN `[text](url)` SHALL be inserted, with selected text used as the link text if available.
7. WHEN the toolbar button is clicked THEN focus SHALL return to the CodeMirror editor after insertion.

### Requirement 3: Bottom Status Bar and Action Buttons

**User Story:** As a library author using the Agent Editor, I want a bottom status bar showing my cursor position (line/col), total lines, and contextual save actions, so that I have full awareness of my editing state.

#### Acceptance Criteria

1. WHEN the user moves the cursor in the CodeMirror editor THEN the bottom status bar SHALL update to show the current line number and column number (e.g., "Line 37, Col 1").
2. WHEN content is loaded or changed THEN the status bar SHALL display the total line count (e.g., "42 lines").
3. WHEN the store's `isDirty` signal is true THEN the status bar SHALL display "Unsaved changes" in warning color (CSS `var(--warning)`).
4. WHEN the editor is in non-new mode THEN the "Preview Diff" button SHALL appear in the status bar actions area (left side), reusing the existing `DiffViewerComponent`.
5. WHEN the user clicks "Save Draft" THEN the existing `saveDraft()` store method SHALL be called.
6. WHEN the user clicks "Save as vN" (where N is the next version number) THEN the existing `saveAsNewVersion()` store method SHALL be called after the confirmation dialog.
7. WHEN the editor is in new-item mode THEN the primary button SHALL read "Create v1" instead of "Save as vN".

### Requirement 4: Editor View Mode Refinement

**User Story:** As a library author using the Agent Editor, I want the Split/Editor/Preview tabs positioned in the toolbar area (right side) matching the mockup layout, so that the view controls are visually integrated with the formatting toolbar.

#### Acceptance Criteria

1. WHEN the editor loads THEN the view mode tabs (Split, Editor, Preview) SHALL appear on the right side of the toolbar row, opposite the formatting buttons on the left.
2. WHEN "Split" mode is active THEN both the CodeMirror editor and the rendered preview SHALL be visible side-by-side, with the editor taking roughly equal width as the preview.
3. WHEN "Editor" mode is active THEN only the CodeMirror editor SHALL be visible (full width).
4. WHEN "Preview" mode is active THEN only the rendered markdown preview SHALL be visible (full width).
5. WHEN the active tab changes THEN the tab SHALL use accent background styling (`var(--accent-bg)` with accent-colored border) matching the mockup.

---

## Non-Functional Requirements

### Performance Requirements

- **Cursor position updates**: Status bar line/col SHALL update within 16ms of cursor movement (single animation frame) via CodeMirror's `updateListener` extension.
- **Markdown preview rendering**: Preview SHALL re-render within 300ms of the last keystroke (existing debounce behavior, preserved).
- **Toolbar insertions**: Markdown syntax insertion SHALL complete within 50ms including cursor repositioning.
- **Metadata panel scroll**: The metadata panel SHALL remain independently scrollable with no jank when the content overflows.

### Accessibility Requirements

- All toolbar buttons SHALL have `aria-label` attributes describing their function (e.g., `aria-label="Insert bold text"`).
- The view mode tabs SHALL use `role="tablist"` and `role="tab"` with `aria-selected` state.
- MCP Tool Access checkboxes SHALL use native `<label>` associations with descriptive text.
- Knowledge Scope badges SHALL be keyboard-navigable and have `role="switch"` with `aria-checked`.
- The editor status bar SHALL use `role="status"` with `aria-live="polite"` for screen reader updates.

### Theme Support

- All new UI elements SHALL use existing CSS custom properties from `themes.css` (`--bg-primary`, `--bg-secondary`, `--border`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--accent-bg`, `--success`, `--success-bg`, `--warning`, `--warning-bg`, `--error`).
- No hardcoded color values. Both dark and light themes SHALL render correctly.
- Badge and toggle styling SHALL match the mockup's color tokens exactly.

### Code Quality

- All new components SHALL use `ChangeDetectionStrategy.OnPush` and `standalone: true`, matching existing patterns.
- All new components SHALL inject `EditorStore` directly (no `@Input`/`@Output` boilerplate for store-connected fields), consistent with the existing `MetadataFormComponent` and `MarkdownEditorComponent` patterns.
- Store extensions SHALL maintain the existing `loadGeneration` race-condition guard pattern.

---

## Data Model

### Extended EditorMetadata (store state)

The existing `EditorMetadata` interface in `editor.store.ts` needs extension:

```typescript
// Current (preserved)
export interface EditorMetadata {
  name: string;
  category: string;
  tags: string[];
  description: string;
  isBreakingChange: boolean;
  changelog: string;
}

// Extended (new fields)
export interface EditorMetadata {
  name: string;
  displayName: string;               // NEW — human-readable name
  category: string;
  tags: string[];
  description: string;
  type: 'base_template' | 'stack_module';  // NEW — maps to is_base_template on LibraryItem
  mcpToolAccess: McpToolAccessMap;    // NEW — checkbox state
  knowledgeScope: KnowledgeScope[];   // NEW — active scopes
  isBreakingChange: boolean;
  changelog: string;
  compatibility: CompatibilityEntry[]; // NEW — from version's compatible_with JSON
}

export interface McpToolAccessMap {
  [toolName: string]: boolean;  // e.g., { filesystem: true, github: true, figma: false }
}

export type KnowledgeScope = 'global' | 'project' | 'team';

export interface CompatibilityEntry {
  label: string;   // e.g., "workflow:feature"
  version: string; // e.g., ">= v4"
}
```

### Cursor State (store state)

```typescript
// New state fields on EditorState
cursorLine: number;   // 1-based
cursorCol: number;    // 1-based
totalLines: number;
```

### Existing Types (no changes needed)

- `LibraryItem` from `@ngine/shared/types` -- `is_base_template` already exists (0 | 1).
- `LibraryVersion` from `@ngine/shared/types` -- `compatible_with` (JSON TEXT) already exists for compatibility data.
- IPC channels: `library:get`, `library:create`, `library:update`, `library:version:create`, `library:version:list`, `library:delete`, `library:list`, `library:search` -- all already implemented.

### Data Mapping Notes

- `displayName` is a UI-only field derived from `name` (capitalize + spaces). It is NOT persisted to SQLite. The store computes it on load and the user can edit it freely, but only `name` (slug) is saved.
- `mcpToolAccess` and `knowledgeScope` are persisted as part of the version's `content` (markdown frontmatter or a separate JSON section) OR as extended `tags` JSON. The architect should decide the persistence strategy based on the existing `tags` JSON field or by extending `LibraryVersion.content` with YAML frontmatter.
- `compatibility` is read from `LibraryVersion.compatible_with` (already a JSON TEXT column). It is display-only in this iteration; editing compatibility is out of scope.

---

## Component Breakdown

### 1. EditorComponent (modified)

**File**: `editor.component.ts` + `editor.component.html`

**Responsibility**: Top-level layout orchestrator. Renders header, 3-panel content area (metadata | markdown editor + preview), and bottom status/action bar.

**Changes**:
- Move save/cancel/diff buttons from current footer into the new bottom status bar layout.
- Add cursor position display (`store.cursorLine()`, `store.cursorCol()`, `store.totalLines()`).
- Add "Unsaved changes" indicator bound to `store.isDirty()`.
- Version-aware primary button label: "Save as v{N}" or "Create v1".

### 2. MetadataFormComponent (modified)

**File**: `metadata-form.component.ts` + `metadata-form.component.html`

**Responsibility**: Full metadata editing form. Renders all agent properties in a scrollable panel.

**Changes**:
- Add Display Name input field.
- Add Type dropdown (Base Template / Stack Module) using `nz-select`.
- Add "Used In" read-only display (project count/names — from a future IPC call, or static placeholder for now).
- Integrate `McpToolAccessComponent`, `KnowledgeScopeComponent`, and `CompatibilityListComponent` as child components.
- Update categories list to match mockup: Planning, Coordination, Development, Quality, Specialist (replacing the generic list).

### 3. MarkdownEditorComponent (modified)

**File**: `markdown-editor.component.ts` + `markdown-editor.component.html`

**Responsibility**: CodeMirror editor with formatting toolbar and view mode tabs.

**Changes**:
- Add toolbar row with formatting buttons (Bold, Italic, Heading, separator, List, Code, Link).
- Move view mode radio group into the toolbar row (right-aligned).
- Expose `insertMarkdown(type)` method that dispatches CodeMirror transactions.
- Add cursor position tracking via `EditorView.updateListener` and push `cursorLine`/`cursorCol`/`totalLines` to the store.

### 4. McpToolAccessComponent (new)

**File**: `mcp-tool-access.component.ts`

**Responsibility**: Renders a vertical list of MCP tool checkboxes with enabled/disabled visual states matching the mockup (green check / grey cross). Reads and writes `store.metadata().mcpToolAccess`.

**Default tools**: Filesystem, GitHub, Context7, Figma, Playwright (configurable via input if needed later).

### 5. KnowledgeScopeComponent (new)

**File**: `knowledge-scope.component.ts`

**Responsibility**: Renders togglable badge group for knowledge scopes (Global, Project, Team). Active badges use `--accent-bg` / `--accent`; inactive use `--bg-tertiary` / `--text-tertiary`. Reads and writes `store.metadata().knowledgeScope`.

### 6. CompatibilityListComponent (new)

**File**: `compatibility-list.component.ts`

**Responsibility**: Renders a read-only key-value list of compatibility entries parsed from `LibraryVersion.compatible_with`. Each row shows label (left) and version constraint (right, monospace). Read-only for this iteration.

---

## Acceptance Criteria (Consolidated)

### Layout and Visual

- [ ] 3-column layout renders correctly: metadata panel (~280px, resizable), editor panel (flex), preview panel (flex) in Split mode
- [ ] Metadata panel is independently scrollable with all sections visible
- [ ] Formatting toolbar appears above the editor with buttons on the left, view mode tabs on the right
- [ ] Bottom status bar spans the full editor width with status info on the left and action buttons on the right
- [ ] All colors use CSS custom properties; no hardcoded values; both themes render correctly

### Metadata Panel

- [ ] Name, Display Name, Category, Tags, Type, Used In fields all render and are editable (except Used In which is read-only)
- [ ] MCP Tool Access shows checkbox list with green/grey visual states
- [ ] Knowledge Scope shows togglable badges
- [ ] Breaking Change toggle renders with red styling when active
- [ ] Compatibility list renders key-value pairs from version data
- [ ] Version History timeline renders (existing functionality preserved)

### Markdown Toolbar

- [ ] Bold button inserts `**text**` at cursor (wraps selection if present)
- [ ] Italic button inserts `*text*` at cursor (wraps selection if present)
- [ ] Heading button inserts `## ` at line start
- [ ] List button inserts `- ` at line start
- [ ] Code button inserts inline backticks or fenced code block
- [ ] Link button inserts `[text](url)` pattern
- [ ] Focus returns to editor after each toolbar action

### Status Bar

- [ ] Line and column numbers update in real time as cursor moves
- [ ] Total line count updates when content changes
- [ ] "Unsaved changes" appears in warning color when dirty
- [ ] "Save Draft" and "Save as vN" buttons function correctly (reuse existing store methods)
- [ ] "Preview Diff" button opens existing DiffViewerComponent

### Data Integrity

- [ ] All existing editor functionality (load, save draft, save version, new item, canDeactivate guard, diff viewer) continues to work without regression
- [ ] New metadata fields update `isDirty` correctly
- [ ] Store's `saveAsNewVersion` and `saveDraft` methods handle new metadata fields

---

## Risk Assessment

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| CodeMirror cursor tracking causes performance regression on large documents | Low | Medium | 3 | Use `updateListener` with batched state updates; cursor position is lightweight data |
| New metadata fields break existing save/load cycle | Medium | High | 6 | Map new fields only in the store layer; do not change IPC payloads for fields that lack backend columns (persist via tags JSON or version content) |
| Toolbar markdown insertion has edge cases (nested formatting, selection spanning lines) | Medium | Medium | 4 | Implement simple insertion first; cover edge cases with unit tests; CodeMirror's transaction API handles cursor math reliably |
| Metadata panel overflow with all new sections | Low | Low | 2 | Panel is already scrollable; test with minimum viewport height (768px) |
| Backward compatibility of `EditorMetadata` interface change | Low | High | 4 | Extend interface additively with optional/defaulted fields; `emptyMeta()` factory provides safe defaults |

---

## Stakeholder Analysis

| Stakeholder | Impact | Involvement | Success Criteria |
|-------------|--------|-------------|------------------|
| Library Authors (End Users) | High | Testing / Feedback | Can edit all agent metadata and markdown content in a single view without switching screens |
| Development Team | Medium | Implementation | Clean component decomposition; no regressions in existing editor; store changes are additive |
| Product Owner | High | Requirements Validation | Editor matches mockup layout and field coverage; all mockup sections are represented |
| QA / Review | Medium | Validation | All acceptance criteria pass; accessibility audit shows no violations; both themes render correctly |

---

## Dependencies

- **TASK_2026_077** (completed) -- Shell layout and data layer are already in place.
- **CodeMirror packages** -- `@codemirror/view`, `@codemirror/state` are already installed and used by the existing `MarkdownEditorComponent`.
- **marked + dompurify** -- Already dynamically imported in the existing preview renderer.
- **ng-zorro-antd** -- Already used throughout (`nz-select`, `nz-tag`, `nz-checkbox`, `nz-input`, `nz-form`, `nz-button`, `nz-icon`, `nz-radio`, `nz-timeline`, `nz-tooltip`, `nz-skeleton`).

---

## Out of Scope

- Editing compatibility entries (read-only display only).
- Agent list sidebar within the editor view (the library browser at `/library/agents` already handles agent listing and navigation to `/editor/agents/:id`).
- Persisting `mcpToolAccess` and `knowledgeScope` to new database columns (persist within existing JSON fields or version content).
- Real "Used In" data from project-agent associations (display placeholder or count from existing data).
