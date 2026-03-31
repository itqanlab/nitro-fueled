# Implementation Plan — TASK_2026_180

## Approach

Replace all `@Input()` / `@Output()` decorator-based fields with Angular's signal-based
`input()`, `input.required()`, and `output()` functions (available since Angular 17.1).
The migration is purely mechanical: no behaviour changes, no template structural changes,
only the class-level declarations and any internal TypeScript reads of those fields.

**Verified reference implementation** (already fully migrated):
`apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts:1`

---

## Migration Pattern

### Inputs — before (decorator)
```typescript
import { Component, Input } from '@angular/core';

@Input({ required: true }) label!: string;          // required
@Input() variant: BadgeVariant = 'neutral';          // optional with default
@Input() size: BadgeSize = 'md';                     // optional with default
```

### Inputs — after (signal)
```typescript
import { Component, input } from '@angular/core';

readonly label    = input.required<string>();
readonly variant  = input<BadgeVariant>('neutral');
readonly size     = input<BadgeSize>('md');
```

### Outputs — before (decorator)
```typescript
import { Component, EventEmitter, Output } from '@angular/core';

@Output() actionEvent = new EventEmitter<void>();
@Output() tabChange   = new EventEmitter<string>();
```

### Outputs — after (signal)
```typescript
import { Component, output } from '@angular/core';

readonly actionEvent = output<void>();
readonly tabChange   = output<string>();
```

### Internal TypeScript reads
Signal inputs are functions — any usage of `this.prop` inside the class body
must become `this.prop()`.

### Template bindings
Angular resolves signal inputs automatically in templates.
`[prop]="value"` parent bindings are unchanged.
`{{ prop }}` and `[class]="prop"` inside the component template become `{{ prop() }}`
and `[class]="prop()"`.

---

## Components to Migrate

### Batch 1 — Simple shared components (inputs only, no internal reads)

#### 1. `badge.component.ts`
File: `apps/dashboard/src/app/shared/badge/badge.component.ts`

Current decorators:
```
@Input({ required: true }) label!: string;
@Input() variant: BadgeVariant = 'neutral';
@Input() size: BadgeSize = 'md';
```
Target signals:
```typescript
readonly label   = input.required<string>();
readonly variant = input<BadgeVariant>('neutral');
readonly size    = input<BadgeSize>('md');
```
Template changes (inline template):
- `{{ label }}` → `{{ label() }}`
- `[ngClass]="[variant, 'badge-' + size]"` → `[ngClass]="[variant(), 'badge-' + size()]"`

Import diff: remove `Input`, add `input`.

---

#### 2. `stat-card.component.ts`
File: `apps/dashboard/src/app/shared/stat-card/stat-card.component.ts`

Current decorators:
```
@Input({ required: true }) label!: string;
@Input() valueClass = '';
@Input() sub = '';
```
Target signals:
```typescript
readonly label      = input.required<string>();
readonly valueClass = input<string>('');
readonly sub        = input<string>('');
```
Template changes (inline template):
- `{{ label }}` → `{{ label() }}`
- `[ngClass]="valueClass"` → `[ngClass]="valueClass()"`
- `{{ sub }}` → `{{ sub() }}`

Import diff: remove `Input`, add `input`.

---

#### 3. `status-indicator.component.ts`
File: `apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts`

Current decorators:
```
@Input({ required: true }) status!: StatusType;
@Input() pulse = true;
@Input() size: StatusSize = 'md';
```
Target signals:
```typescript
readonly status = input.required<StatusType>();
readonly pulse  = input<boolean>(true);
readonly size   = input<StatusSize>('md');
```
Template changes (inline template):
- `[ngClass]="[status, 'dot-' + size, pulse && status === 'running' ? 'dot-pulse' : '']"`
  → `[ngClass]="[status(), 'dot-' + size(), pulse() && status() === 'running' ? 'dot-pulse' : '']"`
- `[attr.aria-label]="status"` → `[attr.aria-label]="status()"`

Import diff: remove `Input`, add `input`.

---

#### 4. `task-card.component.ts`
File: `apps/dashboard/src/app/shared/task-card/task-card.component.ts`

Current decorators:
```
@Input({ required: true }) task!: Task;
```
Target signals:
```typescript
readonly task = input.required<Task>();
```
Template changes (inline template):
- All `task.xxx` references remain identical because `task` itself is the signal, not
  its inner properties. The only change is reading the signal: `task()` instead of
  `task` at the top level.
- Every binding `task.pipeline`, `task.status`, etc. becomes `task().pipeline`,
  `task().status`, etc.

Import diff: remove `Input`, add `input`.

Note: The template references `task.*` extensively — there are ~20 occurrences of `task.`
in the template. All must be prefixed with the call `task()`.

---

### Batch 2 — Components with outputs

#### 5. `empty-state.component.ts`
File: `apps/dashboard/src/app/shared/empty-state/empty-state.component.ts`

Current decorators:
```
@Input({ required: true }) icon!: string;
@Input({ required: true }) message!: string;
@Input() actionLabel = '';
@Output() actionEvent = new EventEmitter<void>();
```
Target signals:
```typescript
readonly icon        = input.required<string>();
readonly message     = input.required<string>();
readonly actionLabel = input<string>('');
readonly actionEvent = output<void>();
```
Template changes (inline template):
- `{{ icon }}` → `{{ icon() }}`
- `{{ message }}` → `{{ message() }}`
- `@if (actionLabel)` → `@if (actionLabel())`
- `{{ actionLabel }}` → `{{ actionLabel() }}`
- `(click)="actionEvent.emit()"` remains identical — `output()` instances expose `.emit()`

Import diff: remove `Input`, `Output`, `EventEmitter`; add `input`, `output`.

---

### Batch 3 — MCP view components (external templates)

#### 6. `compatibility-matrix.component.ts`
File: `apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts`

Current decorators:
```
@Input({ required: true }) servers!: readonly McpServer[];
@Input({ required: true }) toolAccess!: readonly McpToolAccessRow[];
```
Target signals:
```typescript
readonly servers    = input.required<readonly McpServer[]>();
readonly toolAccess = input.required<readonly McpToolAccessRow[]>();
```
Template file: `compatibility-matrix.component.html`
Template changes:
- `@for (server of servers; ...)` → `@for (server of servers(); ...)`
- `@for (row of toolAccess; ...)` → `@for (row of toolAccess(); ...)`

Import diff: remove `Input`, add `input`.

---

#### 7. `integrations-tab.component.ts`
File: `apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts`

Current decorators:
```
@Input({ required: true }) integrations!: readonly McpIntegration[];
```
Target signals:
```typescript
readonly integrations = input.required<readonly McpIntegration[]>();
```
Template file: `integrations-tab.component.html`
Template changes:
- `@for (integration of integrations; ...)` → `@for (integration of integrations(); ...)`

Import diff: remove `Input`, add `input`.

---

## Out-of-Scope (Do NOT Touch)

These shared components also use `@Input()` / `@Output()` but have setter logic that
requires a separate, careful migration (not part of this task's file scope):

- `progress-bar.component.ts` — setter-based `@Input` with validation logic; migrate separately
- `tab-nav.component.ts` — setter-based `@Input` with array validation; migrate separately
- `form-field.component.ts` — simple `@Input` but not listed in task scope
- `expandable-panel.component.ts` — `@Input` + `@Output`; not listed in task scope
- `button-group.component.ts` — `@Input` + `@Output`; not listed in task scope

---

## Batching Strategy

| Batch | Components | Rationale |
|-------|-----------|-----------|
| 1 | badge, stat-card, status-indicator, task-card | Inputs only, no outputs, low risk |
| 2 | empty-state | Has one output, slightly more surface area |
| 3 | compatibility-matrix, integrations-tab | External template files, verify HTML separately |

Each component is one self-contained commit. Batch 1 can be done in one commit given
the trivial mechanical nature; Batches 2 and 3 each warrant individual commits.

---

## Acceptance Verification

Run these grep commands after all migrations are complete. All should return **zero matches**:

```bash
# No @Input decorator usages remain in file scope
grep -rn "@Input" \
  apps/dashboard/src/app/shared/badge/ \
  apps/dashboard/src/app/shared/empty-state/ \
  apps/dashboard/src/app/shared/stat-card/ \
  apps/dashboard/src/app/shared/status-indicator/ \
  apps/dashboard/src/app/shared/task-card/ \
  apps/dashboard/src/app/views/mcp/compatibility-matrix/ \
  apps/dashboard/src/app/views/mcp/integrations-tab/

# No @Output decorator usages remain in file scope
grep -rn "@Output" \
  apps/dashboard/src/app/shared/badge/ \
  apps/dashboard/src/app/shared/empty-state/ \
  apps/dashboard/src/app/shared/stat-card/ \
  apps/dashboard/src/app/shared/status-indicator/ \
  apps/dashboard/src/app/shared/task-card/ \
  apps/dashboard/src/app/views/mcp/compatibility-matrix/ \
  apps/dashboard/src/app/views/mcp/integrations-tab/

# No EventEmitter usages remain in file scope
grep -rn "EventEmitter" \
  apps/dashboard/src/app/shared/empty-state/

# Confirm signal imports are present
grep -rn "from '@angular/core'" \
  apps/dashboard/src/app/shared/badge/badge.component.ts \
  apps/dashboard/src/app/shared/empty-state/empty-state.component.ts \
  apps/dashboard/src/app/shared/stat-card/stat-card.component.ts \
  apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts \
  apps/dashboard/src/app/shared/task-card/task-card.component.ts \
  apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts \
  apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts
```

Final check: `nx build dashboard` must complete with zero errors.

---

## Files Affected Summary

**MODIFY** (TypeScript class + inline template):
- `apps/dashboard/src/app/shared/badge/badge.component.ts`
- `apps/dashboard/src/app/shared/stat-card/stat-card.component.ts`
- `apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts`
- `apps/dashboard/src/app/shared/task-card/task-card.component.ts`
- `apps/dashboard/src/app/shared/empty-state/empty-state.component.ts`

**MODIFY** (TypeScript class only):
- `apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts`
- `apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts`

**MODIFY** (HTML template only):
- `apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.html`
- `apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.html`

**No changes**: SCSS files, model files, parent components.
