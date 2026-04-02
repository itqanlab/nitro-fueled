# Development Tasks - TASK_2026_161

## Batch 1: Create ProgressBarComponent - COMPLETE

**Developer**: nitro-frontend-developer

### Task 1.1: Create ProgressBarComponent file and structure

**File**: apps/dashboard/src/app/shared/progress-bar/progress-bar.component.ts
**Status**: COMPLETE

Create the standalone Angular component with:
- Standalone component decorator
- ChangeDetectionStrategy.OnPush
- NgClass import
- Type definitions: ProgressVariant = 'accent' | 'success' | 'warning' | 'error'
- Component class with @Input decorators for value, label, variant, showLabel

### Task 1.2: Implement ProgressBarComponent template and styles

**File**: apps/dashboard/src/app/shared/progress-bar/progress-bar.component.ts
**Status**: COMPLETE

Add template and inline styles:
- Template with progress bar container and fill div
- Percentage width binding via [style.width.%]="value"
- Optional label display with @if block
- CSS styles for progress-bar, progress-fill, progress-label
- Variant color classes mapping to CSS variables (--accent, --success, --warning, --error)
- Transitions for smooth width changes

---

## Batch 2: Create TabNavComponent - COMPLETE

**Developer**: nitro-frontend-developer

### Task 2.1: Create TabNavComponent file and interface

**File**: apps/dashboard/src/app/shared/tab-nav/tab-nav.component.ts
**Status**: COMPLETE

Create the standalone Angular component with:
- Standalone component decorator
- ChangeDetectionStrategy.OnPush
- NgClass import
- TabItem interface export: { id: string, label: string, icon?: string, count?: number }
- Component class with @Input for tabs, activeTab and @Output for tabChange

### Task 2.2: Implement TabNavComponent template and styles

**File**: apps/dashboard/src/app/shared/tab-nav/tab-nav.component.ts
**Status**: COMPLETE

Add template and inline styles:
- Template with nav element and button list (@for loop)
- Track by tab.id
- Active state styling via NgClass
- Click event emitting tab.id via tabChange.emit()
- Optional icon, label, and count badge display
- CSS styles for tab-nav, tab-button, active state, icon, label, count
- Border-bottom and hover effects matching settings pattern

---

## Batch 3: Create LoadingSpinnerComponent - COMPLETE

**Developer**: nitro-frontend-developer

### Task 3.1: Create LoadingSpinnerComponent file and type definitions

**File**: apps/dashboard/src/app/shared/loading-spinner/loading-spinner.component.ts
**Status**: COMPLETE

Create the standalone Angular component with:
- Standalone component decorator
- ChangeDetectionStrategy.OnPush
- Type definitions: SpinnerSize = 'sm' | 'md' | 'lg', SpinnerMode = 'spinner' | 'skeleton'
- Component class with @Input decorators for size, mode, text

### Task 3.2: Implement LoadingSpinnerComponent template and animations

**File**: apps/dashboard/src/app/shared/loading-spinner/loading-spinner.component.ts
**Status**: COMPLETE

Add template and inline styles:
- Template with @if block for mode switching (spinner vs skeleton)
- Spinner mode: spinning border icon with optional text
- Skeleton mode: shimmer gradient placeholder
- CSS @keyframes for spin animation
- CSS @keyframes for skeleton-shimmer animation
- Size variants: sm (16px), md (20px), lg (24px)
- CSS variables for colors (--accent, --border, --bg-tertiary, --bg-hover)

---

## Batch 4: Refactor TaskCardComponent - COMPLETE

**Developer**: nitro-frontend-developer

### Task 4.1: Import ProgressBarComponent and update imports array

**File**: apps/dashboard/src/app/shared/task-card/task-card.component.ts
**Status**: COMPLETE

Add ProgressBarComponent import and include in imports array:
- Import: import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
- Update standalone imports array: imports: [NgClass, ProgressBarComponent]

### Task 4.2: Replace inline progress bar with ProgressBarComponent

**File**: apps/dashboard/src/app/shared/task-card/task-card.component.ts
**Status**: COMPLETE

Replace lines 60-69 in template:
- Remove: Inline progress-bar, task-progress-bar, task-progress-fill, task-progress-label elements
- Add: <app-progress-bar [value]="task.progressPercent" [variant]="task.status" showLabel="true"></app-progress-bar>
- Remove corresponding styles (task-progress, task-progress-bar, task-progress-fill, task-progress-label classes)

---

## Batch 5: Refactor SettingsComponent - COMPLETE

**Developer**: nitro-frontend-developer

### Task 5.1: Import TabNavComponent and update imports

**File**: apps/dashboard/src/app/views/settings/settings.component.ts
**Status**: COMPLETE

Add TabNavComponent import and update imports array:
- Import: import { TabNavComponent, TabItem } from '../../shared/tab-nav/tab-nav.component';
- Update standalone imports array: imports: [NgClass, TabNavComponent, ApiKeysComponent, LaunchersComponent, SubscriptionsComponent, MappingComponent]

### Task 5.2: Replace inline tabs with TabNavComponent in template

**File**: apps/dashboard/src/app/views/settings/settings.component.html
**Status**: COMPLETE

Replace lines 7-17 in template:
- Remove: Inline settings-tabs nav and settings-tab buttons
- Add: <app-tab-nav [tabs]="tabs" [activeTab]="activeTab()" (tabChange)="selectTab($event)"></app-tab-nav>
- Note: SETTINGS_TABS array already has correct structure (id, icon, label)

---

## Batch 6: Refactor McpIntegrationsComponent - COMPLETE

**Developer**: nitro-frontend-developer

### Task 6.1: Import TabNavComponent and define tabs array

**File**: apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts
**Status**: COMPLETE

Add TabNavComponent and define tabs:
- Import: import { TabNavComponent, TabItem } from '../../shared/tab-nav/tab-nav.component';
- Add to imports array: [NgClass, TabNavComponent, CompatibilityMatrixComponent, IntegrationsTabComponent]
- Define tabs readonly array: [{ id: 'servers', label: 'MCP Servers', count: X }, { id: 'integrations', label: 'Integrations', count: Y }]
- Replace activeTab property to use tabs array logic or keep signal

### Task 6.2: Replace inline tabs with TabNavComponent in template

**File**: apps/dashboard/src/app/views/mcp/mcp-integrations.component.html (or .ts if inline)
**Status**: COMPLETE

Replace inline tab buttons:
- Remove: Inline tab buttons and manual active state styling
- Add: <app-tab-nav [tabs]="tabs" [activeTab]="activeTab" (tabChange)="activeTab = $event"></app-tab-nav>
- Remove switchTab method if no longer needed
