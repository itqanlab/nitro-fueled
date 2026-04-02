# Development Tasks — TASK_2026_180

**Total Tasks**: 7 | **Batches**: 3 | **Status**: 3/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- All 7 components confirmed to still use `@Input()` / `@Output()` decorators — migration needed
- badge, stat-card, status-indicator, task-card: inline templates — template changes go in the `.ts` file
- empty-state: inline template with one `@Output()` — `(click)="actionEvent.emit()"` is safe because `output()` also exposes `.emit()`
- compatibility-matrix: external HTML template — `@for (server of servers; ...)` and `@for (row of toolAccess; ...)` must add `()` call
- integrations-tab: external HTML template — `@for (integration of integrations; ...)` must add `()` call
- task-card template has ~20 `task.` references — all must become `task().` (confirmed by reading the template)
- stat-card uses `@if (sub)` guard — this must become `@if (sub())` after migration

### Risks Identified

| Risk | Severity | Mitigation |
| --- | --- | --- |
| task-card has ~20 `task.` references; missing even one leaves a runtime error | MED | Task 1.4 explicitly lists the exhaustive find-replace requirement |
| stat-card `@if (sub)` guard — easy to miss this non-binding usage | LOW | Task 1.2 calls it out explicitly |

---

## Batch 1: Simple Shared Components — COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: None

### Task 1.1: Migrate badge.component.ts — COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/shared/badge/badge.component.ts`
**Spec Reference**: plan.md lines 67-87

**What to change — TypeScript class**:
- Remove `Input` from the `@angular/core` import; add `input`
- Replace decorator fields with signal declarations:
  ```typescript
  readonly label   = input.required<string>();
  readonly variant = input<BadgeVariant>('neutral');
  readonly size    = input<BadgeSize>('md');
  ```

**What to change — inline template**:
- `{{ label }}` → `{{ label() }}`
- `[ngClass]="[variant, 'badge-' + size]"` → `[ngClass]="[variant(), 'badge-' + size()]"`

**Validation Notes**: Straightforward, no internal TS reads of these properties.

---

### Task 1.2: Migrate stat-card.component.ts — COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/shared/stat-card/stat-card.component.ts`
**Spec Reference**: plan.md lines 89-111

**What to change — TypeScript class**:
- Remove `Input` from the `@angular/core` import; add `input`
- Replace decorator fields with signal declarations:
  ```typescript
  readonly label      = input.required<string>();
  readonly valueClass = input<string>('');
  readonly sub        = input<string>('');
  ```

**What to change — inline template**:
- `{{ label }}` → `{{ label() }}`
- `[ngClass]="valueClass"` → `[ngClass]="valueClass()"`
- `@if (sub)` → `@if (sub())`  ← do not miss this guard
- `{{ sub }}` → `{{ sub() }}`

**Validation Notes**: The `@if (sub)` guard is a non-binding usage — must be updated to `@if (sub())`.

---

### Task 1.3: Migrate status-indicator.component.ts — COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts`
**Spec Reference**: plan.md lines 113-135

**What to change — TypeScript class**:
- Remove `Input` from the `@angular/core` import; add `input`
- Replace decorator fields with signal declarations:
  ```typescript
  readonly status = input.required<StatusType>();
  readonly pulse  = input<boolean>(true);
  readonly size   = input<StatusSize>('md');
  ```

**What to change — inline template**:
- `[ngClass]="[status, 'dot-' + size, pulse && status === 'running' ? 'dot-pulse' : '']"`
  → `[ngClass]="[status(), 'dot-' + size(), pulse() && status() === 'running' ? 'dot-pulse' : '']"`
- `[attr.aria-label]="status"` → `[attr.aria-label]="status()"`

**Validation Notes**: Three separate usages of `status` and `size` in the single ngClass binding — update all of them.

---

### Task 1.4: Migrate task-card.component.ts — COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/shared/task-card/task-card.component.ts`
**Spec Reference**: plan.md lines 137-159

**What to change — TypeScript class**:
- Remove `Input` from the `@angular/core` import; add `input`
- Replace decorator field with signal declaration:
  ```typescript
  readonly task = input.required<Task>();
  ```

**What to change — inline template**:
- Every occurrence of `task.` in the template must become `task().`
- There are approximately 20 such occurrences. Do a thorough find-replace of `task.` → `task().` throughout the template block.
- Key spots confirmed in the current template:
  - `task.pipeline.length`, `task.pipeline`, `step.stage` (no change — `step` is a loop variable)
  - `task.status` (multiple occurrences)
  - `task.priority`, `task.id`, `task.title`, `task.autoRun`
  - `task.type.toLowerCase()`, `task.type`
  - `task.agentLabel`, `task.elapsedMinutes`, `task.tokensUsed`, `task.cost`
  - `task.completedAgo`, `task.progressPercent`

**Validation Notes**: Only replace `task.` with `task().` — loop-local variables like `step.stage`, `step.status` are NOT affected. Be careful not to double-call: `task().pipeline` is correct; `task()().pipeline` is wrong.

---

**Batch 1 Verification**:
- All 4 files exist and have no `@Input` decorator remaining
- `grep -rn "@Input" apps/dashboard/src/app/shared/badge/ apps/dashboard/src/app/shared/stat-card/ apps/dashboard/src/app/shared/status-indicator/ apps/dashboard/src/app/shared/task-card/` returns zero matches
- `npx nx build dashboard` passes with zero errors

---

## Batch 2: Component with Output — COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 1 | **Dependencies**: Batch 1 complete

### Task 2.1: Migrate empty-state.component.ts — COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/shared/empty-state/empty-state.component.ts`
**Spec Reference**: plan.md lines 165-190

**What to change — TypeScript class**:
- Remove `Input`, `Output`, `EventEmitter` from the `@angular/core` import; add `input`, `output`
- Replace decorator fields with signal declarations:
  ```typescript
  readonly icon        = input.required<string>();
  readonly message     = input.required<string>();
  readonly actionLabel = input<string>('');
  readonly actionEvent = output<void>();
  ```

**What to change — inline template**:
- `{{ icon }}` → `{{ icon() }}`
- `{{ message }}` → `{{ message() }}`
- `@if (actionLabel)` → `@if (actionLabel())`
- `{{ actionLabel }}` → `{{ actionLabel() }}`
- `(click)="actionEvent.emit()"` — leave unchanged; `output()` instances expose `.emit()` identically

**Validation Notes**: The `(click)="actionEvent.emit()"` line does NOT need to change — this is confirmed safe by Angular docs and the plan. Do not modify it.

---

**Batch 2 Verification**:
- File exists and has no `@Input`, `@Output`, or `EventEmitter` remaining
- `grep -rn "@Output\|EventEmitter" apps/dashboard/src/app/shared/empty-state/` returns zero matches
- `npx nx build dashboard` passes with zero errors

---

## Batch 3: MCP View Components — COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batch 2 complete

### Task 3.1: Migrate compatibility-matrix component — COMPLETE

**Files**:
- TS: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts`
- HTML: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.html`

**Spec Reference**: plan.md lines 196-213

**What to change — TypeScript class**:
- Remove `Input` from the `@angular/core` import; add `input`
- Replace decorator fields with signal declarations:
  ```typescript
  readonly servers    = input.required<readonly McpServer[]>();
  readonly toolAccess = input.required<readonly McpToolAccessRow[]>();
  ```

**What to change — HTML template** (`compatibility-matrix.component.html`):
- Line 9: `@for (server of servers; track server.name)` → `@for (server of servers(); track server.name)`
- Line 15: `@for (row of toolAccess; track row.agent)` → `@for (row of toolAccess(); track row.agent)`
- Line 18 (inner loop): `@for (server of servers; track server.name)` → `@for (server of servers(); track server.name)`

**Validation Notes**: The inner `@for (server of servers; ...)` on line 18 is inside the `toolAccess` loop — it also references `servers` and must be updated.

---

### Task 3.2: Migrate integrations-tab component — COMPLETE

**Files**:
- TS: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts`
- HTML: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.html`

**Spec Reference**: plan.md lines 215-232

**What to change — TypeScript class**:
- Remove `Input` from the `@angular/core` import; add `input`
- Replace decorator field with signal declaration:
  ```typescript
  readonly integrations = input.required<readonly McpIntegration[]>();
  ```

**What to change — HTML template** (`integrations-tab.component.html`):
- Line 2: `@for (integration of integrations; track integration.name)` → `@for (integration of integrations(); track integration.name)`

**Validation Notes**: Only one `@for` in this template. All other references inside the loop body use `integration.` (loop-local variable) — those do NOT change.

---

**Batch 3 Verification**:
- Both TS files have no `@Input` decorator remaining
- Both HTML files use `servers()`, `toolAccess()`, `integrations()` in their `@for` directives
- Full acceptance check from plan.md:
  ```bash
  grep -rn "@Input" \
    apps/dashboard/src/app/shared/badge/ \
    apps/dashboard/src/app/shared/empty-state/ \
    apps/dashboard/src/app/shared/stat-card/ \
    apps/dashboard/src/app/shared/status-indicator/ \
    apps/dashboard/src/app/shared/task-card/ \
    apps/dashboard/src/app/views/mcp/compatibility-matrix/ \
    apps/dashboard/src/app/views/mcp/integrations-tab/
  ```
  Must return zero matches.
- `npx nx build dashboard` passes with zero errors

---

## Reference Implementation

Pattern to follow (already migrated):
`/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/new-task/strategy-selector/strategy-selector.component.ts`
