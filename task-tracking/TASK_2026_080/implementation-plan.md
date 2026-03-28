# Implementation Plan - TASK_2026_080: Agent Editor View

## Codebase Investigation Summary

### Libraries Discovered

- **Angular 19.2** (`@angular/core`, `@angular/router`): Standalone components, `@for`/`@if` control flow, `inject()` DI
  - Evidence: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:1-5`, all components use `standalone: true`
- **ng-zorro-antd 19.3** (`ng-zorro-antd`): UI component library, already provisioned with icons, i18n, and dark theme config
  - Evidence: `apps/dashboard/src/app/app.config.ts:4-13`
- **No CodeMirror or Marked installed**: `package.json` has no `@codemirror/*` or `marked` dependencies. The editor must use a plain `<textarea>` with simulated syntax highlighting, or we install `marked` for preview rendering.

### Patterns Identified

- **Component pattern**: Standalone components with inline or external templates, `inject()` for DI, `@Input()` decorators
  - Evidence: `stat-card.component.ts:1-50`, `dashboard.component.ts:18-25`
- **Data pattern**: `MockDataService` (root-provided) returning readonly arrays from `mock-data.constants.ts`
  - Evidence: `mock-data.service.ts:20-65`, `mock-data.constants.ts:1-215`
- **Routing pattern**: Flat child routes under `LayoutComponent` shell, `PlaceholderViewComponent` for unbuilt views
  - Evidence: `app.routes.ts:6-22`
- **Layout pattern**: `LayoutComponent` wraps header + sidebar + `<main class="main-content">` with 24px padding + `<status-bar>`
  - Evidence: `layout.component.ts:11-43`
- **CSS pattern**: CSS custom properties from `styles.scss`, component-scoped SCSS. Dark theme only.
  - Evidence: `styles.scss:1-47`, `dashboard.component.scss:1-347`
- **Template syntax**: Angular 19 `@for`/`@if` blocks, no `*ngFor`/`*ngIf`
  - Evidence: `dashboard.component.html:9`, `dashboard.component.html:73`

### Critical Finding: CSS Variable Mismatch

Global `styles.scss` defines `--status-success`, `--status-warning`, `--status-error` but components reference `--success`, `--warning`, `--error`, `--success-bg`, `--warning-bg`, `--error-bg`. These shorthand aliases are **not defined anywhere** in the codebase -- likely a pre-existing issue where the browser resolves them to empty. The mockup HTML defines the shorthand versions (`--success: #49aa19`, etc.). This plan includes adding the missing shorthand CSS variables.

**Evidence**: `styles.scss:25-27` defines `--status-success` etc. Grep for `--success:` (with colon) returns zero hits. Components use `var(--success)` extensively (task-card, stat-card, dashboard).

### Layout Constraint: Main Content Padding

`LayoutComponent` applies `padding: 24px` to `.main-content`. The agent editor is a full-bleed 3-column layout with zero padding. The editor view component must override this via `:host` styles or the layout must detect the route. Simplest approach: use `:host { display: block; margin: -24px; }` on the editor view, or better, the editor view opts out of the main-content padding by using a CSS class on the host element.

**Evidence**: `layout.component.ts:38` (`.main-content { padding: 24px; }`)

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Feature view with child components, signal-based state, plain textarea editor (no CodeMirror), `marked` for preview rendering.

**Rationale**: This is a mock dashboard -- no real backend, no real file editing. A plain textarea with monospace styling matches the mockup's visual appearance without adding CodeMirror complexity. `marked` is lightweight and renders the preview panel. The signal-based store pattern keeps state reactive without NgRx overhead, matching the dashboard's existing simple injection pattern.

**Key Decision**: Since the task description mentions CodeMirror but CodeMirror is not installed and this is a **dashboard mock-up** (not a real editor), we use a styled `<textarea>` for the code editor side and `marked` + `DOMPurify` for the preview panel. If the user wants real CodeMirror, that becomes a separate dependency installation task.

### Component Architecture

```
AgentEditorViewComponent (route: /agents)
  +-- AgentListSidebarComponent (left sidebar: agent list)
  +-- MetadataPanelComponent (left column: form fields)
  |     +-- McpToolAccessComponent (embedded: checkbox rows)
  |     +-- KnowledgeScopeComponent (embedded: badge toggles)
  |     +-- CompatibilityListComponent (embedded: read-only list)
  +-- EditorPanelComponent (center+right: toolbar, textarea, preview)
  |     +-- MarkdownToolbarComponent (embedded: formatting buttons + view tabs)
  +-- EditorStatusBarComponent (bottom bar: line/col, actions)
```

### Component Specifications

#### Component 1: AgentEditorViewComponent (Container)

**Purpose**: Top-level layout orchestrator for the `/agents` route. Manages the 3-column layout and wires child components to the shared signal store.

**Pattern**: Container component with signal-based state (verified from dashboard's simple inject pattern)
**Evidence**: `dashboard.component.ts:18-64` (inject MockDataService, compute derived state)

**Responsibilities**:
- Initialize `AgentEditorStore` (signal-based service)
- Render the 3-panel layout: agent list sidebar | metadata panel | editor+preview
- Override parent `.main-content` padding for full-bleed layout
- Host the bottom status bar

**Implementation Pattern**:
```typescript
// Pattern source: dashboard.component.ts
@Component({
  selector: 'app-agent-editor-view',
  standalone: true,
  imports: [
    AgentListSidebarComponent,
    MetadataPanelComponent,
    EditorPanelComponent,
    EditorStatusBarComponent,
  ],
  templateUrl: './agent-editor-view.component.html',
  styleUrl: './agent-editor-view.component.scss',
})
export class AgentEditorViewComponent {
  protected readonly store = inject(AgentEditorStore);
}
```

**Files**:
- `apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.ts` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.html` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.scss` (CREATE)

---

#### Component 2: AgentEditorStore (Signal-based Service)

**Purpose**: Centralized state management for the editor. Holds the selected agent, all metadata fields, editor content, cursor state, dirty tracking, and view mode.

**Pattern**: Injectable service with Angular signals (no NgRx -- matches codebase simplicity)
**Evidence**: `mock-data.service.ts` uses plain Injectable; dashboard components use simple inject() -- no stores

**Responsibilities**:
- Hold `selectedAgent` signal (the agent being edited)
- Hold `metadata` signal (all form fields: name, displayName, category, tags, type, mcpToolAccess, knowledgeScope, changelog, isBreakingChange)
- Hold `editorContent` signal (markdown string)
- Hold `cursorPosition` signal (`{ line, col, totalLines }`)
- Hold `viewMode` signal (`'split' | 'editor' | 'preview'`)
- Compute `isDirty` from comparison of current vs original state
- Provide mutation methods: `selectAgent()`, `updateMetadataField()`, `updateContent()`, `setCursorPosition()`, `setViewMode()`, `saveDraft()`, `saveVersion()`

**Files**:
- `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts` (CREATE)

---

#### Component 3: AgentListSidebarComponent

**Purpose**: Left sidebar showing the list of agents (matching mockup's secondary sidebar inside the editor area). Shows a "Library" category header, individual agent names, active state, and count.

**Pattern**: Standalone component reading from store signal
**Evidence**: Mockup HTML lines 238-261 (sidebar with Library section + agent list)

**Responsibilities**:
- Display library item categories (Agents, Skills, Commands, Prompts, Workflows) -- read-only navigation hints
- Display agent list with active state highlighting
- Emit agent selection to store
- Show "+ N more..." truncation when list is long

**Files**:
- `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.ts` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.html` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.scss` (CREATE)

---

#### Component 4: MetadataPanelComponent

**Purpose**: Right-side metadata form panel with all agent configuration fields. Scrollable, 280px wide.

**Pattern**: Standalone form component with child components for complex fields
**Evidence**: Mockup HTML lines 267-391 (metadata panel structure)

**Responsibilities**:
- Render header with agent name and version badge
- Render form fields: Name (input), Display Name (input), Category (select), Tags (chip input), Type (select)
- Render read-only "Used In" text
- Render divider, then embed McpToolAccessComponent, KnowledgeScopeComponent
- Render Version Changelog (textarea), Breaking Change toggle
- Render CompatibilityListComponent
- All field changes -> store mutation

**Files**:
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.ts` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.html` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.scss` (CREATE)

---

#### Component 5: McpToolAccessComponent

**Purpose**: Vertical list of MCP tool toggles with green checkmark (enabled) / grey cross (disabled) visual states.

**Pattern**: Standalone component, reads/writes through store signal
**Evidence**: Mockup HTML lines 332-354

**Responsibilities**:
- Render list of MCP tools: Filesystem, GitHub, Context7, Figma, Playwright
- Each row: tool name on left, status icon on right
- Click toggles enabled/disabled state
- Visual: enabled = `--success` colored checkmark, disabled = `--text-tertiary` colored cross

**Files**:
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.ts` (CREATE)

---

#### Component 6: KnowledgeScopeComponent

**Purpose**: Horizontal badge group for toggling knowledge scopes (Global, Project, Team).

**Pattern**: Standalone inline component
**Evidence**: Mockup HTML lines 357-362

**Responsibilities**:
- Render 3 badges: Global, Project, Team
- Active badge: `background: var(--accent-bg); color: var(--accent);`
- Inactive badge: `background: var(--bg-tertiary); color: var(--text-tertiary);`
- Click toggles active/inactive
- Syncs to store's `knowledgeScope` array

**Files**:
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.ts` (CREATE)

---

#### Component 7: CompatibilityListComponent

**Purpose**: Read-only key-value list showing compatibility entries.

**Pattern**: Standalone presentational component with `@Input()`
**Evidence**: Mockup HTML lines 380-390

**Responsibilities**:
- Render rows with label (left) and version constraint (right, monospace)
- Read-only display

**Files**:
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.ts` (CREATE)

---

#### Component 8: EditorPanelComponent

**Purpose**: Center panel containing the toolbar, code editor textarea, and markdown preview side-by-side.

**Pattern**: Standalone component wrapping textarea + preview div
**Evidence**: Mockup HTML lines 395-456 (editor panel with toolbar, split view)

**Responsibilities**:
- Render toolbar row with formatting buttons (left) and view mode tabs (right)
- Render split view: textarea (left, monospace) + preview (right, rendered HTML)
- View modes: Split (both visible), Editor (textarea only), Preview (rendered only)
- Toolbar button clicks insert markdown syntax into textarea at cursor position
- Track textarea cursor position and push to store
- Render markdown preview using `marked` library (install required)

**Files**:
- `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.html` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.scss` (CREATE)

---

#### Component 9: EditorStatusBarComponent

**Purpose**: Bottom action bar showing cursor position, line count, dirty state, and save buttons.

**Pattern**: Standalone component reading store signals
**Evidence**: Mockup HTML lines 514-529

**Responsibilities**:
- Left side: "Line X, Col Y" | "N lines" | "Markdown" | "Unsaved changes" (warning color when dirty)
- Right side: "Preview Diff from vN" button, "Save Draft" button, "Save as vN" primary button
- Button clicks call store methods (mock implementations for now)

**Files**:
- `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.ts` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.html` (CREATE)
- `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.scss` (CREATE)

---

### Data Model Extensions

#### New Types (CREATE: `apps/dashboard/src/app/models/agent-editor.model.ts`)

```typescript
export type AgentCategory = 'Planning' | 'Coordination' | 'Development' | 'Quality' | 'Specialist';
export type AgentType = 'base_template' | 'stack_module';
export type KnowledgeScope = 'global' | 'project' | 'team';
export type EditorViewMode = 'split' | 'editor' | 'preview';

export interface McpToolAccess {
  readonly name: string;
  readonly enabled: boolean;
}

export interface CompatibilityEntry {
  readonly label: string;
  readonly version: string;
}

export interface AgentEditorData {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly category: AgentCategory;
  readonly tags: readonly string[];
  readonly type: AgentType;
  readonly usedIn: readonly string[];   // project names
  readonly mcpTools: readonly McpToolAccess[];
  readonly knowledgeScope: readonly KnowledgeScope[];
  readonly currentVersion: number;
  readonly changelog: string;
  readonly isBreakingChange: boolean;
  readonly compatibility: readonly CompatibilityEntry[];
  readonly content: string;             // markdown body
}

export interface CursorPosition {
  readonly line: number;
  readonly col: number;
  readonly totalLines: number;
}
```

#### Extended Agent Model

The existing `Agent` model (`agent.model.ts`) is too simple for the editor. Rather than modify it (it's used by the dashboard), we create the richer `AgentEditorData` model above. The `MockDataService` will provide agent editor data separately.

---

### Mock Data Additions

**File**: `apps/dashboard/src/app/services/mock-data.constants.ts` (MODIFY)

Add `MOCK_AGENT_EDITOR_LIST` -- an array of `AgentEditorData` objects with full metadata matching the mockup. At minimum, provide data for the "team-leader" agent (the one shown in the mockup) plus 13 other agent stubs for the sidebar list.

The "team-leader" agent data:
- name: "team-leader", displayName: "Team Leader"
- category: "Coordination", tags: ["universal", "coordination", "git"]
- type: "base_template", usedIn: ["e-commerce-api", "my-react-app", "go-service"]
- mcpTools: Filesystem(true), GitHub(true), Context7(true), Figma(false), Playwright(false)
- knowledgeScope: ["global", "project"]
- currentVersion: 4, changelog: "Added Mode 4: rollback capability..."
- isBreakingChange: true
- compatibility: [{ label: "workflow:feature", version: ">= v4" }, { label: "skill:orchestration", version: ">= v3" }]
- content: (the full markdown from the mockup)

**File**: `apps/dashboard/src/app/services/mock-data.service.ts` (MODIFY)

Add methods:
- `getAgentEditorList(): readonly AgentEditorData[]`
- `getAgentEditorData(id: string): AgentEditorData | undefined`

---

### Routing Changes

**File**: `apps/dashboard/src/app/app.routes.ts` (MODIFY)

Replace the placeholder agents route with the new editor view:

```typescript
// Before
{ path: 'agents', component: PlaceholderViewComponent, data: { title: 'Agents' } },

// After
{ path: 'agents', component: AgentEditorViewComponent },
```

---

### Global Style Fixes

**File**: `apps/dashboard/src/styles.scss` (MODIFY)

Add missing CSS custom property aliases that the mockup and existing components both reference:

```scss
// Add after existing --status-* definitions:
--success:    #49aa19;
--success-bg: #162312;
--warning:    #d89614;
--warning-bg: #2b2111;
--error:      #d32029;
--error-bg:   #2a1215;
--text-tertiary: #595959;
--border-focus: #177ddc;
```

Note: `--text-muted` (defined in styles.scss) and `--text-tertiary` (used by components) are the same value `#595959`. Add `--text-tertiary` as an alias.

---

### Dependencies to Install

**`marked`**: Lightweight markdown parser for the preview panel. Install via `npm install marked`.

**No CodeMirror**: Not needed for this mock. A styled `<textarea>` is sufficient.

---

## Integration Architecture

### Data Flow

```
MockDataService
  -> AgentEditorStore (signal service, injected at AgentEditorViewComponent level)
    -> AgentListSidebarComponent (reads agent list, emits selection)
    -> MetadataPanelComponent (reads/writes metadata signals)
    -> EditorPanelComponent (reads/writes content + cursor signals)
    -> EditorStatusBarComponent (reads cursor + dirty, triggers save)
```

### View Mode Flow

```
MarkdownToolbar [Split|Editor|Preview] click
  -> store.setViewMode()
  -> EditorPanelComponent reacts:
    'split':   show textarea (flex:1) + preview (flex:1)
    'editor':  show textarea (flex:1) only
    'preview': show preview (flex:1) only
```

### Markdown Preview Flow

```
store.editorContent() changes (signal)
  -> EditorPanelComponent effect/computed
  -> marked.parse(content) -> sanitize -> render into preview div
  -> Debounce via effect with 300ms delay
```

### Toolbar Insertion Flow

```
User clicks toolbar button (Bold/Italic/Heading/List/Code/Link)
  -> EditorPanelComponent.insertMarkdown(type)
  -> Read textarea selectionStart/selectionEnd
  -> Compute new content with inserted syntax
  -> Update store.editorContent()
  -> Re-focus textarea, set new cursor position
```

---

## Layout Override Strategy

The `LayoutComponent` applies `padding: 24px` to `.main-content`. The agent editor needs full-bleed layout. Solution:

The `AgentEditorViewComponent` uses `:host` to negate the parent padding:

```scss
:host {
  display: flex;
  flex-direction: column;
  margin: -24px;
  height: calc(100vh - 48px - 40px); // minus header and status bar
  overflow: hidden;
}
```

This is the simplest approach that doesn't require modifying `LayoutComponent`.

**Evidence**: `layout.component.ts:38` -- `.main-content { flex: 1; overflow-y: auto; padding: 24px; }`

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements
- **Performance**: Cursor position updates within one animation frame (textarea selectionchange listener). Preview re-render debounced at 300ms.
- **Accessibility**: Toolbar buttons with `aria-label`. View mode tabs with `role="tablist"` / `role="tab"` / `aria-selected`. Knowledge scope badges with `role="switch"` / `aria-checked`. Status bar with `role="status"` / `aria-live="polite"`.
- **Theming**: All colors use CSS custom properties. No hardcoded color values.
- **Code Quality**: All components `standalone: true`, `ChangeDetectionStrategy.OnPush` where applicable. Angular 19 `@for`/`@if` syntax. `inject()` DI pattern.

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer
**Rationale**: This is 100% Angular frontend work -- components, templates, styles, signal-based state. No backend/API work.

### Complexity Assessment
**Complexity**: MEDIUM-HIGH
**Estimated Effort**: 4-6 hours

### Implementation Order (Suggested Batches)

**Batch 1: Foundation** (must be first)
1. Add missing CSS variables to `styles.scss`
2. Create `agent-editor.model.ts` with all interfaces/types
3. Create `AgentEditorStore` signal service with all state and mutations
4. Add mock data constants (`MOCK_AGENT_EDITOR_LIST`) and service methods
5. Install `marked` dependency

**Batch 2: Shell Layout** (depends on Batch 1)
1. Create `AgentEditorViewComponent` (container with 3-column layout)
2. Update `app.routes.ts` to point `/agents` to the new component
3. Create `AgentListSidebarComponent` (agent list sidebar)

**Batch 3: Metadata Panel** (depends on Batch 1)
1. Create `MetadataPanelComponent` (form fields)
2. Create `McpToolAccessComponent` (toggle rows)
3. Create `KnowledgeScopeComponent` (badge toggles)
4. Create `CompatibilityListComponent` (read-only list)

**Batch 4: Editor + Status Bar** (depends on Batch 1)
1. Create `EditorPanelComponent` (textarea + preview + toolbar + view modes)
2. Create `EditorStatusBarComponent` (bottom bar with cursor info + actions)
3. Wire markdown preview rendering with `marked`
4. Implement toolbar insertion logic

**Batch 5: Polish** (depends on Batch 2-4)
1. Verify full layout matches mockup at various viewport sizes
2. Verify all interactive behaviors (toggle, badge, toolbar, view modes)
3. Accessibility pass (aria attributes, keyboard navigation)
4. Verify dirty state tracking and "Unsaved changes" indicator

### Files Affected Summary

**CREATE** (17 files):
- `apps/dashboard/src/app/models/agent-editor.model.ts`
- `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts`
- `apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.ts`
- `apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.html`
- `apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.scss`
- `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.ts`
- `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.html`
- `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.scss`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.ts`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.html`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.scss`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.ts`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.ts`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.ts`
- `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts`
- `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.html`
- `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.scss`
- `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.ts`
- `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.html`
- `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.scss`

**MODIFY** (4 files):
- `apps/dashboard/src/styles.scss` (add missing CSS variables)
- `apps/dashboard/src/app/app.routes.ts` (replace placeholder with editor view)
- `apps/dashboard/src/app/services/mock-data.constants.ts` (add agent editor data)
- `apps/dashboard/src/app/services/mock-data.service.ts` (add editor data methods)

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase (standalone, inject, @for/@if, CSS vars)
- [x] All imports/classes verified as existing (Angular, ng-zorro, MockDataService)
- [x] Quality requirements defined (perf, a11y, theming, code quality)
- [x] Integration points documented (data flow, view mode flow, toolbar flow)
- [x] Files affected list complete (17 CREATE, 4 MODIFY)
- [x] Developer type recommended (nitro-frontend-developer)
- [x] Complexity assessed (MEDIUM-HIGH, 4-6 hours)
- [x] No step-by-step implementation (batched for team-leader decomposition)
- [x] CSS variable mismatch identified and fix planned
- [x] Layout padding override strategy documented
- [x] Dependency installation noted (marked)
