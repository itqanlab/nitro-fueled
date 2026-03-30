# Implementation Plan - TASK_2026_083: New Task View

## Codebase Investigation Summary

### Patterns Identified

- **Component structure**: Angular standalone components with `templateUrl` + `styleUrl`, `inject(MockDataService)` for data.
  - Evidence: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:18-24`, `apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts:8-12`
- **Child components**: Use `@Input({ required: true })` for data passing, imported via `imports` array in parent.
  - Evidence: `apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts:10-12`
- **Models**: Separate `*.model.ts` files with `readonly` properties and union type literals.
  - Evidence: `apps/dashboard/src/app/models/mcp.model.ts`, `apps/dashboard/src/app/models/task.model.ts`
- **Mock data**: Constants in `mock-data.constants.ts`, accessor methods in `MockDataService`.
  - Evidence: `apps/dashboard/src/app/services/mock-data.constants.ts`, `apps/dashboard/src/app/services/mock-data.service.ts`
- **Routing**: Lazy-loaded children under `LayoutComponent` in `app.routes.ts`. Currently `new-task` uses `PlaceholderViewComponent`.
  - Evidence: `apps/dashboard/src/app/app.routes.ts:18`

### Integration Points

- **Route**: Replace `PlaceholderViewComponent` at path `'new-task'` with `NewTaskComponent`.
- **MockDataService**: Add methods for strategies, workflow steps, and model override data.

---

## Architecture Design

### Component Hierarchy

```
NewTaskComponent (parent — route component)
├── StrategySelectorComponent (child — strategy grid + auto-detect banner)
└── WorkflowPreviewComponent (child — horizontal pipeline strip)
```

Advanced Options section stays in the parent since it is a toggle + table — not complex enough to warrant a separate component and the task scope lists only these two child components.

### File Manifest

| File | Action |
|------|--------|
| `apps/dashboard/src/app/models/new-task.model.ts` | CREATE |
| `apps/dashboard/src/app/views/new-task/new-task.component.ts` | CREATE |
| `apps/dashboard/src/app/views/new-task/new-task.component.html` | CREATE |
| `apps/dashboard/src/app/views/new-task/new-task.component.scss` | CREATE |
| `apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts` | CREATE |
| `apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.html` | CREATE |
| `apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.scss` | CREATE |
| `apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.ts` | CREATE |
| `apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.html` | CREATE |
| `apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.scss` | CREATE |
| `apps/dashboard/src/app/services/mock-data.constants.ts` | MODIFY |
| `apps/dashboard/src/app/services/mock-data.service.ts` | MODIFY |
| `apps/dashboard/src/app/app.routes.ts` | MODIFY |

---

## Component Specifications

### 1. Model Interfaces (`new-task.model.ts`)

```typescript
export type StrategyType =
  | 'feature' | 'bugfix' | 'refactor' | 'docs'
  | 'research' | 'devops' | 'creative' | 'custom';

export interface Strategy {
  readonly type: StrategyType;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
}

export interface WorkflowStep {
  readonly label: string;
  readonly icon: string;
  readonly isCheckpoint: boolean;
}

export type AgentRoleTag = 'PM' | 'Arch' | 'TL' | 'FE' | 'BE';

export interface AgentModelOverride {
  readonly role: AgentRoleTag;
  readonly roleName: string;
  readonly tagColor: 'blue' | 'purple' | 'orange' | 'green';
  readonly projectDefault: string;
  readonly defaultModelId: string;
}

export interface ModelOption {
  readonly id: string;
  readonly label: string;
}

export interface ModelProviderGroup {
  readonly provider: string;
  readonly models: readonly ModelOption[];
}
```

**Rationale**: Matches the mockup's data structures exactly. Uses `readonly` properties per codebase convention (evidence: `mcp.model.ts`, `task.model.ts`).

---

### 2. NewTaskComponent (parent)

**Purpose**: Route-level component hosting the full "Create New Task" form.

**Pattern**: Same as `DashboardComponent` and `McpIntegrationsComponent` — standalone, `inject(MockDataService)`, imports child components.

**Responsibilities**:
- Render page header with breadcrumb ("e-commerce-api -> New Task") and title "Create New Task"
- Render Section 1: Task Description (title input, description textarea, attachment drop zone)
- Host `<app-strategy-selector>` for Section 2
- Host `<app-workflow-preview>` for Section 3
- Render Section 4: Advanced Options (collapsible toggle, model override table)
- Render form action buttons (Cancel, Save as Draft, Start Task)
- Manage local form state: `title`, `description`, `selectedStrategy`, `modelOverrideEnabled`, per-agent model selections

**State properties**:
```typescript
// Form fields
public title = '';
public description = '';
public selectedStrategy: StrategyType = 'feature';
public modelOverrideEnabled = true; // matches mockup default
public agentModelSelections: Record<AgentRoleTag, string> = { ... };

// Data from MockDataService
public readonly strategies: readonly Strategy[];
public readonly workflowSteps: readonly WorkflowStep[];
public readonly agentOverrides: readonly AgentModelOverride[];
public readonly modelOptions: readonly ModelProviderGroup[];
```

**Template structure** (matches mockup HTML):
- `.page-header` with `.breadcrumb` and `<h1>`
- `.form-container` containing 4 `.form-section` blocks
- Section 1: `.form-group` for title input, description textarea, attachment zone
- Section 2: `<app-strategy-selector>` with `[strategies]`, `[selectedStrategy]`, `[description]`, `(strategyChange)`
- Section 3: `<app-workflow-preview>` with `[steps]`
- Section 4: Toggle row + `.model-override-table` (conditionally shown via `@if`)
- `.form-actions` with Cancel (ghost), Save as Draft, Start Task (primary btn-lg)

**Key methods**:
- `onStrategyChange(type: StrategyType)`: updates `selectedStrategy`
- `toggleModelOverride()`: flips `modelOverrideEnabled`
- `onModelChange(role: AgentRoleTag, modelId: string)`: updates `agentModelSelections`
- `cancel()`, `saveDraft()`, `startTask()`: button handlers (no-op for now, UI-only)

---

### 3. StrategySelectorComponent (child)

**Purpose**: Renders the auto-detect banner and 8 strategy cards in a 4x2 grid.

**Pattern**: Same as `CompatibilityMatrixComponent` — standalone, `@Input` for data, `@Output` for events.

**Inputs/Outputs**:
```typescript
@Input({ required: true }) strategies!: readonly Strategy[];
@Input({ required: true }) selectedStrategy!: StrategyType;
@Input() description: string = '';
@Output() strategyChange = new EventEmitter<StrategyType>();
```

**Template structure**:
- `@if (description)` -> `.strategy-auto-detect` banner with auto-detect text
- `.strategy-grid` (CSS grid 4 columns) containing strategy cards
- Each card: `.strategy-card` with `[class.selected]`, click handler emitting `strategyChange`
- Card contents: `.strategy-card-icon`, `.strategy-card-name`, `.strategy-card-desc`

**Auto-detect logic**: Simple keyword matching in the component. When `description` contains keywords like "implement", "system", "fix", "bug", etc., show the banner with detected strategy type. This is purely cosmetic/mock behavior.

**SCSS**: Strategy grid layout, card hover/selected states per mockup CSS (lines 151-164 of mockup).

---

### 4. WorkflowPreviewComponent (child)

**Purpose**: Renders horizontal pipeline strip with steps and checkpoint markers.

**Pattern**: Same as `CompatibilityMatrixComponent`.

**Inputs**:
```typescript
@Input({ required: true }) steps!: readonly WorkflowStep[];
```

**Template structure**:
- `.workflow-preview` flex container with horizontal scroll
- `@for` over steps, rendering:
  - `.wp-step` with `[class.checkpoint]="step.isCheckpoint"` — shows icon + label
  - `.wp-arrow` between steps (arrow separator, not after last)
- `.form-hint` below with checkpoint explanation text

**SCSS**: Workflow preview styles per mockup CSS (lines 271-282 of mockup).

---

## Mock Data Additions

### `mock-data.constants.ts` — add:

```typescript
export const MOCK_STRATEGIES: readonly Strategy[] = [
  { type: 'feature',  icon: '\u2B50',     name: 'Feature',  description: 'New functionality' },
  { type: 'bugfix',   icon: '\uD83D\uDC1B', name: 'Bugfix',   description: 'Fix an issue' },
  { type: 'refactor', icon: '\uD83D\uDD27', name: 'Refactor', description: 'Improve code' },
  { type: 'docs',     icon: '\uD83D\uDCDA', name: 'Docs',     description: 'Documentation' },
  { type: 'research', icon: '\uD83D\uDD0E', name: 'Research', description: 'Investigation' },
  { type: 'devops',   icon: '\u2699',     name: 'DevOps',   description: 'Infrastructure' },
  { type: 'creative', icon: '\uD83C\uDFA8', name: 'Creative', description: 'Design & content' },
  { type: 'custom',   icon: '\uD83D\uDE80', name: 'Custom',   description: 'Build your own' },
];

export const MOCK_WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { label: 'Scope',        icon: '\u2714', isCheckpoint: true },
  { label: 'PM',           icon: '\uD83E\uDDD1', isCheckpoint: false },
  { label: 'Requirements', icon: '\u2714', isCheckpoint: true },
  { label: 'Architect',    icon: '\uD83C\uDFD7', isCheckpoint: false },
  { label: 'Architecture', icon: '\u2714', isCheckpoint: true },
  { label: 'Team Lead',    icon: '\uD83D\uDC68\u200D\uD83D\uDCBC', isCheckpoint: false },
  { label: 'Dev Loop',     icon: '\uD83D\uDD04', isCheckpoint: false },
  { label: 'QA Choice',    icon: '\u2714', isCheckpoint: true },
  { label: 'QA',           icon: '\uD83E\uDDEA', isCheckpoint: false },
];

export const MOCK_AGENT_OVERRIDES: readonly AgentModelOverride[] = [
  { role: 'PM',   roleName: 'project-manager',    tagColor: 'blue',   projectDefault: 'Claude Sonnet', defaultModelId: 'claude-sonnet-4' },
  { role: 'Arch', roleName: 'architect',           tagColor: 'purple', projectDefault: 'Claude Opus',   defaultModelId: 'claude-opus-4' },
  { role: 'TL',   roleName: 'team-leader',         tagColor: 'orange', projectDefault: 'Claude Opus',   defaultModelId: 'claude-opus-4' },
  { role: 'FE',   roleName: 'frontend-dev',        tagColor: 'green',  projectDefault: 'Claude Sonnet', defaultModelId: 'claude-sonnet-4' },
  { role: 'BE',   roleName: 'backend-dev',          tagColor: 'green',  projectDefault: 'Codex Mini',    defaultModelId: 'codex-mini' },
];

export const MOCK_MODEL_OPTIONS: readonly ModelProviderGroup[] = [
  {
    provider: 'Anthropic',
    models: [
      { id: 'claude-opus-4',   label: 'Claude Opus 4' },
      { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'claude-haiku-4',  label: 'Claude Haiku 4' },
    ],
  },
  {
    provider: 'OpenAI',
    models: [
      { id: 'gpt-4o',     label: 'GPT-4o' },
      { id: 'codex-mini', label: 'Codex Mini' },
    ],
  },
];
```

### `mock-data.service.ts` — add methods:

```typescript
public getStrategies(): readonly Strategy[] { return MOCK_STRATEGIES; }
public getWorkflowSteps(): readonly WorkflowStep[] { return MOCK_WORKFLOW_STEPS; }
public getAgentOverrides(): readonly AgentModelOverride[] { return MOCK_AGENT_OVERRIDES; }
public getModelOptions(): readonly ModelProviderGroup[] { return MOCK_MODEL_OPTIONS; }
```

---

## Route Wiring (`app.routes.ts`)

Replace line 18:
```typescript
// BEFORE
{ path: 'new-task', component: PlaceholderViewComponent, data: { title: 'New Task' } },

// AFTER
{ path: 'new-task', component: NewTaskComponent },
```

Add import:
```typescript
import { NewTaskComponent } from './views/new-task/new-task.component';
```

---

## SCSS Approach

All styles from the mockup (lines 103-365) that are specific to the new-task view will be distributed across the three component SCSS files:

- **new-task.component.scss**: Form layout (`.form-container`, `.form-section`, `.form-group`, `.form-label`, `.form-hint`, `.input`, `.attachment-zone`, `.toggle-row`, `.toggle`, `.model-override-table`, `.form-actions`, `.btn` variants, `.tag` colors, `.select-wrapper`/`.select`)
- **strategy-selector.component.scss**: Strategy grid (`.strategy-grid`, `.strategy-card`, `.strategy-auto-detect`)
- **workflow-preview.component.scss**: Pipeline strip (`.workflow-preview`, `.wp-step`, `.wp-arrow`)

All styles reference CSS custom properties already defined in the global `:root` (confirmed in mockup lines 9-37, matching the dashboard's existing dark theme variables).

---

## Quality Requirements

- All form inputs are display-only with mock pre-filled values matching the mockup
- Strategy card selection is interactive (click to select, blue highlight)
- Advanced Options toggle shows/hides the model override table
- Model select dropdowns use `<optgroup>` for provider grouping
- No backend calls, no form submission — UI-only view
- Cost estimate text is static: "$2.50 - $5.00 for FEATURE workflow"

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer
**Rationale**: Pure Angular UI work — components, templates, SCSS, mock data. No backend involved.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 3-4 hours

### Files Affected Summary

**CREATE**:
- `apps/dashboard/src/app/models/new-task.model.ts`
- `apps/dashboard/src/app/views/new-task/new-task.component.ts`
- `apps/dashboard/src/app/views/new-task/new-task.component.html`
- `apps/dashboard/src/app/views/new-task/new-task.component.scss`
- `apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts`
- `apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.html`
- `apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.scss`
- `apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.ts`
- `apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.html`
- `apps/dashboard/src/app/views/new-task/workflow-preview/workflow-preview.component.scss`

**MODIFY**:
- `apps/dashboard/src/app/services/mock-data.constants.ts`
- `apps/dashboard/src/app/services/mock-data.service.ts`
- `apps/dashboard/src/app/app.routes.ts`

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase (standalone, inject, @Input, templateUrl+styleUrl)
- [x] All imports/classes verified as existing (MockDataService, Component, Input, Output, EventEmitter)
- [x] Quality requirements defined
- [x] Integration points documented (route wiring, mock data service)
- [x] Files affected list complete
- [x] Developer type recommended (nitro-frontend-developer)
- [x] Complexity assessed (MEDIUM, 3-4 hours)
- [x] No step-by-step implementation (that is the team-leader's job)
