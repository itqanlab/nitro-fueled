# Development Tasks - TASK_2026_080

**Total Tasks**: 15 | **Batches**: 4 | **Status**: 1/4 complete (Batch 1 COMPLETE)

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `marked` is pre-installed in node_modules: CONFIRMED (per key facts)
- `apps/dashboard` is the correct target (not `apps/renderer`): CONFIRMED — `apps/renderer` does not exist in this repo
- `/agents` route currently uses `PlaceholderViewComponent`: VERIFIED via `app.routes.ts:16`
- `--success`, `--warning`, `--error` shorthand CSS vars are missing: VERIFIED — `styles.scss` only defines `--status-success` etc.
- `LayoutComponent` applies `padding: 24px` to `.main-content`: VERIFIED via plan evidence
- `MockDataService` and `mock-data.constants.ts` patterns: VERIFIED — models directory exists with existing models

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| task-description.md references non-existent `apps/renderer` | LOW | Ignore task-description for file paths; implementation-plan.md is authoritative |
| `:host { margin: -24px }` layout override may clip box-shadow or scroll edges | LOW | Task 2.1 includes explicit note; test at implementation time |
| `marked` import: v17 uses ESM-only exports — may need `import { marked } from 'marked'` | MED | Task 4.1 includes verification note; use named import pattern |

---

## Batch 1: Foundation COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: None
**Commit**: 62ab86a

### Task 1.1: Add missing CSS variable aliases to styles.scss COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/styles.scss`
**Action**: MODIFY
**Spec Reference**: implementation-plan.md:359-376

**Quality Requirements**:
- Add the following block after the existing `--status-*` definitions (line ~27):
  ```scss
  --success:       #49aa19;
  --success-bg:    #162312;
  --warning:       #d89614;
  --warning-bg:    #2b2111;
  --error:         #d32029;
  --error-bg:      #2a1215;
  --text-tertiary: #595959;
  --border-focus:  #177ddc;
  ```
- `--text-tertiary` must equal `--text-muted` value (`#595959`)
- No hardcoded colors anywhere else — these must be the single source of truth

**Validation Notes**:
- Existing components (task-card, stat-card, dashboard) reference `var(--success)` and will now correctly resolve

---

### Task 1.2: Create agent-editor.model.ts COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/models/agent-editor.model.ts`
**Action**: CREATE
**Spec Reference**: implementation-plan.md:271-308

**Quality Requirements**:
- Export all types: `AgentCategory`, `AgentType`, `KnowledgeScope`, `EditorViewMode`
- Export all interfaces: `McpToolAccess`, `CompatibilityEntry`, `AgentEditorData`, `CursorPosition`
- Use `readonly` on all array and primitive fields in interfaces
- Use typed string unions, not bare `string` (anti-pattern rule)
- No `any` types

**Implementation Details**:
- `AgentCategory`: `'Planning' | 'Coordination' | 'Development' | 'Quality' | 'Specialist'`
- `AgentType`: `'base_template' | 'stack_module'`
- `KnowledgeScope`: `'global' | 'project' | 'team'`
- `EditorViewMode`: `'split' | 'editor' | 'preview'`
- `McpToolAccess`: `{ readonly name: string; readonly enabled: boolean }`
- `CompatibilityEntry`: `{ readonly label: string; readonly version: string }`
- `AgentEditorData`: full interface per plan lines 287-302
- `CursorPosition`: `{ readonly line: number; readonly col: number; readonly totalLines: number }`

---

### Task 1.3: Add MOCK_AGENT_EDITOR_LIST to mock-data.constants.ts COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/mock-data.constants.ts`
**Action**: MODIFY
**Spec Reference**: implementation-plan.md:319-332

**Quality Requirements**:
- Import `AgentEditorData` from `../models/agent-editor.model`
- Export `MOCK_AGENT_EDITOR_LIST: readonly AgentEditorData[]`
- Must include FULL data for the "team-leader" agent with all fields populated per plan lines 323-331
- Must include at least 13 additional stub agents for sidebar list (name + id + minimal required fields)
- The `content` field on team-leader must be a real markdown string (not empty or TODO)
- Tags, mcpTools, knowledgeScope, compatibility arrays must be populated per spec

**Implementation Details**:
- team-leader agent: name "team-leader", displayName "Team Leader", category "Coordination"
- tags: `["universal", "coordination", "git"]`
- type: `"base_template"`, currentVersion: 4
- mcpTools: Filesystem(true), GitHub(true), Context7(true), Figma(false), Playwright(false)
- knowledgeScope: `["global", "project"]`
- changelog: "Added Mode 4: rollback capability..."
- isBreakingChange: true
- compatibility: `[{ label: "workflow:feature", version: ">= v4" }, { label: "skill:orchestration", version: ">= v3" }]`
- content: full markdown body describing the team-leader agent role and modes

---

### Task 1.4: Add getAgentEditorList() and getAgentEditorData() to mock-data.service.ts COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/mock-data.service.ts`
**Action**: MODIFY
**Spec Reference**: implementation-plan.md:334-338

**Quality Requirements**:
- Import `AgentEditorData` from `../models/agent-editor.model`
- Import `MOCK_AGENT_EDITOR_LIST` from `./mock-data.constants`
- Add method: `getAgentEditorList(): readonly AgentEditorData[]`
- Add method: `getAgentEditorData(id: string): AgentEditorData | undefined`
- Return type must be explicit (not inferred) — anti-pattern rule for type safety
- `getAgentEditorData` must return `undefined` for unknown IDs (not throw)

**Implementation Details**:
- Pattern: follow existing `getAgents()` and `getTaskItems()` methods in the same file
- `getAgentEditorList()` returns `MOCK_AGENT_EDITOR_LIST`
- `getAgentEditorData(id)` returns `.find(a => a.id === id)`

---

**Batch 1 Verification**:
- `apps/dashboard/src/styles.scss` contains `--success`, `--success-bg`, `--warning`, `--warning-bg`, `--error`, `--error-bg`, `--text-tertiary`, `--border-focus`
- `apps/dashboard/src/app/models/agent-editor.model.ts` exports all 8 types/interfaces
- `apps/dashboard/src/app/services/mock-data.constants.ts` exports `MOCK_AGENT_EDITOR_LIST` with 14+ agents
- `apps/dashboard/src/app/services/mock-data.service.ts` has both new methods with correct return types
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 2: Shell + Sidebar IN PROGRESS

**Developer**: nitro-frontend-developer
**Tasks**: 3 | **Dependencies**: Batch 1 (model, store, mock data must exist)

### Task 2.1: Create AgentEditorStore signal service IN PROGRESS

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts`
**Action**: CREATE
**Spec Reference**: implementation-plan.md:109-125

**Quality Requirements**:
- `@Injectable({ providedIn: 'root' })` — matches existing MockDataService pattern
- Uses Angular `signal()` and `computed()` (no NgRx, no BehaviorSubject)
- All state fields are signals with explicit types — never `signal(null)` without type annotation
- `isDirty` is a `computed()` that compares current vs original state
- All mutation methods must have explicit return type `void`
- No console.log in final code (anti-pattern rule)

**Implementation Details**:
- Inject: `MockDataService` via `inject(MockDataService)`
- Signals: `selectedAgent = signal<AgentEditorData | null>(null)`, `editorContent = signal<string>('')`, `cursorPosition = signal<CursorPosition>({ line: 1, col: 1, totalLines: 0 })`, `viewMode = signal<EditorViewMode>('split')`
- Metadata signal: `metadata` — holds mutable copy of the selected agent's fields (name, displayName, category, tags, type, mcpTools, knowledgeScope, changelog, isBreakingChange)
- `isDirty = computed(...)` — compares serialized metadata + content vs original
- Methods: `selectAgent(id: string): void`, `updateMetadataField(field, value): void`, `updateContent(content: string): void`, `setCursorPosition(pos: CursorPosition): void`, `setViewMode(mode: EditorViewMode): void`, `saveDraft(): void`, `saveVersion(): void`
- `selectAgent()` loads from MockDataService and initializes all signals
- On init: call `selectAgent(MOCK_AGENT_EDITOR_LIST[0].id)` to preselect the first agent

**Validation Notes**:
- `marked` import is NOT needed in the store — it belongs in EditorPanelComponent only

---

### Task 2.2: Create AgentEditorViewComponent (container + 3-column layout) IN PROGRESS

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.ts`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.html`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-editor-view.component.scss`
**Action**: CREATE (3 files)
**Spec Reference**: implementation-plan.md:68-104, 436-449

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- `inject(AgentEditorStore)` — no constructor injection
- Template uses Angular 19 `@if`/`@for` syntax — never `*ngIf`/`*ngFor`
- Layout: 3 horizontal panels in a row — `AgentListSidebarComponent` (left) | `MetadataPanelComponent` (center-left) | `EditorPanelComponent` (center-right, flex: 1)
- `EditorStatusBarComponent` rendered below the 3-panel row
- `:host` SCSS must apply `display: flex; flex-direction: column; margin: -24px; height: calc(100vh - 48px - 40px); overflow: hidden;` to override LayoutComponent's padding
- No hardcoded pixel colors — use CSS custom properties only

**Implementation Details**:
- Imports array: `[AgentListSidebarComponent, MetadataPanelComponent, EditorPanelComponent, EditorStatusBarComponent]`
- Template: outer div with class `editor-layout` (flex row, flex: 1, overflow: hidden), containing the 3 panel components + status bar below
- `protected readonly store = inject(AgentEditorStore)`

**Validation Notes**:
- `margin: -24px` negates LayoutComponent's `padding: 24px` — this is intentional and correct

---

### Task 2.3: Create AgentListSidebarComponent IN PROGRESS

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.ts`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.html`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.scss`
**Action**: CREATE (3 files)
**Spec Reference**: implementation-plan.md:130-146, mockup lines 238-261

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- `inject(AgentEditorStore)` — no `@Input()` for store data
- Template: section header "Library" + category navigation items (Agents, Skills, Commands, Prompts, Workflows) — static, read-only
- Agent list below: `@for (agent of agents; track agent.id)` — active state determined by `store.selectedAgent()?.id === agent.id`
- Click on agent row calls `store.selectAgent(agent.id)`
- Sidebar width: ~200px, fixed, `overflow-y: auto`
- Active agent row uses `var(--accent-bg)` background and `var(--accent)` text color
- "+ N more..." shown when list exceeds 10 items

**Implementation Details**:
- `agents = computed(() => this.store /* all agents from store */)` — read from `MockDataService` via store
- The store should expose a `getAgentList()` method or the sidebar injects MockDataService directly for the list
- Categories are hardcoded in template (static navigation hints, not interactive routing)

---

**Also update app.routes.ts**: In Task 2.2's batch, ALSO modify:

### Task 2.4: Update app.routes.ts to point /agents to AgentEditorViewComponent IN PROGRESS

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/app.routes.ts`
**Action**: MODIFY
**Spec Reference**: implementation-plan.md:344-353

**Quality Requirements**:
- Replace `{ path: 'agents', component: PlaceholderViewComponent, data: { title: 'Agents' } }` with `{ path: 'agents', component: AgentEditorViewComponent }`
- Add import for `AgentEditorViewComponent` at top of file
- Remove `data: { title: 'Agents' }` — the editor manages its own title
- Do NOT remove PlaceholderViewComponent import if other routes still use it

---

**Batch 2 Verification**:
- `agent-editor.store.ts` exists with all signals and mutation methods
- `agent-editor-view.component.ts/html/scss` exist — view renders without errors
- `agent-list-sidebar.component.ts/html/scss` exist — sidebar renders agent list
- `app.routes.ts` imports and routes to `AgentEditorViewComponent`
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 3: Metadata Panel PENDING

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: Batch 1 (model + store) — can be implemented in parallel with Batch 2 if store is ready

### Task 3.1: Create MetadataPanelComponent PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.ts`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.html`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/metadata-panel/metadata-panel.component.scss`
**Action**: CREATE (3 files)
**Spec Reference**: implementation-plan.md:149-168, mockup lines 267-391

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- Width: 280px fixed, `overflow-y: auto`, independently scrollable
- All field changes call `store.updateMetadataField(field, value)`
- Panel header shows agent name + version badge (`v{currentVersion}`)
- Form fields (in order): Name (text input), Display Name (text input), Category (select), Tags (chip input), Type (select: Base Template / Stack Module), Used In (read-only text)
- Divider separating basic fields from advanced
- Embed: `McpToolAccessComponent`, `KnowledgeScopeComponent`
- Version Changelog (textarea), Breaking Change toggle
- Embed: `CompatibilityListComponent`
- No hardcoded color values — all CSS custom properties

**Implementation Details**:
- Imports array includes: `McpToolAccessComponent`, `KnowledgeScopeComponent`, `CompatibilityListComponent`, and any ng-zorro components used (`NzInputModule`, `NzSelectModule`, `NzTagModule`, etc.)
- `inject(AgentEditorStore)` — all field bindings come from `store.metadata()`
- Breaking Change toggle: red border/text when `store.metadata().isBreakingChange === true`

---

### Task 3.2: Create McpToolAccessComponent PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.ts`
**Action**: CREATE (single-file component)
**Spec Reference**: implementation-plan.md:173-187

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- Inline template (single file — matches mcp-tool-access in mockup, no external template needed)
- `@for (tool of tools; track tool.name)` — renders each MCP tool row
- Enabled row: green checkmark icon using `var(--success)` color
- Disabled row: grey cross icon using `var(--text-tertiary)` color
- Click toggles state via `store.updateMetadataField('mcpTools', ...)`
- Tools list: Filesystem, GitHub, Context7, Figma, Playwright

**Implementation Details**:
- `inject(AgentEditorStore)` — reads `store.metadata().mcpTools`
- Use `nz-icon` for check/close icons, or Unicode characters — consistent with codebase icon usage
- Computed signal: `tools = computed(() => store.metadata().mcpTools)`

---

### Task 3.3: Create KnowledgeScopeComponent PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.ts`
**Action**: CREATE (single-file component)
**Spec Reference**: implementation-plan.md:192-204

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- Inline template (single file)
- 3 badges: Global, Project, Team — horizontal row
- Active badge: `background: var(--accent-bg); color: var(--accent); border-color: var(--accent)`
- Inactive badge: `background: var(--bg-tertiary); color: var(--text-tertiary); border-color: var(--border)`
- Click toggles active/inactive per badge
- `role="switch"`, `aria-checked` on each badge for accessibility

**Implementation Details**:
- `inject(AgentEditorStore)` — reads/writes `store.metadata().knowledgeScope`
- Badge toggle logic: if scope is in array → remove it; if not → add it
- Call `store.updateMetadataField('knowledgeScope', newArray)` on toggle

---

### Task 3.4: Create CompatibilityListComponent PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.ts`
**Action**: CREATE (single-file component)
**Spec Reference**: implementation-plan.md:209-218

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- Inline template (single file)
- Read-only: no edit interactions
- Each row: label on left (normal weight), version on right (monospace font)
- Empty state: no rows rendered (do not show "No compatibility data" text — just hidden)

**Implementation Details**:
- `inject(AgentEditorStore)` — reads `store.selectedAgent()?.compatibility ?? []`
- `@for (entry of compatibility; track entry.label)`
- Monospace style for version: `font-family: monospace; color: var(--text-secondary)`

---

**Batch 3 Verification**:
- All 4 components exist at correct paths
- `metadata-panel.component.ts` imports all 3 sub-components
- Form fields render from store signals (no hardcoded data)
- MCP tool toggle works (enabled/disabled state changes)
- Knowledge scope badge toggle works
- Compatibility list renders entries from store
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 4: Editor Panel + Status Bar PENDING

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batch 1 (store + model)

### Task 4.1: Create EditorPanelComponent PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.html`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.scss`
**Action**: CREATE (3 files)
**Spec Reference**: implementation-plan.md:225-243, 393-428

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- Toolbar row: formatting buttons (Bold, Italic, Heading, List, Code, Link) on LEFT; view mode tabs (Split, Editor, Preview) on RIGHT
- All toolbar buttons must have `aria-label` attributes (accessibility requirement)
- View mode tabs: `role="tablist"`, `role="tab"`, `aria-selected`
- `<textarea>` with monospace font for editor — NOT CodeMirror (this is a mock dashboard)
- Preview div rendered via `marked.parse(content)` + `DOMPurify.sanitize()`
- View mode logic: `split` shows both textarea + preview; `editor` shows textarea only; `preview` shows preview only
- Preview re-render debounced at 300ms after content change
- Cursor position (`selectionStart`) tracked on `input` and `click` events and pushed to store
- Markdown insertion: `insertMarkdown(type)` method reads `selectionStart`/`selectionEnd`, computes new string, updates `store.updateContent()`, refocuses textarea

**Implementation Details**:
- Import `marked` via: `import { marked } from 'marked'` (v17 named export)
- Import `DOMPurify` via: `import DOMPurify from 'dompurify'`
- `inject(AgentEditorStore)` — reads `store.editorContent()`, `store.viewMode()`
- Debounce preview: use `setTimeout`/`clearTimeout` pattern (no RxJS needed)
- `@ViewChild('editorTextarea') editorRef!: ElementRef<HTMLTextAreaElement>` for cursor access
- Toolbar insertion types: `'bold' | 'italic' | 'heading' | 'list' | 'code' | 'link'`
- Active view mode tab styling: `var(--accent-bg)` background, `var(--accent)` border

**Validation Notes**:
- `marked` v17 uses named export: `import { marked } from 'marked'` — NOT `import marked from 'marked'`
- DOMPurify may need `@types/dompurify` — check if already installed in node_modules before adding

---

### Task 4.2: Create EditorStatusBarComponent PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.ts`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.html`
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.scss`
**Action**: CREATE (3 files)
**Spec Reference**: implementation-plan.md:248-262, mockup lines 514-529

**Quality Requirements**:
- `standalone: true`, `ChangeDetectionStrategy.OnPush`
- `role="status"`, `aria-live="polite"` on the status bar container element
- Left side (info): "Line X, Col Y" | "N lines" | "Markdown" | "Unsaved changes" (warning color when dirty)
- Right side (actions): "Preview Diff from vN" button | "Save Draft" button | "Save as vN" primary button
- "Unsaved changes" text uses `color: var(--warning)` — not `--status-warning`
- Primary button ("Save as vN") uses accent styling
- Button clicks call store methods: `store.saveDraft()`, `store.saveVersion()`
- "Preview Diff" button is conditional: only shown when `store.selectedAgent() !== null`

**Implementation Details**:
- `inject(AgentEditorStore)` — reads `store.cursorPosition()`, `store.isDirty()`, `store.selectedAgent()`
- Version label: `store.selectedAgent()?.currentVersion ?? 1` for button label
- Height: 40px fixed, `border-top: 1px solid var(--border)`
- Background: `var(--bg-secondary)`
- Flex layout: space-between for left/right groups

---

**Batch 4 Verification**:
- `editor-panel.component.ts/html/scss` exist with real toolbar, textarea, preview, and view mode logic
- `editor-status-bar.component.ts/html/scss` exist with real cursor display and action buttons
- `marked` import uses named export pattern
- Toolbar buttons have `aria-label` attributes
- View mode switching works correctly (split/editor/preview)
- Preview renders markdown content (not raw text)
- Status bar shows correct cursor position and dirty state
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved
