# Implementation Plan - TASK_2026_082: Model Assignments View

## Codebase Investigation Summary

### Libraries Discovered
- **Angular 19** standalone components with `@Component({ standalone: true })` pattern
- **NG-ZORRO** UI component library (available but MCP view uses custom CSS — follow same approach)
- **MockDataService** (apps/dashboard/src/app/services/mock-data.service.ts) — readonly arrays from constants file
- **CSS custom properties** theme (apps/dashboard/src/styles.scss) — `--bg-*`, `--text-*`, `--accent-*`, `--border-*`, `--status-*`, `--radius`

### Patterns Identified
- **Parent + child component** decomposition (Evidence: `mcp-integrations.component.ts` imports `CompatibilityMatrixComponent` and `IntegrationsTabComponent`)
- **Child components use `@Input({ required: true })`** for data binding (Evidence: `compatibility-matrix.component.ts:11-12`, `integrations-tab.component.ts:12`)
- **Parent injects MockDataService**, children receive data via inputs (Evidence: `mcp-integrations.component.ts:14-19`)
- **Tab switching** via string union type and `activeTab` property (Evidence: `mcp-integrations.component.ts:21`)
- **Model files** per domain in `apps/dashboard/src/app/models/` (Evidence: `mcp.model.ts`, `agent.model.ts`, `provider.model.ts`)
- **Constants file** exports typed arrays (Evidence: `mock-data.constants.ts`)
- **SCSS** scoped per component with `:host { display: block; }` convention (Evidence: `mcp-integrations.component.scss:1-3`)
- **Route registration** in `app.routes.ts` with lazy or direct component import (Evidence: `app.routes.ts:17`)
- **Template syntax**: Angular 17+ `@if`/`@for` control flow, `[ngClass]` bindings (Evidence: `mcp-integrations.component.html`)

### Integration Points
- **Route**: `app.routes.ts:17` — replace `PlaceholderViewComponent` with `ModelAssignmentsComponent` at `/models`
- **MockDataService**: `mock-data.service.ts` — add 4 new getter methods
- **Constants**: `mock-data.constants.ts` — add 4 new const arrays
- **Models**: Create `model-assignment.model.ts` in existing models directory

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy
**Chosen Approach**: Parent container with 3 child components, mirroring the MCP view decomposition.
**Rationale**: The MCP view (`mcp-integrations.component.ts`) established the pattern of a parent that owns data + tabs, delegating rendering to focused child components. This view has similar complexity with a table, sub-agents section, and presets section — each maps cleanly to a child component.
**Evidence**: `mcp-integrations.component.ts` (parent with 2 children), `compatibility-matrix.component.ts` (table child), `integrations-tab.component.ts` (card-list child)

---

### Component Specifications

#### Component 1: ModelAssignmentsComponent (Parent)
**Purpose**: Page container — owns all data, manages scope tabs, orchestrates child components
**Pattern**: Parent container with `inject(MockDataService)` + child delegation via inputs
**Evidence**: Mirrors `McpIntegrationsComponent` at `views/mcp/mcp-integrations.component.ts`

**Responsibilities**:
- Inject MockDataService and expose all data as readonly properties
- Manage active scope tab state (`'global' | 'role' | 'team' | 'project' | 'task'`)
- Render page header, hierarchy info bar, and scope tabs
- Pass data to child components via `@Input`
- Compute derived values (total cost, budget percentage)

**Implementation Pattern**:
```typescript
// Pattern source: mcp-integrations.component.ts
@Component({
  selector: 'app-model-assignments',
  standalone: true,
  imports: [NgClass, AssignmentsTableComponent, SubAgentSectionComponent, QuickPresetsComponent],
  templateUrl: './model-assignments.component.html',
  styleUrl: './model-assignments.component.scss',
})
export class ModelAssignmentsComponent {
  private readonly mockData = inject(MockDataService);

  public readonly assignments = this.mockData.getModelAssignments();
  public readonly subAgents = this.mockData.getSubAgentAssignments();
  public readonly presets = this.mockData.getModelPresets();
  public readonly providerModels = this.mockData.getProviderModels();

  public activeScope: 'global' | 'role' | 'team' | 'project' | 'task' = 'global';

  public readonly scopeTabs = [
    { key: 'global' as const, label: 'Global Defaults', count: null },
    { key: 'role' as const, label: 'Per-Role', count: 5 },
    { key: 'team' as const, label: 'Per-Team', count: 3 },
    { key: 'project' as const, label: 'Per-Project', count: 2 },
    { key: 'task' as const, label: 'Per-Task', count: 1 },
  ];

  public readonly totalCost: number; // computed from assignments
  public readonly budget = this.mockData.getMonthlyBudget();
}
```

**Files Affected**:
- `apps/dashboard/src/app/views/models/model-assignments.component.ts` (CREATE)
- `apps/dashboard/src/app/views/models/model-assignments.component.html` (CREATE)
- `apps/dashboard/src/app/views/models/model-assignments.component.scss` (CREATE)

---

#### Component 2: AssignmentsTableComponent (Child)
**Purpose**: Renders the agent assignment table with model select dropdowns, override badges, fallback chain pills, cost column, and reset buttons. Also renders the table footer with total cost, budget bar, and Save/Reset All buttons.
**Pattern**: `@Input({ required: true })` child component
**Evidence**: Mirrors `CompatibilityMatrixComponent` at `views/mcp/compatibility-matrix/compatibility-matrix.component.ts`

**Responsibilities**:
- Render table header row (Agent Role, Provider Type, Assigned Model, Fallback Chain, Est. Cost/Task, Actions)
- Render agent rows with:
  - Agent icon + name + category badge
  - Provider type badge (API / CLI / OAuth) with color coding
  - Model select dropdown using `<select>` with `<optgroup>` per provider (Anthropic, OpenAI, Google, Local CLI)
  - Override badge (orange "ROLE OVERRIDE" etc.) shown conditionally
  - Fallback chain as pill tags (e.g., "sonnet-4 -> haiku -> local-cli")
  - Estimated cost per task
  - Reset button (disabled when no override)
- Render table footer row: total cost, budget progress bar, Reset All + Save Assignments buttons

**Implementation Pattern**:
```typescript
@Component({
  selector: 'app-assignments-table',
  standalone: true,
  imports: [NgClass],
  templateUrl: './assignments-table.component.html',
  styleUrl: './assignments-table.component.scss',
})
export class AssignmentsTableComponent {
  @Input({ required: true }) assignments!: readonly ModelAssignment[];
  @Input({ required: true }) providerModels!: readonly ProviderModelGroup[];
  @Input({ required: true }) totalCost!: number;
  @Input({ required: true }) budget!: { readonly used: number; readonly total: number };
}
```

**Files Affected**:
- `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts` (CREATE)
- `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.html` (CREATE)
- `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.scss` (CREATE)

---

#### Component 3: SubAgentSectionComponent (Child)
**Purpose**: Collapsible section showing sub-agent model assignments (code-analyzer, test-generator, doc-writer)
**Pattern**: `@Input({ required: true })` child with internal collapse toggle
**Evidence**: Same child-component pattern as `IntegrationsTabComponent`

**Responsibilities**:
- Render collapsible header with expand/collapse chevron and "Sub-Agents" title + count badge
- Render sub-agent rows in same table format as main assignments (reuses same column structure)
- Manage collapsed/expanded state internally

**Implementation Pattern**:
```typescript
@Component({
  selector: 'app-sub-agent-section',
  standalone: true,
  imports: [NgClass],
  templateUrl: './sub-agent-section.component.html',
  styleUrl: './sub-agent-section.component.scss',
})
export class SubAgentSectionComponent {
  @Input({ required: true }) subAgents!: readonly ModelAssignment[];
  @Input({ required: true }) providerModels!: readonly ProviderModelGroup[];

  public collapsed = true;

  public toggle(): void {
    this.collapsed = !this.collapsed;
  }
}
```

**Files Affected**:
- `apps/dashboard/src/app/views/models/sub-agent-section/sub-agent-section.component.ts` (CREATE)
- `apps/dashboard/src/app/views/models/sub-agent-section/sub-agent-section.component.html` (CREATE)
- `apps/dashboard/src/app/views/models/sub-agent-section/sub-agent-section.component.scss` (CREATE)

---

#### Component 4: QuickPresetsComponent (Child)
**Purpose**: Renders the "Quick Presets" card grid with 5 preset cards
**Pattern**: `@Input({ required: true })` child component
**Evidence**: Same pattern as `IntegrationsTabComponent` (card grid rendering)

**Responsibilities**:
- Render section header "Quick Presets" with description
- Render 5 preset cards in a responsive grid, each with:
  - Icon + title
  - Description text
  - Key trait badges (e.g., "Low Cost", "Fast", "High Quality")
  - "Apply" button

**Implementation Pattern**:
```typescript
@Component({
  selector: 'app-quick-presets',
  standalone: true,
  imports: [NgClass],
  templateUrl: './quick-presets.component.html',
  styleUrl: './quick-presets.component.scss',
})
export class QuickPresetsComponent {
  @Input({ required: true }) presets!: readonly ModelPreset[];
}
```

**Files Affected**:
- `apps/dashboard/src/app/views/models/quick-presets/quick-presets.component.ts` (CREATE)
- `apps/dashboard/src/app/views/models/quick-presets/quick-presets.component.html` (CREATE)
- `apps/dashboard/src/app/views/models/quick-presets/quick-presets.component.scss` (CREATE)

---

### Model Interfaces

**File**: `apps/dashboard/src/app/models/model-assignment.model.ts` (CREATE)

```typescript
export type ProviderType = 'API' | 'CLI' | 'OAuth';
export type OverrideScope = 'ROLE OVERRIDE' | 'TEAM OVERRIDE' | 'PROJECT OVERRIDE' | 'TASK OVERRIDE' | null;

export interface ModelAssignment {
  readonly agentName: string;
  readonly agentIcon: string;
  readonly agentCategory: string;          // e.g. "Orchestration", "Development", "Review"
  readonly providerType: ProviderType;
  readonly assignedModel: string;          // model ID, e.g. "claude-opus-4"
  readonly overrideScope: OverrideScope;
  readonly fallbackChain: readonly string[];  // e.g. ["sonnet-4", "haiku", "local-cli"]
  readonly estimatedCostPerTask: number;   // e.g. 2.40
  readonly isSubAgent: boolean;
}

export interface ProviderModelGroup {
  readonly provider: string;               // e.g. "Anthropic", "OpenAI", "Google", "Local"
  readonly models: readonly ProviderModel[];
}

export interface ProviderModel {
  readonly id: string;                     // e.g. "claude-opus-4"
  readonly label: string;                  // e.g. "Claude Opus 4"
  readonly tier: 'premium' | 'standard' | 'economy';
}

export interface ModelPreset {
  readonly name: string;                   // e.g. "CLI-First"
  readonly icon: string;
  readonly description: string;
  readonly traits: readonly string[];      // e.g. ["Low Latency", "Offline"]
  readonly traitType: 'speed' | 'cost' | 'balanced' | 'quality';
}
```

---

### MockDataService Additions

**New methods** (added to `mock-data.service.ts`):
```typescript
public getModelAssignments(): readonly ModelAssignment[] {
  return MOCK_MODEL_ASSIGNMENTS;
}

public getSubAgentAssignments(): readonly ModelAssignment[] {
  return MOCK_SUB_AGENT_ASSIGNMENTS;
}

public getModelPresets(): readonly ModelPreset[] {
  return MOCK_MODEL_PRESETS;
}

public getProviderModels(): readonly ProviderModelGroup[] {
  return MOCK_PROVIDER_MODELS;
}
```

**New constants** (added to `mock-data.constants.ts`):

1. `MOCK_MODEL_ASSIGNMENTS` — 8 agent rows matching the mockup:
   - orchestrator ($2.40, CLI), project-manager ($0.80, API), software-architect ($3.10, CLI, ROLE OVERRIDE), team-leader ($2.80, CLI, ROLE OVERRIDE), backend-developer ($0.60, API, ROLE OVERRIDE), frontend-developer ($2.20, CLI), security-reviewer ($1.50, API, ROLE OVERRIDE), devops-engineer ($1.44, CLI)

2. `MOCK_SUB_AGENT_ASSIGNMENTS` — 3 sub-agent rows:
   - code-analyzer ($0.30, API), test-generator ($0.45, API), doc-writer ($0.20, API)

3. `MOCK_MODEL_PRESETS` — 5 preset cards:
   - CLI-First (speed), Budget Saver (cost), Balanced (balanced), Maximum Quality (quality), Speed Priority (speed)

4. `MOCK_PROVIDER_MODELS` — 4 provider optgroups:
   - Anthropic: [claude-opus-4, claude-sonnet-4, claude-haiku]
   - OpenAI: [gpt-4o, gpt-4o-mini, o3]
   - Google: [gemini-2.5-pro, gemini-2.5-flash]
   - Local: [local-cli, ollama-codellama]

---

### Route Registration

**File**: `apps/dashboard/src/app/app.routes.ts` (MODIFY)

Replace the `/models` route entry:
```typescript
// Before:
{ path: 'models', component: PlaceholderViewComponent, data: { title: 'Models' } },

// After:
{ path: 'models', component: ModelAssignmentsComponent },
```

Add import:
```typescript
import { ModelAssignmentsComponent } from './views/models/model-assignments.component';
```

---

## Files Affected Summary

### CREATE (13 files)
1. `apps/dashboard/src/app/models/model-assignment.model.ts`
2. `apps/dashboard/src/app/views/models/model-assignments.component.ts`
3. `apps/dashboard/src/app/views/models/model-assignments.component.html`
4. `apps/dashboard/src/app/views/models/model-assignments.component.scss`
5. `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts`
6. `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.html`
7. `apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.scss`
8. `apps/dashboard/src/app/views/models/sub-agent-section/sub-agent-section.component.ts`
9. `apps/dashboard/src/app/views/models/sub-agent-section/sub-agent-section.component.html`
10. `apps/dashboard/src/app/views/models/sub-agent-section/sub-agent-section.component.scss`
11. `apps/dashboard/src/app/views/models/quick-presets/quick-presets.component.ts`
12. `apps/dashboard/src/app/views/models/quick-presets/quick-presets.component.html`
13. `apps/dashboard/src/app/views/models/quick-presets/quick-presets.component.scss`

### MODIFY (3 files)
1. `apps/dashboard/src/app/services/mock-data.service.ts` — add 4 getter methods + imports
2. `apps/dashboard/src/app/services/mock-data.constants.ts` — add 4 const arrays + imports
3. `apps/dashboard/src/app/app.routes.ts` — swap PlaceholderViewComponent for ModelAssignmentsComponent at `/models`

---

## Implementation Order / Batching Strategy

### Batch 1: Foundation (no dependencies)
These files have zero dependencies on each other and can be created in parallel:
1. `model-assignment.model.ts` — type definitions
2. `mock-data.constants.ts` — add MOCK_MODEL_ASSIGNMENTS, MOCK_SUB_AGENT_ASSIGNMENTS, MOCK_MODEL_PRESETS, MOCK_PROVIDER_MODELS
3. `mock-data.service.ts` — add 4 getter methods

### Batch 2: Child Components (depend on models only)
These depend only on Batch 1 types and can be created in parallel:
1. `assignments-table/` — all 3 files (ts, html, scss)
2. `sub-agent-section/` — all 3 files (ts, html, scss)
3. `quick-presets/` — all 3 files (ts, html, scss)

### Batch 3: Parent + Route (depends on children)
These depend on Batch 2 components:
1. `model-assignments.component.ts` — parent container importing all 3 children
2. `model-assignments.component.html` — page header, hierarchy bar, tabs, child placement
3. `model-assignments.component.scss` — page-level styles (header, tabs, hierarchy bar)
4. `app.routes.ts` — swap route to use ModelAssignmentsComponent

### Batch 4: Visual Polish
1. Verify all component rendering at `/models` route
2. Ensure dark theme compliance (all colors use CSS custom properties from `styles.scss`)
3. Responsive table behavior (horizontal scroll on small viewports)
4. Consistent spacing with MCP view page header / tab patterns

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements
- **Theme compliance**: All colors must use CSS custom properties (`--bg-*`, `--text-*`, `--accent-*`, `--border-*`, `--status-*`)
- **Accessibility**: ARIA labels on tab buttons (`role="tablist"`, `role="tab"`, `aria-selected`), ARIA labels on action buttons, proper `<label>` for selects
- **Responsiveness**: Table should scroll horizontally on narrow viewports; preset cards should wrap from grid to stack
- **Pattern compliance**: Follow exact component decorator style from MCP view (standalone, `styleUrl` singular, `templateUrl`, `imports` array)
- **Readonly data**: All mock data arrays typed as `readonly T[]`, all interface properties marked `readonly`

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer
**Rationale**: This is entirely Angular UI work — standalone components, templates, SCSS styling, and mock data. No backend, no APIs, no server-side logic.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 3-4 hours
**Rationale**: 4 components (1 parent + 3 children), 1 model file, 2 service file modifications, 1 route modification. The MCP view (similar complexity) serves as a close template. The assignments table with select dropdowns and override badges is the most complex piece.

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase (MCP view parent/child, MockDataService, constants, models)
- [x] All imports/classes verified as existing (NgClass, MockDataService, Component, Input, inject)
- [x] Quality requirements defined (theme, a11y, responsiveness, pattern compliance)
- [x] Integration points documented (route, MockDataService, constants)
- [x] Files affected list complete (13 CREATE + 3 MODIFY)
- [x] Developer type recommended (nitro-frontend-developer)
- [x] Complexity assessed (MEDIUM, 3-4 hours)
- [x] No step-by-step implementation details (team-leader decomposes into atomic tasks)
