# Implementation Plan - TASK_2026_161

## Codebase Investigation Summary

### Libraries Discovered
- **Angular 19+**: Standalone components, signals, OnPush change detection
  - Key exports: `@angular/core` (Component, Input, Output, EventEmitter, signal, computed, ChangeDetectionStrategy)
  - Key exports: `@angular/common` (NgClass)
  - Documentation: No CLAUDE.md for Angular (standard framework)
  - Usage examples: apps/dashboard/src/app/shared/badge/badge.component.ts:1

- **CSS Variables Theme System**: Centralized theming via CSS custom properties
  - Key exports: apps/dashboard/src/styles.scss:1-54
  - Usage examples: apps/dashboard/src/app/shared/badge/badge.component.ts:34-57
  - Theme colors: success, warning, error, accent, running, completed, paused, failed

### Patterns Identified
- **Shared Component Pattern**:
  - Evidence: apps/dashboard/src/app/shared/badge/badge.component.ts:1-64
  - Pattern: Standalone components with inline template/styles, NgClass for conditional styling, type definitions at top
  - Components: badge, status-indicator, empty-state (from TASK_2026_160)
  - Conventions: 2-space indentation, camelCase naming, OnPush change detection

- **Progress Bar Pattern**:
  - Evidence: apps/dashboard/src/app/shared/task-card/task-card.component.ts:60-69
  - Pattern: Div with percentage width binding, status-based color classes
  - Usage: Task progress display with label

- **Tab Navigation Pattern**:
  - Evidence: apps/dashboard/src/app/views/settings/settings.component.html:7-17
  - Pattern: Horizontal button list with active state styling, icon + label layout
  - Usage: Settings view (4 tabs), MCP integrations (2 tabs)

- **Loading Spinner Pattern**:
  - Evidence: apps/dashboard/src/app/views/new-task/new-task.component.html:170
  - Pattern: Inline span with spinner class, no external styles defined
  - Usage: Button loading state

### Integration Points
- **TaskCardComponent**: apps/dashboard/src/app/shared/task-card/task-card.component.ts (60-69)
  - Location: task-progress inline implementation
  - Interface: Existing progress bar div with width + status styling
  - Usage: Replace with ProgressBarComponent

- **SettingsComponent**: apps/dashboard/src/app/views/settings/settings.component.html (7-17)
  - Location: settings-tabs inline implementation
  - Interface: Tab array with id, icon, label; activeTab signal
  - Usage: Replace with TabNavComponent

- **McpIntegrationsComponent**: apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts (23, 34-36)
  - Location: Tab switching logic (activeTab property, switchTab method)
  - Interface: 2 tabs (servers | integrations)
  - Usage: Replace with TabNavComponent (with counts optional)

## Architecture Design (Codebase-Aligned)

### Design Philosophy
**Chosen Approach**: Standalone Angular components with inline template/styles and signal-based inputs
**Rationale**: Matches patterns established in TASK_2026_160 (badge, status-indicator, empty-state) and existing task-card component
**Evidence**:
- apps/dashboard/src/app/shared/badge/badge.component.ts:7-12 (standalone + OnPush)
- apps/dashboard/src/app/shared/task-card/task-card.component.ts:60-69 (inline template styles)
- apps/dashboard/src/app/views/settings/settings.component.ts:21 (signal for activeTab)

### Component Specifications

#### Component 1: ProgressBarComponent
**Purpose**: Display horizontal progress bar with percentage fill and variant coloring
**Pattern**: Standalone component with NgClass conditional styling (verified from badge.component.ts:12)
**Evidence**:
- Similar: apps/dashboard/src/app/shared/task-card/task-card.component.ts:60-69 (inline progress bar)
- Theme vars: apps/dashboard/src/styles.scss:37-42 (--success, --warning, --error, --running, --completed, --paused, --failed)

**Responsibilities**:
- Render horizontal bar with fill width bound to percentage (0-100)
- Apply variant-based color theming
- Display optional label text
- Support showLabel boolean to show/hide label

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/shared/badge/badge.component.ts:1-64
// Verified imports from: @angular/core:Component, Input, Output, EventEmitter, signal
// Pattern source: apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts:12
// Verified imports from: @angular/common:NgClass
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

type ProgressVariant = 'accent' | 'success' | 'warning' | 'error';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="progress-bar">
      <div class="progress-fill" [ngClass]="variant" [style.width.%]="value"></div>
      @if (showLabel) {
        <div class="progress-label">
          @if (label) { {{ label }} } else { {{ value }}% }
        </div>
      }
    </div>
  `,
  styles: [`
    .progress-bar { display: flex; align-items: center; gap: 8px; }
    .progress-fill { height: 6px; border-radius: 3px; transition: width 0.3s; }
    .progress-fill.accent { background: var(--accent); }
    .progress-fill.success { background: var(--success); }
    .progress-fill.warning { background: var(--warning); }
    .progress-fill.error { background: var(--error); }
    .progress-label { font-size: 12px; color: var(--text-secondary); min-width: 40px; }
  `],
})
export class ProgressBarComponent {
  @Input({ required: true }) value!: number;
  @Input() label?: string;
  @Input() variant: ProgressVariant = 'accent';
  @Input() showLabel = true;
}
```

**Quality Requirements**:
- Value clamped to 0-100 range
- Variant colors map to CSS variables (--accent, --success, --warning, --error)
- Label displays text if provided, otherwise percentage
- OnPush change detection for performance
- Follow 2-space indentation convention

**Files Affected**:
- apps/dashboard/src/app/shared/progress-bar/progress-bar.component.ts (CREATE)

#### Component 2: TabNavComponent
**Purpose**: Render horizontal tab navigation with active state styling and optional count badges
**Pattern**: Standalone component with button list and NgClass active state (verified from settings.component.html:7-17)
**Evidence**:
- Similar: apps/dashboard/src/app/views/settings/settings.component.html:7-17 (inline tab nav)
- Pattern source: apps/dashboard/src/app/shared/badge/badge.component.ts:11-15 (NgClass usage)
- Tab structure: apps/dashboard/src/app/models/settings.model.ts (SETTINGS_TABS - tab definition interface)

**Responsibilities**:
- Render tab buttons with icon and label
- Apply active state styling to selected tab
- Emit tab change events
- Display optional count badge per tab

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/views/settings/settings.component.html:7-17
// Verified imports from: @angular/core:Component, Input, Output, EventEmitter
// Verified imports from: @angular/common:NgClass
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

@Component({
  selector: 'app-tab-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <nav class="tab-nav">
      @for (tab of tabs; track tab.id) {
        <button
          class="tab-button"
          [ngClass]="{ 'active': activeTab === tab.id }"
          (click)="tabChange.emit(tab.id)">
          @if (tab.icon) {
            <span class="tab-icon">{{ tab.icon }}</span>
          }
          <span class="tab-label">{{ tab.label }}</span>
          @if (tab.count !== undefined && tab.count > 0) {
            <span class="tab-count">{{ tab.count }}</span>
          }
        </button>
      }
    </nav>
  `,
  styles: [`
    .tab-nav { display: flex; gap: 2px; border-bottom: 1px solid var(--border); }
    .tab-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab-button:hover { color: var(--text-primary); }
    .tab-button.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .tab-icon { font-size: 14px; }
    .tab-label { font-weight: 500; }
    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--accent-bg);
      color: var(--accent);
      border-radius: 9px;
      font-size: 11px;
      font-weight: 600;
    }
  `],
})
export class TabNavComponent {
  @Input({ required: true }) tabs!: TabItem[];
  @Input({ required: true }) activeTab!: string;
  @Output() tabChange = new EventEmitter<string>();
}
```

**Quality Requirements**:
- Track by tab.id for performance
- Active state styling matches settings pattern
- Count badge displays only if count > 0
- OnPush change detection
- TabItem interface exported for consumer use

**Files Affected**:
- apps/dashboard/src/app/shared/tab-nav/tab-nav.component.ts (CREATE)

#### Component 3: LoadingSpinnerComponent
**Purpose**: Display loading state as spinner or skeleton placeholder
**Pattern**: Standalone component with inline styles (verified from new-task.component.html:170)
**Evidence**:
- Similar: apps/dashboard/src/app/views/new-task/new-task.component.html:170 (inline spinner span)
- Pattern source: apps/dashboard/src/app/shared/empty-state/empty-state.component.ts:7-17 (inline template with @if)

**Responsibilities**:
- Render spinner icon for button/loading states
- Render skeleton placeholder for content areas
- Support size variants (sm, md, lg)
- Display optional text message

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/views/new-task/new-task.component.html:170
// Verified imports from: @angular/core:Component, Input
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerMode = 'spinner' | 'skeleton';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (mode === 'spinner') {
      <div class="spinner-container">
        <span class="spinner-icon" [ngClass]="size"></span>
        @if (text) {
          <span class="spinner-text">{{ text }}</span>
        }
      </div>
    } @else {
      <div class="skeleton" [ngClass]="'skeleton-' + size"></div>
    }
  `,
  styles: [`
    .spinner-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .spinner-icon {
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .spinner-icon.sm { width: 16px; height: 16px; border-width: 2px; }
    .spinner-icon.md { width: 20px; height: 20px; border-width: 2px; }
    .spinner-icon.lg { width: 24px; height: 24px; border-width: 3px; }
    .spinner-text { font-size: 12px; color: var(--text-secondary); }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .skeleton {
      background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s infinite;
      border-radius: var(--radius);
    }
    .skeleton.sm { height: 16px; width: 60px; }
    .skeleton.md { height: 20px; width: 120px; }
    .skeleton.lg { height: 24px; width: 200px; }
    @keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  `],
})
export class LoadingSpinnerComponent {
  @Input() size: SpinnerSize = 'md';
  @Input() mode: SpinnerMode = 'spinner';
  @Input() text?: string;
}
```

**Quality Requirements**:
- Spinner animation using CSS keyframes
- Skeleton mode with shimmer gradient animation
- Size variants: sm (16px), md (20px), lg (24px)
- Optional text message for spinner mode
- OnPush change detection

**Files Affected**:
- apps/dashboard/src/app/shared/loading-spinner/loading-spinner.component.ts (CREATE)

### Migration Strategy

#### TaskCardComponent Refactoring
**File**: apps/dashboard/src/app/shared/task-card/task-card.component.ts
**Changes**:
- Import ProgressBarComponent
- Replace lines 60-69 with: `<app-progress-bar [value]="task.progressPercent" [variant]="task.status" showLabel="true"></app-progress-bar>`
- Update imports array to include ProgressBarComponent

**Evidence**: apps/dashboard/src/app/shared/task-card/task-card.component.ts:60-69 (current inline implementation)

#### SettingsComponent Refactoring
**File**: apps/dashboard/src/app/views/settings/settings.component.ts
**Changes**:
- Import TabNavComponent
- Update template: Replace lines 7-17 with: `<app-tab-nav [tabs]="tabs" [activeTab]="activeTab()" (tabChange)="selectTab($event)"></app-tab-nav>`
- Update imports array

**Evidence**: apps/dashboard/src/app/views/settings/settings.component.ts:1-35 (component structure)
**Evidence**: apps/dashboard/src/app/views/settings/settings.component.html:7-17 (current inline implementation)

#### McpIntegrationsComponent Refactoring
**File**: apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts
**Changes**:
- Import TabNavComponent
- Define tabs array with id, label, and optional counts
- Update template: Replace inline tabs with TabNavComponent
- Remove manual switchTab method (handled by tabChange event)

**Evidence**: apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts:23-36 (tab switching logic)

## Integration Architecture

### Data Flow
- **ProgressBarComponent**: Parent → Component via @Input(value, label, variant, showLabel)
- **TabNavComponent**: Parent ↔ Component via @Input(tabs, activeTab) + @Output(tabChange)
- **LoadingSpinnerComponent**: Parent → Component via @Input(size, mode, text)

### Dependencies
- **External dependencies**: None (pure Angular)
- **Internal dependencies**: None (components are self-contained)

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements
- **Performance**: OnPush change detection on all components
- **Maintainability**: Consistent pattern with existing shared components (badge, status-indicator)
- **Testability**: Isolated components with clear input/output contracts
- **Accessibility**: Proper ARIA labels where applicable (tab navigation)

### Pattern Compliance
- Follow TASK_2026_160 component structure (standalone, inline template/styles)
- Use CSS variables from theme system (no hardcoded colors)
- Match naming conventions (camelCase, PascalCase types)
- Maintain 2-space indentation

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer
**Rationale**: Task involves Angular UI component implementation and template refactoring. All changes are frontend-only with no backend or infrastructure work.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 2-3 hours

### Files Affected Summary

**CREATE**:
- apps/dashboard/src/app/shared/progress-bar/progress-bar.component.ts
- apps/dashboard/src/app/shared/tab-nav/tab-nav.component.ts
- apps/dashboard/src/app/shared/loading-spinner/loading-spinner.component.ts

**MODIFY**:
- apps/dashboard/src/app/shared/task-card/task-card.component.ts
- apps/dashboard/src/app/views/settings/settings.component.ts
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts

**REWRITE** (Direct Replacement): None

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step implementation (that's nitro-team-leader's job)
